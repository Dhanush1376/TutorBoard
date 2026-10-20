import { Edits, SyntaxNode, fieldChildren, lineOf, endLineOf, namedChildren, parseSource } from './syntax.js';
import { javaRuntime } from './runtime/javaRuntime.js';

/**
 * Rewrites a Java program so it reports each step while it runs (recorder in
 * ./runtime/javaRuntime.ts, appended as one extra class after the learner's
 * code). Only calls are inserted — never a line break — so the line numbers in
 * compiler messages and stack traces still match.
 *
 * Java checks more than C at compile time, and the rewrite respects that:
 *   - a variable is shown only once it is definitely assigned, so reading it compiles;
 *   - `while (true)` / `for (;;)` keep their constant test, so the compiler still
 *     knows the loop doesn't fall through (no "missing return statement");
 *   - nothing is inserted after a return, break, continue or throw.
 */

interface ScopeVar { name: string; pending: boolean }
interface Scope { vars: ScopeVar[] }
interface Fn { hasThis: boolean }

export async function instrumentJava(source: string, limits: { maxSteps: number; maxBytes: number }) {
  const tree = await parseSource('java', source);
  const edits = new Edits();
  const notes = new Set<string>();
  const q = (s: string) => JSON.stringify(s);

  const visible = (scopes: Scope[], fn: Fn) => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (let i = scopes.length - 1; i >= 0; i--) {
      for (let j = scopes[i].vars.length - 1; j >= 0; j--) {
        const v = scopes[i].vars[j];
        if (seen.has(v.name)) continue;
        seen.add(v.name);
        if (!v.pending) names.unshift(v.name);
      }
    }
    if (fn.hasThis) names.unshift('this');
    return names;
  };

  // `line, names, values` — the arguments every recorder call takes.
  const args = (line: number, scopes: Scope[], fn: Fn) => {
    const names = visible(scopes, fn);
    return `${line},new String[]{${names.map(q).join(',')}},new Object[]{${names.join(',')}}`;
  };
  const step = (line: number, scopes: Scope[], fn: Fn) => `__TB.s(${args(line, scopes, fn)});`;

  function declare(decl: SyntaxNode, scope: Scope) {
    for (const d of fieldChildren(decl, 'declarator')) {
      const name = d.childForFieldName('name')?.text;
      if (!name || name.startsWith('__')) continue;
      scope.vars.push({ name, pending: !d.childForFieldName('value') });
    }
  }

  // `x = …;` at the top level of the block that declared x: from here on x is definitely assigned.
  function markAssigned(stmt: SyntaxNode, scope: Scope) {
    const e = stmt.namedChild(0);
    if (e?.type !== 'assignment_expression') return;
    const left = e.childForFieldName('left');
    if (left?.type !== 'identifier') return;
    const v = scope.vars.find((x) => x.name === left.text);
    if (v) v.pending = false;
  }

  const isConstantTrue = (n: SyntaxNode | null) => !!n && n.text.replace(/[()\s]/g, '') === 'true';
  const NO_STEP = new Set(['line_comment', 'block_comment', 'class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration', 'explicit_constructor_invocation', 'local_class_declaration']);

  function visitBlock(block: SyntaxNode, scopes: Scope[], fn: Fn, scope: Scope = { vars: [] }, skipFirst = 0) {
    const inner = [...scopes, scope];
    namedChildren(block).forEach((st, i) => {
      if (i < skipFirst) return;
      visitListed(st, inner, scope, fn);
    });
  }

  function visitListed(st: SyntaxNode, scopes: Scope[], scope: Scope, fn: Fn) {
    if (st.type.endsWith('comment')) return;
    const headerStep = (st.type === 'for_statement' && st.childForFieldName('condition') && !isConstantTrue(st.childForFieldName('condition'))) ||
      (st.type === 'while_statement' && !isConstantTrue(st.childForFieldName('condition')));
    if (!NO_STEP.has(st.type) && !headerStep) edits.insert(st.startIndex, step(lineOf(st), scopes, fn));
    visitStatement(st, scopes, fn);
    if (st.type === 'local_variable_declaration') declare(st, scope);
    else if (st.type === 'expression_statement') markAssigned(st, scope);
  }

  function visitBody(body: SyntaxNode | null, scopes: Scope[], fn: Fn, parentLine: number) {
    if (!body) return;
    if (body.type === 'block') return visitBlock(body, scopes, fn);
    if (lineOf(body) === parentLine || body.type === ';') return visitStatement(body, scopes, fn);
    edits.insert(body.startIndex, `{${step(lineOf(body), scopes, fn)}`);
    visitStatement(body, scopes, fn);
    edits.insert(body.endIndex, '}');
  }

  function wrapTest(expr: SyntaxNode, line: number, scopes: Scope[], fn: Fn) {
    edits.insert(expr.startIndex, `__TB.t(${args(line, scopes, fn)})&&(`);
    edits.insert(expr.endIndex, ')');
  }

  // `( x )` → x
  const unwrap = (n: SyntaxNode | null) => (n && (n.type === 'parenthesized_expression' || n.type === 'condition') ? n.namedChild(0) : n);

  function visitStatement(st: SyntaxNode, scopes: Scope[], fn: Fn) {
    switch (st.type) {
      case 'block':
        return visitBlock(st, scopes, fn);
      case 'if_statement': {
        const cons = st.childForFieldName('consequence');
        visitBody(cons, scopes, fn, lineOf(st));
        const alt = st.childForFieldName('alternative');
        if (alt?.type === 'if_statement') {
          edits.insert(alt.startIndex, `{${step(lineOf(alt), scopes, fn)}`);
          visitStatement(alt, scopes, fn);
          edits.insert(alt.endIndex, '}');
        } else if (alt) visitBody(alt, scopes, fn, cons && lineOf(alt) === endLineOf(cons) ? lineOf(alt) : lineOf(st));
        return;
      }
      case 'for_statement': {
        const scope: Scope = { vars: [] };
        const inner = [...scopes, scope];
        for (const init of fieldChildren(st, 'init')) if (init.type === 'local_variable_declaration') declare(init, scope);
        const cond = st.childForFieldName('condition');
        if (cond && !isConstantTrue(cond)) wrapTest(cond, lineOf(st), inner, fn);
        visitBody(st.childForFieldName('body'), inner, fn, lineOf(st));
        return;
      }
      case 'enhanced_for_statement': {
        const scope: Scope = { vars: [] };
        const name = st.childForFieldName('name')?.text;
        if (name) scope.vars.push({ name, pending: false });
        visitBody(st.childForFieldName('body'), [...scopes, scope], fn, lineOf(st));
        return;
      }
      case 'while_statement': {
        const cond = unwrap(st.childForFieldName('condition'));
        if (cond && !isConstantTrue(cond)) wrapTest(cond, lineOf(st), scopes, fn);
        visitBody(st.childForFieldName('body'), scopes, fn, lineOf(st));
        return;
      }
      case 'do_statement': {
        visitBody(st.childForFieldName('body'), scopes, fn, lineOf(st));
        const condNode = st.childForFieldName('condition');
        const cond = unwrap(condNode);
        if (cond && condNode && !isConstantTrue(cond)) wrapTest(cond, lineOf(condNode), scopes, fn);
        return;
      }
      case 'switch_expression':
      case 'switch_statement': {
        const body = st.childForFieldName('body');
        if (!body) return;
        for (const group of namedChildren(body)) {
          if (group.type !== 'switch_block_statement_group') continue;
          // Variables declared in one case group aren't assigned in the next, so each group gets its own scope.
          const scope: Scope = { vars: [] };
          const inner = [...scopes, scope];
          for (const s of namedChildren(group)) if (s.type !== 'switch_label') visitListed(s, inner, scope, fn);
        }
        return;
      }
      case 'labeled_statement': {
        const inner = namedChildren(st).find((c) => c.type !== 'identifier');
        if (inner) visitStatement(inner, scopes, fn);
        return;
      }
      case 'try_statement':
      case 'try_with_resources_statement': {
        const scope: Scope = { vars: [] };
        const resources = st.childForFieldName('resources');
        if (resources) for (const r of namedChildren(resources)) if (r.childForFieldName('name')) scope.vars.push({ name: r.childForFieldName('name')!.text, pending: false });
        const body = st.childForFieldName('body');
        if (body) visitBlock(body, [...scopes, scope], fn);
        for (const c of namedChildren(st)) {
          if (c.type === 'catch_clause') {
            const param = namedChildren(c).find((x) => x.type === 'catch_formal_parameter');
            const cs: Scope = { vars: [] };
            const name = param?.childForFieldName('name')?.text;
            if (name) cs.vars.push({ name, pending: false });
            const b = c.childForFieldName('body');
            if (b) visitBlock(b, [...scopes, cs], fn);
          } else if (c.type === 'finally_clause') {
            const b = namedChildren(c).find((x) => x.type === 'block');
            if (b) visitBlock(b, scopes, fn);
          }
        }
        return;
      }
      case 'synchronized_statement': {
        const b = namedChildren(st).find((x) => x.type === 'block');
        if (b) visitBlock(b, scopes, fn);
        return;
      }
      case 'return_statement': {
        const expr = namedChildren(st).find((c) => !c.type.endsWith('comment')) || null;
        const line = lineOf(st);
        if (expr) {
          edits.insert(expr.startIndex, '__TB.ret(');
          edits.insert(expr.endIndex, `,${args(line, scopes, fn)})`);
        } else {
          edits.insert(st.startIndex, `{__TB.retVoid(${args(line, scopes, fn)});`);
          edits.insert(st.endIndex, '}');
        }
        return;
      }
      default:
        return;
    }
  }

  function visitMethod(m: SyntaxNode, className: string) {
    const body = m.childForFieldName('body');
    if (!body) return;
    const mods = namedChildren(m).find((c) => c.type === 'modifiers')?.text || '';
    const isCtor = m.type === 'constructor_declaration';
    const name = isCtor ? className : m.childForFieldName('name')?.text || 'method';
    const fn: Fn = { hasThis: !/\bstatic\b/.test(mods) };
    const scope: Scope = { vars: [] };
    const params = m.childForFieldName('parameters');
    if (params) {
      for (const p of namedChildren(params)) {
        const n = p.childForFieldName('name')?.text || (p.type === 'spread_parameter' ? namedChildren(p).find((x) => x.type === 'variable_declarator')?.childForFieldName('name')?.text : null);
        if (n && p.type !== 'receiver_parameter') scope.vars.push({ name: n, pending: false });
      }
    }
    const scopes = [scope];
    const line = lineOf(m);
    // A constructor's this(...) / super(...) call must stay first.
    const first = namedChildren(body)[0];
    const startsWithCall = isCtor && first?.type === 'explicit_constructor_invocation';
    const at = startsWithCall ? first.endIndex : body.startIndex + 1;
    edits.insert(at, `__TB.Fr __f=__TB.enter(${q(name)},${args(line, scopes, fn)});try{`);
    visitBlock(body, scopes, fn, { vars: [] }, startsWithCall ? 1 : 0);
    edits.insert(body.endIndex - 1, `}catch(Throwable __e){__TB.exc(__f,__e);throw __e;}finally{__TB.exit(__f,${endLineOf(body)});}`);
  }

  // Every method and constructor with a body, except inside lambdas (left as they are).
  function walk(n: SyntaxNode, className: string) {
    for (const c of namedChildren(n)) {
      if (c.type === 'lambda_expression') continue;
      if (c.type === 'method_declaration' || c.type === 'constructor_declaration') {
        visitMethod(c, className);
        const body = c.childForFieldName('body');
        if (body) walk(body, className); // anonymous and local classes inside it
        continue;
      }
      const isType = ['class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration'].includes(c.type);
      walk(c, isType ? c.childForFieldName('name')?.text || className : c.type === 'object_creation_expression' ? 'anonymous' : className);
    }
  }
  walk(tree.rootNode, 'Main');
  if (/->/.test(source)) notes.add('Code inside lambdas (->) runs as one step.');

  const code = `${edits.apply(source)}\n${javaRuntime(limits.maxSteps, limits.maxBytes)}`;
  return { code, notes: [...notes] };
}
