import { parse } from 'acorn';

/**
 * Rewrites a JavaScript program so that, when it runs, it reports every step to
 * the `__tb` recorder (see jsRuntime.js). Only calls are inserted — never a new
 * line — so line numbers in errors still match the learner's code.
 *
 *   before each statement      __tb.s(line, snap)
 *   in each loop test          (__tb.s(line, snap), test)
 *   at the top of a function   const __f = __tb.enter(name, line, snap); try { … }
 *                              catch (__e) { __tb.exc(__e); throw __e } finally { __tb.exit(__f) }
 *   return x                   return __tb.r(line, snap, x)
 *
 * `snap` is a small closure that reads the variables in scope at that point, so
 * the recorder always sees live values — for every frame on the stack, not only
 * the one running.
 */

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const LOOP_HEADER = new Set(['ForStatement', 'WhileStatement']);

export class InstrumentError extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

export function instrumentJavaScript(source) {
  let ast;
  try {
    ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
      preserveParens: true,
      allowAwaitOutsideFunction: true,
      allowHashBang: true,
    });
  } catch (e) {
    throw new InstrumentError(`SyntaxError: ${e.message.replace(/\s*\(\d+:\d+\)$/, '')}`, e.loc?.line || 1);
  }

  const edits = []; // { pos, text, seq } — applied back to front
  let seq = 0;
  const insert = (pos, text) => edits.push({ pos, text, seq: seq++ });
  const usesAsync = /\b(async|await|yield)\b/.test(source);

  /* ── Scopes ──────────────────────────────────────────────────────────── */

  const patternNames = (p, out = []) => {
    if (!p) return out;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
    else if (p.type === 'RestElement') patternNames(p.argument, out);
    else if (p.type === 'ArrayPattern') p.elements.forEach((e) => patternNames(e, out));
    else if (p.type === 'ObjectPattern') p.properties.forEach((pr) => patternNames(pr.type === 'RestElement' ? pr : pr.value, out));
    return out;
  };

  // `var` declarations anywhere in a function body (but not in nested functions).
  const collectVars = (node, out) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => collectVars(n, out));
    if (FUNCTION_TYPES.has(node.type) || node.type === 'ClassBody') return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') node.declarations.forEach((d) => patternNames(d.id).forEach((n) => out.set(n, 'var')));
    for (const key in node) if (key !== 'loc' && node[key] && typeof node[key] === 'object') collectVars(node[key], out);
  };

  // let / const / class / function declared directly in a list of statements.
  const collectLexical = (statements, out) => {
    for (const st of statements) {
      if (st.type === 'VariableDeclaration' && st.kind !== 'var') st.declarations.forEach((d) => patternNames(d.id).forEach((n) => out.set(n, 'let')));
      else if (st.type === 'ClassDeclaration' && st.id) out.set(st.id.name, 'let');
      else if (st.type === 'FunctionDeclaration' && st.id) out.set(st.id.name, 'var');
    }
  };

  // A snapshot closure for the names visible in this function at this point.
  const snapOf = (scopes) => {
    const seen = new Set();
    let parts = [];
    // Innermost scope wins a name; the list still reads outer-to-inner, in declaration order.
    for (let i = scopes.length - 1; i >= 0; i--) {
      const group = [];
      for (const [name, kind] of scopes[i].names) {
        if (seen.has(name) || name === '__tb' || name === '__f' || name === '__e') continue;
        seen.add(name);
        // let/const/class can be read before they're set up (the "temporal dead zone"); guard those.
        group.push(kind === 'let' ? `(()=>{try{return["${name}",${name}]}catch{return 0}})()` : `["${name}",${name}]`);
      }
      parts = [...group, ...parts];
      if (scopes[i].fn) break;
    }
    // `this` in a derived constructor can't be read before super(); guard it too.
    if (scopes.thisAllowed) parts.unshift('(()=>{try{return["this",this]}catch{return 0}})()');
    return `()=>[${parts.join(',')}]`;
  };

  /* ── Walk ────────────────────────────────────────────────────────────── */

  const lineOf = (node) => node.loc.start.line;

  const stepAt = (node, scopes) => `__tb.s(${lineOf(node)},${snapOf(scopes)});`;

  const withScope = (scopes, names, fn, thisAllowed) => {
    const next = [...scopes, { names, fn }];
    next.thisAllowed = fn ? !!thisAllowed : scopes.thisAllowed;
    return next;
  };

  function visitStatements(list, scopes) {
    for (const st of list) {
      const skip =
        st.type === 'FunctionDeclaration' ||
        st.type === 'EmptyStatement' ||
        (st.type === 'ExpressionStatement' && st.directive) ||
        LOOP_HEADER.has(st.type);
      if (!skip) insert(st.start, stepAt(st, scopes));
      visit(st, scopes);
    }
  }

  // A loop or if body that isn't a { block }: wrap it so the step call has somewhere to live.
  function visitBody(body, scopes, parentLine) {
    if (!body) return;
    if (body.type === 'BlockStatement') return visit(body, scopes);
    if (body.type === 'EmptyStatement') return;
    // `if (x) return 1;` on one line: the line already has its step.
    if (lineOf(body) === parentLine) return visit(body, scopes);
    const names = new Map();
    collectLexical([body], names);
    const inner = withScope(scopes, names, false);
    insert(body.start, `{${stepAt(body, inner)}`);
    visit(body, inner);
    insert(body.end, '}');
  }

  function visitFunction(node, scopes, name) {
    const names = new Map();
    node.params.forEach((p) => patternNames(p, []).forEach((n) => names.set(n, 'var')));
    if (node.body.type === 'BlockStatement') {
      collectVars(node.body.body, names);
      collectLexical(node.body.body, names);
    }
    const isMethod = node.__method;
    const inner = withScope(scopes, names, true, isMethod);
    node.params.forEach((p) => visit(p, inner));
    const fnSnap = snapOf(inner);
    const head = `const __f=__tb.enter(${JSON.stringify(name)},${lineOf(node)},${fnSnap});try{`;
    const tail = (endLine) => `__tb.end(${endLine},${fnSnap});}catch(__e){__tb.exc(__e);throw __e}finally{__tb.exit(__f)}`;

    if (node.body.type === 'BlockStatement') {
      const body = node.body.body;
      let at = node.body.start + 1;
      let i = 0;
      while (i < body.length && body[i].type === 'ExpressionStatement' && body[i].directive) at = body[i++].end;
      insert(at, head);
      visitStatements(body.slice(i), withScope(inner, new Map(), false));
      body.slice(0, i).forEach((d) => visit(d, inner));
      insert(node.body.end - 1, tail(node.body.loc.end.line));
    } else {
      // Arrow function with an expression body: give it a block that returns the expression.
      const expr = node.body;
      insert(expr.start, `{${head}return __tb.r(${lineOf(expr)},${fnSnap},`);
      visit(expr, inner);
      insert(expr.end, `);${tail(expr.loc.end.line)}}`);
    }
  }

  function nameFor(node, parent) {
    if (node.id) return node.id.name;
    if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
    if ((parent?.type === 'Property' || parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition') && parent.key) {
      return parent.key.name || parent.key.value || 'method';
    }
    if (parent?.type === 'AssignmentExpression' && parent.left.type === 'Identifier') return parent.left.name;
    if (parent?.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' && parent.left.property.name) return parent.left.property.name;
    return node.type === 'ArrowFunctionExpression' ? 'arrow fn' : 'anonymous';
  }

  function visit(node, scopes, parent) {
    if (!node || typeof node !== 'object') return;
    switch (node.type) {
      case 'Program': {
        const names = new Map();
        collectVars(node.body, names);
        collectLexical(node.body, names);
        visitStatements(node.body, withScope(scopes, names, true));
        return;
      }
      case 'BlockStatement':
      case 'StaticBlock': {
        const names = new Map();
        collectLexical(node.body, names);
        visitStatements(node.body, withScope(scopes, names, false));
        return;
      }
      case 'SwitchStatement': {
        visit(node.discriminant, scopes);
        const names = new Map();
        node.cases.forEach((c) => collectLexical(c.consequent, names));
        const inner = withScope(scopes, names, false);
        node.cases.forEach((c) => {
          if (c.test) visit(c.test, inner);
          visitStatements(c.consequent, inner);
        });
        return;
      }
      case 'IfStatement':
        visit(node.test, scopes);
        visitBody(node.consequent, scopes, lineOf(node));
        if (node.alternate?.type === 'IfStatement') {
          // `else if`: give it braces so its own step can run before the test.
          insert(node.alternate.start, `{${stepAt(node.alternate, scopes)}`);
          visit(node.alternate, scopes);
          insert(node.alternate.end, '}');
        } else visitBody(node.alternate, scopes, node.alternate && lineOf(node.alternate) === node.consequent.loc.end.line ? lineOf(node.alternate) : lineOf(node));
        return;
      case 'ForStatement': {
        const names = new Map();
        if (node.init?.type === 'VariableDeclaration' && node.init.kind !== 'var') node.init.declarations.forEach((d) => patternNames(d.id, []).forEach((n) => names.set(n, 'let')));
        const inner = withScope(scopes, names, false);
        visit(node.init, inner);
        if (node.test) {
          insert(node.test.start, `(${stepAt(node, inner).slice(0, -1)},(`);
          visit(node.test, inner);
          insert(node.test.end, '))');
        } else {
          // for (init; ; update): put a step where the empty test is.
          const from = node.init ? node.init.end : source.indexOf('(', node.start) + 1;
          const semi = source.indexOf(';', from);
          insert(semi + 1, `${stepAt(node, inner).slice(0, -1)},true`);
        }
        visit(node.update, inner);
        visitBody(node.body, inner, lineOf(node));
        return;
      }
      case 'ForInStatement':
      case 'ForOfStatement': {
        const names = new Map();
        if (node.left.type === 'VariableDeclaration' && node.left.kind !== 'var') node.left.declarations.forEach((d) => patternNames(d.id, []).forEach((n) => names.set(n, 'let')));
        const inner = withScope(scopes, names, false);
        visit(node.right, scopes);
        visitBody(node.body, inner, lineOf(node));
        return;
      }
      case 'WhileStatement':
        insert(node.test.start, `(${stepAt(node, scopes).slice(0, -1)},(`);
        visit(node.test, scopes);
        insert(node.test.end, '))');
        visitBody(node.body, scopes, lineOf(node));
        return;
      case 'DoWhileStatement':
        visitBody(node.body, scopes, lineOf(node));
        insert(node.test.start, `(${stepAt(node.test, scopes).slice(0, -1)},(`);
        visit(node.test, scopes);
        insert(node.test.end, '))');
        return;
      case 'LabeledStatement':
        // No braces around the labelled statement itself: they would break `continue label`.
        visit(node.body, scopes);
        return;
      case 'TryStatement': {
        visit(node.block, scopes);
        if (node.handler) {
          const names = new Map();
          patternNames(node.handler.param, []).forEach((n) => names.set(n, 'var'));
          visit(node.handler.body, withScope(scopes, names, false));
        }
        if (node.finalizer) visit(node.finalizer, scopes);
        return;
      }
      case 'ReturnStatement': {
        const line = lineOf(node);
        if (node.argument) {
          insert(node.argument.start, `__tb.r(${line},${snapOf(scopes)},`);
          visit(node.argument, scopes);
          insert(node.argument.end, ')');
        } else {
          insert(node.start + 'return'.length, ` __tb.r(${line},${snapOf(scopes)},undefined)`);
        }
        return;
      }
      case 'MethodDefinition':
        if (node.value) node.value.__method = true;
        visit(node.key, scopes);
        if (node.value) visitFunction(node.value, scopes, node.kind === 'constructor' ? 'constructor' : node.key.name || 'method');
        return;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        visitFunction(node, scopes, nameFor(node, parent));
        return;
      default:
        for (const key in node) {
          if (key === 'loc' || key === '__method') continue;
          const child = node[key];
          if (Array.isArray(child)) child.forEach((c) => c && typeof c.type === 'string' && visit(c, scopes, node));
          else if (child && typeof child.type === 'string') visit(child, scopes, node);
        }
    }
  }

  visit(ast, []);

  // Apply back to front; for the same position keep the order they were added.
  edits.sort((a, b) => b.pos - a.pos || b.seq - a.seq);
  let out = source;
  for (const e of edits) out = out.slice(0, e.pos) + e.text + out.slice(e.pos);
  return { code: out, usesAsync };
}
