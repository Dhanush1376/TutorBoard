# TutorBoard Python tracer. Runs the learner's program under sys.settrace and
# records every line, call, return and exception as a step in the trace format
# described in visualizer/traceModel.js. Loaded into Pyodide inside a Web Worker;
# also runs unchanged on desktop CPython for tests.
import sys, json, math, types, builtins

_FILE = 'main.py'
_SKIP_FRAMES = ('<listcomp>', '<dictcomp>', '<setcomp>', '<genexpr>')
_MAX_ITEMS = 50
_MAX_STR = 200
_MAX_DEPTH = 6


class _StepLimit(BaseException):
    """Raised inside the program when the step budget is spent. BaseException so
    an ordinary `except Exception:` in the learner's code can't swallow it."""


def _encode(v, seen, depth=0):
    t = type(v)
    if v is None:
        return {'t': 'none', 'v': 'None'}
    if t is bool:
        return {'t': 'bool', 'v': v}
    if t is int:
        return {'t': 'num', 'v': v if -(2 ** 53) < v < 2 ** 53 else str(v)}
    if t is float:
        return {'t': 'num', 'v': v if math.isfinite(v) else repr(v)}
    if t is str:
        out = {'t': 'str', 'v': v[:_MAX_STR]}
        if len(v) > _MAX_STR:
            out['more'] = len(v) - _MAX_STR
        return out
    if t is complex:
        return {'t': 'num', 'v': repr(v)}
    if isinstance(v, (types.FunctionType, types.BuiltinFunctionType, types.MethodType)):
        name = getattr(v, '__qualname__', getattr(v, '__name__', 'function'))
        try:
            import inspect
            return {'t': 'fn', 'v': f'{name}{inspect.signature(v)}'}
        except (TypeError, ValueError):
            return {'t': 'fn', 'v': f'{name}(…)'}
    if isinstance(v, type):
        return {'t': 'other', 'v': f'class {v.__name__}'}
    if isinstance(v, types.ModuleType):
        return {'t': 'other', 'v': f'module {v.__name__}'}

    i = id(v)
    if i in seen:
        return {'t': 'ref', 'id': i}
    if depth >= _MAX_DEPTH:
        return {'t': 'other', 'v': '…'}
    seen.add(i)

    if isinstance(v, (list, tuple, set, frozenset)) or type(v).__name__ == 'deque':
        items = list(v) if not isinstance(v, (set, frozenset)) else _sorted_if_possible(v)
        return {'t': 'list', 'kind': t.__name__, 'id': i, 'len': len(items),
                'items': [_encode(x, seen, depth + 1) for x in items[:_MAX_ITEMS]]}
    if isinstance(v, dict):
        entries = list(v.items())
        return {'t': 'map', 'kind': t.__name__, 'id': i, 'len': len(entries),
                'entries': [[_encode(k, seen, depth + 1), _encode(x, seen, depth + 1)] for k, x in entries[:_MAX_ITEMS]]}
    fields = None
    if hasattr(v, '__dict__') and isinstance(getattr(v, '__dict__', None), dict):
        fields = list(v.__dict__.items())
    elif hasattr(t, '__slots__'):
        fields = [(s, getattr(v, s)) for s in t.__slots__ if hasattr(v, s)]
    if fields is not None and not callable(v):
        return {'t': 'obj', 'cls': t.__name__, 'id': i,
                'fields': [{'name': k, 'value': _encode(x, seen, depth + 1)} for k, x in fields[:_MAX_ITEMS] if not k.startswith('__')]}
    try:
        text = repr(v)
    except Exception:
        text = f'<{t.__name__}>'
    return {'t': 'other', 'v': text[:_MAX_STR]}


def _sorted_if_possible(s):
    try:
        return sorted(s)
    except TypeError:
        return list(s)


class _Out:
    """Stand-in for sys.stdout that keeps everything printed and how much."""

    def __init__(self):
        self.parts = []
        self.size = 0

    def write(self, text):
        text = str(text)
        self.parts.append(text)
        self.size += len(text.encode('utf-16-le')) // 2  # JavaScript string length
        return len(text)

    def flush(self):
        pass

    def text(self):
        return ''.join(self.parts)


def __tb_trace(source, max_steps=1000, stdin=''):
    steps = []
    out = _Out()
    frame_ids = {}
    state = {'truncated': False, 'error': None, 'last_exc': None}
    raising = set()  # frames an exception is passing through: their 'return' isn't a real return
    stdin_lines = stdin.split('\n') if stdin else []
    if stdin_lines and stdin_lines[-1] == '':
        stdin_lines.pop()

    def fake_input(prompt=''):
        out.write(str(prompt))
        if not stdin_lines:
            raise EOFError('input() found no more lines. Add them in the Input box.')
        return stdin_lines.pop(0)

    def frame_id(f):
        key = id(f)
        if key not in frame_ids or frame_ids[key][0] is not f:
            frame_ids[key] = (f, len(frame_ids) + 1)
        return frame_ids[key][1]

    def locals_of(f, seen):
        if f.f_code.co_name == '<module>':
            items = [(k, v) for k, v in f.f_globals.items()
                     if not (k.startswith('__') and k.endswith('__')) and not isinstance(v, types.ModuleType)]
        else:
            items = list(f.f_locals.items())
        return [{'name': k, 'value': _encode(v, seen)} for k, v in items]

    def snapshot(frame):
        chain = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == _FILE and f.f_code.co_name not in _SKIP_FRAMES:
                chain.append(f)
            f = f.f_back
        chain.reverse()
        seen = set()
        return [{'id': frame_id(f), 'name': 'global' if f.f_code.co_name == '<module>' else f.f_code.co_name,
                 'line': f.f_lineno, 'locals': locals_of(f, seen)} for f in chain], seen

    def record(frame, event, arg):
        if len(steps) >= max_steps:
            state['truncated'] = True
            raise _StepLimit()
        frames, seen = snapshot(frame)
        step = {'line': frame.f_lineno, 'event': event, 'frames': frames, 'out': out.size}
        if event == 'return' and frame.f_code.co_name != '<module>':  # the module's return is "program finished"
            step['ret'] = _encode(arg, seen)
        elif event == 'exception':
            exc_type, exc, _tb = arg
            step['exc'] = f'{exc_type.__name__}: {exc}'
        steps.append(step)

    def tracer(frame, event, arg):
        code = frame.f_code
        if code.co_filename != _FILE or code.co_name in _SKIP_FRAMES:
            return None
        if event == 'call' and code.co_name == '<module>':
            return tracer  # the module's first 'line' event says the same thing
        if event == 'exception':
            raising.add(id(frame))
            # One step per raise, not one per frame it passes through.
            if state['last_exc'] is arg[1]:
                return tracer
            state['last_exc'] = arg[1]
        elif event == 'line':
            raising.discard(id(frame))  # caught here; carrying on
        elif event == 'return' and id(frame) in raising:
            raising.discard(id(frame))
            return tracer
        if event in ('call', 'line', 'return', 'exception'):
            record(frame, event, arg)
        return tracer

    try:
        code = compile(source, _FILE, 'exec')
    except SyntaxError as e:
        return json.dumps({'steps': [], 'stdout': '', 'truncated': False,
                           'error': {'kind': 'compile', 'message': f'SyntaxError: {e.msg}', 'line': e.lineno or 1}})

    namespace = {'__name__': '__main__', '__builtins__': builtins}
    real_stdout, real_input = sys.stdout, builtins.input
    sys.stdout = out
    builtins.input = fake_input
    sys.settrace(tracer)
    try:
        exec(code, namespace)
    except _StepLimit:
        pass
    except BaseException as e:  # the learner's own error: report it, with the line it came from
        line = None
        tb = e.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == _FILE:
                line = tb.tb_lineno
            tb = tb.tb_next
        state['error'] = {'kind': 'runtime', 'message': f'{type(e).__name__}: {e}', 'line': line}
    finally:
        sys.settrace(None)
        sys.stdout = real_stdout
        builtins.input = real_input

    if state['truncated']:
        state['error'] = state['error'] or {'kind': 'limit', 'message': f'Stopped after {max_steps} steps.'}
    return json.dumps({'steps': steps, 'stdout': out.text(), 'truncated': state['truncated'], 'error': state['error']},
                      default=str)
