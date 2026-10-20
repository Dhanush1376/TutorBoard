/**
 * Splits what an instrumented program printed into its own output and the
 * step records the recorder wrote between \x1e and \x1f, and turns those into
 * trace steps (the format in client/src/visualizer/traceModel.js).
 */

export interface TraceValue { t: string; [k: string]: unknown }
export interface TraceFrame { id: number; name: string; line: number; locals: { name: string; value: TraceValue }[] }
export interface TraceStep { line: number; event: 'line' | 'call' | 'return' | 'exception'; frames: TraceFrame[]; out: number; ret?: TraceValue; exc?: string }

export interface ParsedOutput {
  steps: TraceStep[];
  stdout: string;
  truncated: boolean;
  limitReason: 'steps' | 'size' | null;
  cutOff: boolean;   // the output ended in the middle of a record (e.g. a crash)
  thinSteps: number; // steps printed without values because they were too large
}

const START = '\u001e';
const END = '\u001f';

export function parseTraceOutput(raw: string, sourceLineCount: number): ParsedOutput {
  const steps: TraceStep[] = [];
  let stdout = '';
  let truncated = false;
  let limitReason: ParsedOutput['limitReason'] = null;
  let cutOff = false;
  let thinSteps = 0;
  let i = 0;
  const clampLine = (l: unknown) => {
    const n = Number(l);
    return Number.isInteger(n) && n >= 1 ? Math.min(n, sourceLineCount) : 1;
  };

  while (i < raw.length) {
    const s = raw.indexOf(START, i);
    if (s < 0) {
      stdout += raw.slice(i);
      break;
    }
    stdout += raw.slice(i, s);
    const e = raw.indexOf(END, s + 1);
    if (e < 0) {
      cutOff = true;
      break;
    }
    const body = raw.slice(s + 1, e);
    i = e + 1;
    let rec: any;
    try {
      rec = JSON.parse(body);
    } catch {
      cutOff = true;
      continue;
    }
    if (rec.e === 'limit') {
      truncated = true;
      limitReason = rec.why === 'size' ? 'size' : 'steps';
      break;
    }
    if (!['line', 'call', 'return', 'exception'].includes(rec.e) || !Array.isArray(rec.f) || !rec.f.length) continue;
    if (rec.x) thinSteps++;
    const step: TraceStep = {
      line: clampLine(rec.l),
      event: rec.e,
      frames: rec.f.map((f: any) => ({
        id: Number(f.i) || 0,
        name: String(f.n || 'function'),
        line: clampLine(f.l),
        locals: (Array.isArray(f.v) ? f.v : []).map(([name, value]: [string, TraceValue]) => ({ name: String(name), value })),
      })),
      out: stdout.length,
    };
    if (rec.r !== undefined) step.ret = rec.r;
    if (rec.e === 'exception') step.exc = String(rec.m || 'An exception was thrown');
    steps.push(step);
  }
  return { steps, stdout, truncated, limitReason, cutOff, thinSteps };
}
