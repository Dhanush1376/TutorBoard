import { Edits, SyntaxNode, fieldChildren, lineOf, endLineOf, namedChildren, parseSource } from './syntax.js';
import { C_PRELUDE } from './runtime/cRuntime.js';
import { CPP_PRELUDE } from './runtime/cppRuntime.js';

/**
 * Rewrites a C or C++ program so it reports each step while it runs (see the
 * recorders in ./runtime). Only calls are inserted into the learner's lines —
 * never a line break — and the recorder sits above a `#line 1` directive, so
 * compiler messages still point at the learner's own line numbers.
 *
 *   before each statement   (step: set the line, register the variables in scope, print)
 *   in each loop test       (step, test)
 *   at the top of a function   push a frame (popped automatically on the way out)
 *   return x                   { keep x; print a 'return' step showing x; return x; }
 */

type Dialect = 'c' | 'cpp';

export interface InstrumentOutput {
  code: string;
  notes: string[];
}

// ── C types the recorder understands ───────────────────────────────────────

const K = { I: 1, U: 2, F: 3, B: 4, C: 5, S: 6, CA: 7, P: 8, ST: 9, SP: 10 } as const;
const SIZE_PARAM = /^(n|len|length|size|count|sz|num|N|numElements|arrSize|arr_size|length_)$/;

const KNOWN_TYPEDEFS: Record<string, number> = {
  size_t: K.U, ssize_t: K.I, ptrdiff_t: K.I, intptr_t: K.I, uintptr_t: K.U,
  int8_t: K.I, int16_t: K.I, int32_t: K.I, int64_t: K.I,
  uint8_t: K.U, uint16_t: K.U, uint32_t: K.U, uint64_t: K.U,
  bool: K.B, _Bool: K.B, wchar_t: K.I, time_t: K.I, clock_t: K.I,
};

interface StructInfo { index: number; name: string; cType: string; fields: CVarType[] }
interface CVarType { name: string; kind: number; st: number; ptr: number; dims: (string | null)[]; scalarKind?: number; bitfield?: boolean }
interface ScopeVar { name: string; reg: string; pending: boolean; isArrayParam?: boolean }
interface Scope { vars: ScopeVar[] }
interface FnInfo { name: string; returnsVoid: boolean; retKind: { kind: number; st: number } | null; isMain: boolean; thisReg: string | null }

export async function instrumentCFamily(source: string, dialect: Dialect, limits: { maxSteps: number; maxBytes: number }): Promise<InstrumentOutput> {
  const tree = await parseSource(dialect === 'c' ? 'c' : 'cpp', source);
  const root = tree.rootNode;
  const edits = new Edits();
  const notes = new Set<string>();
  const structs: StructInfo[] = [];
  const structByTag = new Map<string, StructInfo>();
  const typedefs = new Map<string, { kind: number; st: number } | { alias: SyntaxNode }>();
  const globals: string[] = [];
  const classesWithStatic = new Map<string, Set<string>>();
  const knownClasses = new Set<string>();

  const text = (n: SyntaxNode | null | undefined) => (n ? source.slice(n.startIndex, n.endIndex) : '');
  const q = (s: string) => JSON.stringify(s);

  /* ── Declarators ──────────────────────────────────────────────────────── */

  // Peel a declarator down to its name, counting pointers and array sizes on the way.
  function peel(decl: SyntaxNode): { name: string | null; ptr: number; dims: (string | null)[]; ref: boolean; init: SyntaxNode | null; isFunction: boolean } {
    let ptr = 0;
    const dims: (string | null)[] = [];
    let ref = false;
    let init: SyntaxNode | null = null;
    let isFunction = false;
    let n: SyntaxNode | null = decl;
    while (n) {
      switch (n.type) {
        case 'init_declarator':
          init = n.childForFieldName('value');
          n = n.childForFieldName('declarator');
          break;
        case 'pointer_declarator':
          ptr++;
          n = n.childForFieldName('declarator');
          break;
        case 'array_declarator':
          dims.unshift(null);
          dims[0] = text(n.childForFieldName('size')) || null;
          n = n.childForFieldName('declarator');
          break;
        case 'reference_declarator':
          ref = true;
          n = n.namedChild(0);
          break;
        case 'parenthesized_declarator':
          n = n.namedChild(0);
          break;
        case 'function_declarator':
          isFunction = true;
          n = n.childForFieldName('declarator');
          break;
        case 'identifier':
        case 'field_identifier':
        case 'type_identifier': // the new name in a typedef
          return { name: n.text, ptr, dims, ref, init, isFunction };
        default:
          return { name: null, ptr, dims, ref, init, isFunction };
      }
    }
    return { name: null, ptr, dims, ref, init, isFunction };
  }

  // What kind of value a C type node is, before pointers and arrays.
  function baseKind(typeNode: SyntaxNode | null): { kind: number; st: number } | null {
    if (!typeNode) return null;
    const t = typeNode.text.replace(/\s+/g, ' ').trim();
    switch (typeNode.type) {
      case 'primitive_type':
        if (t === 'char') return { kind: K.C, st: -1 };
        if (t === 'bool' || t === '_Bool') return { kind: K.B, st: -1 };
        if (t === 'float' || t === 'double') return { kind: K.F, st: -1 };
        if (t === 'void') return null;
        if (KNOWN_TYPEDEFS[t]) return { kind: KNOWN_TYPEDEFS[t], st: -1 };
        return { kind: K.I, st: -1 };
      case 'sized_type_specifier': {
        if (/double/.test(t)) return { kind: K.F, st: -1 };
        if (/unsigned/.test(t)) return { kind: K.U, st: -1 };
        if (/^(signed )?char$/.test(t)) return { kind: K.I, st: -1 };
        return { kind: K.I, st: -1 };
      }
      case 'enum_specifier':
        return { kind: K.I, st: -1 };
      case 'struct_specifier': {
        const name = typeNode.childForFieldName('name')?.text;
        const body = typeNode.childForFieldName('body');
        if (body) {
          const info = registerStruct(typeNode, name || null, null);
          return info ? { kind: K.ST, st: info.index } : null;
        }
        const info = name ? structByTag.get(name) : undefined;
        return info ? { kind: K.ST, st: info.index } : null;
      }
      case 'type_identifier': {
        if (KNOWN_TYPEDEFS[t]) return { kind: KNOWN_TYPEDEFS[t], st: -1 };
        const td = typedefs.get(t);
        if (td && 'kind' in td) return td;
        return null;
      }
      default:
        return null;
    }
  }

  function classify(typeNode: SyntaxNode | null, p: ReturnType<typeof peel>): CVarType | null {
    if (!p.name) return null;
    const base = baseKind(typeNode);
    const isChar = base?.kind === K.C;
    if (p.ptr > 0) {
      if (p.ptr === 1 && isChar && p.dims.length === 0) return { name: p.name, kind: K.S, st: -1, ptr: 1, dims: [] };
      if (p.ptr === 1 && base?.kind === K.ST && p.dims.length === 0) return { name: p.name, kind: K.SP, st: base.st, ptr: 1, dims: [] };
      return { name: p.name, kind: K.P, st: p.ptr === 1 && base && base.kind < K.S ? base.kind : 0, ptr: p.ptr, dims: p.dims, scalarKind: base?.kind };
    }
    if (!base) return null;
    if (isChar && p.dims.length === 1) return { name: p.name, kind: K.CA, st: -1, ptr: 0, dims: p.dims };
    if (p.dims.length > 2) return null;
    return { name: p.name, kind: base.kind, st: base.st, ptr: 0, dims: p.dims };
  }

  // C: the arguments that register one variable with the recorder.
  function cReg(v: CVarType, fnName: string | null = null, global = false, viaPtr: string | null = null): string {
    const call = global ? '__tb_gv' : '__tb_v';
    const n = v.name;
    if (viaPtr) return `${call}(${q(n)},${v.scalarKind ?? K.I},(const void*)&${n},sizeof(*${n}),(long)(${viaPtr}),0,${v.scalarKind === K.ST ? v.st : -1},1)`;
    if (v.kind === K.CA) return `${call}(${q(n)},${K.CA},(const void*)${n},1,(long)sizeof(${n}),0,-1,0)`;
    if (v.ptr > 0) {
      const sz = v.kind === K.P && v.st > 0 ? `sizeof(*${n})` : '0';
      return `${call}(${q(n)},${v.kind},(const void*)&${n},${sz},0,0,${v.st},0)`;
    }
    if (v.dims.length === 1) return `${call}(${q(n)},${v.kind},(const void*)${n},sizeof(${n}[0]),(long)(sizeof(${n})/sizeof(${n}[0])),0,${v.st},0)`;
    if (v.dims.length === 2) return `${call}(${q(n)},${v.kind},(const void*)${n},sizeof(${n}[0][0]),(long)(sizeof(${n})/sizeof(${n}[0])),(long)(sizeof(${n}[0])/sizeof(${n}[0][0])),${v.st},0)`;
    void fnName;
    return `${call}(${q(n)},${v.kind},(const void*)&${n},sizeof(${n}),0,0,${v.st},0)`;
  }

  /* ── Structs (C) and classes (C++) ────────────────────────────────────── */

  function registerStruct(spec: SyntaxNode, tag: string | null, typedefName: string | null): StructInfo | null {
    const body = spec.childForFieldName('body');
    if (!body) return null;
    const existing = [...structs].find((s) => s.cType === (tag ? `struct ${tag}` : typedefName));
    if (existing) return existing;
    if (!tag && !typedefName) return null;
    const info: StructInfo = { index: structs.length, name: tag || typedefName!, cType: tag ? `struct ${tag}` : typedefName!, fields: [] };
    structs.push(info);
    if (tag) structByTag.set(tag, info);
    for (const fd of namedChildren(body)) {
      if (fd.type !== 'field_declaration') continue;
      const typeNode = fd.childForFieldName('type');
      for (const d of fieldChildren(fd, 'declarator')) {
        const p = peel(d);
        if (p.isFunction) continue;
        const v = classify(typeNode, p);
        if (!v) continue;
        if (namedChildren(fd).some((c) => c.type === 'bitfield_clause')) continue; // a bitfield has no address
        info.fields.push(v);
      }
    }
    return info;
  }

  // C++: a static member that lists the fields, added at the end of the class body.
  function cppClassPrinter(spec: SyntaxNode) {
    const name = spec.childForFieldName('name');
    const body = spec.childForFieldName('body');
    if (!name || !body || name.type !== 'type_identifier') return;
    knownClasses.add(name.text);
    const fields: string[] = [];
    const statics = new Set<string>();
    for (const fd of namedChildren(body)) {
      if (fd.type === 'field_declaration' || fd.type === 'declaration') {
        const isStatic = namedChildren(fd).some((c) => c.type === 'storage_class_specifier' && c.text === 'static');
        for (const d of fieldChildren(fd, 'declarator')) {
          const p = peel(d);
          if (p.isFunction) {
            if (isStatic && p.name) statics.add(p.name);
            continue;
          }
          if (!p.name || isStatic || p.ref) continue;
          if (namedChildren(fd).some((c) => c.type === 'bitfield_clause')) continue;
          fields.push(p.name);
        }
      }
      if (fd.type === 'function_definition') {
        const isStatic = namedChildren(fd).some((c) => c.type === 'storage_class_specifier' && c.text === 'static');
        const p = peel(fd.childForFieldName('declarator')!);
        if (isStatic && p.name) statics.add(p.name);
      }
    }
    classesWithStatic.set(name.text, statics);
    const list = fields.map((f, i) => `::__tb::tbField(o,${i},${q(f)},x.${f},c);`).join('');
    edits.insert(body.endIndex - 1, `public: static const char* __tb_name(){return ${q(name.text)};} static void __tb_put(std::string& o,const ${name.text}& x,::__tb::Ctx& c){(void)x;(void)c;(void)o;${list}}`);
  }

  /* ── Steps ────────────────────────────────────────────────────────────── */

  const visible = (scopes: Scope[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = scopes.length - 1; i >= 0; i--) {
      for (let j = scopes[i].vars.length - 1; j >= 0; j--) {
        const v = scopes[i].vars[j];
        if (seen.has(v.name)) continue;
        seen.add(v.name);
        if (!v.pending) out.unshift(v.reg);
      }
    }
    return out;
  };

  const EV = { line: 0, call: 1, return: 2 };
  function stepExpr(line: number, scopes: Scope[], ev: keyof typeof EV, fn: FnInfo | null, retReg = ''): string {
    const regs = visible(scopes);
    if (fn?.thisReg) regs.unshift(fn.thisReg);
    if (dialect === 'c') return `(__tb_b(${line}),${[...regs, retReg].filter(Boolean).map((r) => `${r},`).join('')}__tb_e(${EV[ev]}))`;
    return `(__tb::tbLine(${line}),${[...regs, retReg].filter(Boolean).map((r) => `${r},`).join('')}__tb::tbEv(${EV[ev]}))`;
  }

  function findVar(scopes: Scope[], name: string): ScopeVar | null {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const v = scopes[i].vars.find((x) => x.name === name);
      if (v) return v;
    }
    return null;
  }

  // After `x = …;`, `scanf("%d", &x);` or `cin >> x;`, a variable declared without a value has one.
  function markAssigned(stmt: SyntaxNode, scopes: Scope[]) {
    const names: string[] = [];
    const visit = (n: SyntaxNode) => {
      if (n.type === 'assignment_expression') {
        const left = n.childForFieldName('left');
        if (left?.type === 'identifier') names.push(left.text);
      }
      if (n.type === 'call_expression' && /^(scanf|fscanf|sscanf|scanf_s)$/.test(n.childForFieldName('function')?.text || '')) {
        for (const a of namedChildren(n.childForFieldName('arguments')!)) if (a.type === 'pointer_expression' && a.namedChild(0)?.type === 'identifier') names.push(a.namedChild(0)!.text);
      }
      if (n.type === 'binary_expression' && /^(std::)?cin\b/.test(n.text) && n.text.includes('>>')) {
        const ids = n.text.split('>>').slice(1).map((s) => s.trim());
        ids.forEach((id) => /^[A-Za-z_]\w*$/.test(id) && names.push(id));
      }
      if (n.type === 'lambda_expression') return;
      for (const c of namedChildren(n)) visit(c);
    };
    visit(stmt);
    for (const name of names) {
      const v = findVar(scopes, name);
      if (v) v.pending = false;
    }
  }

  function declare(decl: SyntaxNode, scope: Scope, fn: FnInfo | null) {
    const typeNode = decl.childForFieldName('type');
    for (const d of fieldChildren(decl, 'declarator')) {
      const p = peel(d);
      if (!p.name || p.isFunction || p.name.startsWith('__tb')) continue;
      const hasInit = !!p.init || d.type === 'init_declarator';
      if (dialect === 'c') {
        const v = classify(typeNode, p);
        if (!v) {
          notes.add(`Some variables can't be shown (for example ${p.name}): the step-through reads numbers, characters, strings, arrays, pointers and structs.`);
          continue;
        }
        const scalarLike = v.ptr > 0 || (v.dims.length === 0 && v.kind !== K.ST);
        scope.vars.push({ name: p.name, reg: cReg(v, fn?.name), pending: !hasInit && scalarLike });
      } else {
        const primitive = !typeNode || ['primitive_type', 'sized_type_specifier'].includes(typeNode.type) || (typeNode.type === 'type_identifier' && (!!KNOWN_TYPEDEFS[typeNode.text] || typedefs.has(typeNode.text)));
        const scalarLike = p.ptr > 0 || (primitive && p.dims.length === 0);
        const auto = typeNode?.type === 'placeholder_type_specifier';
        if (p.ref && !hasInit) continue;
        scope.vars.push({ name: p.name, reg: `::__tb::tbVar(${q(p.name)},${p.name})`, pending: !hasInit && scalarLike && !auto });
      }
    }
  }

  // Wrap a loop or if body that isn't a { block } so its step has somewhere to go.
  function visitBody(body: SyntaxNode | null, scopes: Scope[], fn: FnInfo, parentLine: number) {
    if (!body) return;
    if (body.type === 'compound_statement') return visitBlock(body, scopes, fn);
    if (body.type === ';' || body.type === 'expression_statement' && body.text.trim() === ';') return;
    if (lineOf(body) === parentLine) return visitStatement(body, scopes, fn);
    const inner = [...scopes, { vars: [] }];
    edits.insert(body.startIndex, `{${stepExpr(lineOf(body), inner, 'line', fn)};`);
    visitStatement(body, inner, fn);
    edits.insert(body.endIndex, '}');
  }

  function visitBlock(block: SyntaxNode, scopes: Scope[], fn: FnInfo, scope: Scope = { vars: [] }) {
    const inner = [...scopes, scope];
    for (const st of namedChildren(block)) visitListed(st, inner, scope, fn);
  }

  const NO_STEP = new Set(['comment', 'for_statement', 'while_statement', 'labeled_statement', 'case_statement', 'function_definition', 'type_definition', 'struct_specifier', 'class_specifier', 'enum_specifier', 'preproc_call', 'preproc_def', 'preproc_ifdef', 'preproc_if', 'preproc_include', 'using_declaration', 'alias_declaration', 'namespace_alias_definition', 'template_declaration', 'static_assert_declaration']);

  // A statement directly inside a block: give it a step, then look inside it.
  function visitListed(st: SyntaxNode, scopes: Scope[], scope: Scope, fn: FnInfo) {
    if (st.type === 'comment' || st.type.startsWith('preproc')) return;
    if (st.type === 'declaration' && /^\s*(typedef|static_assert|using)\b/.test(st.text)) return;
    const isWhileWithDecl = st.type === 'while_statement' && st.childForFieldName('condition')?.childForFieldName('declaration');
    if (!NO_STEP.has(st.type) || isWhileWithDecl) edits.insert(st.startIndex, `${stepExpr(lineOf(st), scopes, 'line', fn)};`);
    visitStatement(st, scopes, fn);
    if (st.type === 'declaration') declare(st, scope, fn);
    else if (st.type === 'expression_statement') markAssigned(st, scopes);
  }

  // The expression inside `( … )` of an if/while/do, or null when it declares something.
  function conditionExpr(cond: SyntaxNode | null): SyntaxNode | null {
    if (!cond) return null;
    if (cond.type === 'parenthesized_expression') return cond.namedChild(0);
    if (cond.type === 'condition_clause') {
      if (cond.childForFieldName('declaration') || cond.childForFieldName('initializer')) return null;
      return cond.childForFieldName('value');
    }
    return cond;
  }

  function wrapTest(expr: SyntaxNode, line: number, scopes: Scope[], fn: FnInfo) {
    edits.insert(expr.startIndex, `(${stepExpr(line, scopes, 'line', fn)},(`);
    edits.insert(expr.endIndex, '))');
  }

  function visitStatement(st: SyntaxNode, scopes: Scope[], fn: FnInfo) {
    switch (st.type) {
      case 'compound_statement':
        return visitBlock(st, scopes, fn);
      case 'if_statement': {
        const cons = st.childForFieldName('consequence');
        visitBody(cons, scopes, fn, lineOf(st));
        const alt = st.childForFieldName('alternative');
        const altStmt = alt?.type === 'else_clause' ? alt.namedChild(0) : alt;
        if (altStmt?.type === 'if_statement') {
          // `else if`: braces, so the inner if gets its own step before its test.
          edits.insert(altStmt.startIndex, `{${stepExpr(lineOf(altStmt), scopes, 'line', fn)};`);
          visitStatement(altStmt, scopes, fn);
          edits.insert(altStmt.endIndex, '}');
        } else if (altStmt) visitBody(altStmt, scopes, fn, cons && altStmt && lineOf(altStmt) === endLineOf(cons) ? lineOf(altStmt) : lineOf(st));
        return;
      }
      case 'for_statement': {
        const scope: Scope = { vars: [] };
        const inner = [...scopes, scope];
        const init = st.childForFieldName('initializer');
        if (init?.type === 'declaration') declare(init, scope, fn);
        else if (init) markAssigned(init, scopes);
        const cond = st.childForFieldName('condition');
        if (cond) wrapTest(cond, lineOf(st), inner, fn);
        else {
          // for (init; ; update): a step where the empty test is.
          const from = init ? (init.type === 'declaration' ? init.endIndex : source.indexOf(';', init.endIndex) + 1) : source.indexOf(';', source.indexOf('(', st.startIndex)) + 1;
          edits.insert(from, `${stepExpr(lineOf(st), inner, 'line', fn)},1`);
        }
        visitBody(st.childForFieldName('body'), inner, fn, lineOf(st));
        return;
      }
      case 'for_range_loop': {
        const scope: Scope = { vars: [] };
        const p = peel(st.childForFieldName('declarator')!);
        if (p.name) scope.vars.push({ name: p.name, reg: `::__tb::tbVar(${q(p.name)},${p.name})`, pending: false });
        visitBody(st.childForFieldName('body'), [...scopes, scope], fn, lineOf(st));
        return;
      }
      case 'while_statement': {
        const expr = conditionExpr(st.childForFieldName('condition'));
        if (expr) wrapTest(expr, lineOf(st), scopes, fn);
        visitBody(st.childForFieldName('body'), scopes, fn, lineOf(st));
        return;
      }
      case 'do_statement': {
        visitBody(st.childForFieldName('body'), scopes, fn, lineOf(st));
        const cond = st.childForFieldName('condition');
        const expr = conditionExpr(cond);
        if (expr && cond) wrapTest(expr, lineOf(cond), scopes, fn);
        return;
      }
      case 'switch_statement': {
        const body = st.childForFieldName('body');
        if (!body) return;
        const scope: Scope = { vars: [] };
        const inner = [...scopes, scope];
        for (const c of namedChildren(body)) {
          if (c.type !== 'case_statement') {
            visitListed(c, inner, scope, fn);
            continue;
          }
          const value = c.childForFieldName('value');
          for (const s of namedChildren(c)) if (!value || s.id !== value.id) visitListed(s, inner, scope, fn);
        }
        return;
      }
      case 'labeled_statement': {
        // The step goes after the label, so a `goto` to it still lands on a step.
        const inner = namedChildren(st).find((c) => c.type !== 'statement_identifier');
        if (!inner) return;
        if (!NO_STEP.has(inner.type)) edits.insert(inner.startIndex, `${stepExpr(lineOf(inner), scopes, 'line', fn)};`);
        visitStatement(inner, scopes, fn);
        return;
      }
      case 'try_statement': {
        const body = st.childForFieldName('body');
        if (body) visitBlock(body, scopes, fn);
        for (const c of namedChildren(st)) {
          if (c.type !== 'catch_clause') continue;
          const scope: Scope = { vars: [] };
          const params = c.childForFieldName('parameters');
          const pd = params && namedChildren(params).find((x) => x.type === 'parameter_declaration');
          const p = pd?.childForFieldName('declarator') ? peel(pd.childForFieldName('declarator')!) : null;
          if (p?.name) scope.vars.push({ name: p.name, reg: `::__tb::tbVar(${q(p.name)},${p.name})`, pending: false });
          const b = c.childForFieldName('body');
          if (b) visitBlock(b, [...scopes, scope], fn);
        }
        return;
      }
      case 'return_statement':
        return visitReturn(st, scopes, fn);
      default:
        return; // expressions, declarations, break/continue/goto: nothing inside to instrument
    }
  }

  function visitReturn(st: SyntaxNode, scopes: Scope[], fn: FnInfo) {
    const expr = namedChildren(st).find((c) => c.type !== 'comment') || null;
    const line = lineOf(st);
    if (!expr || fn.returnsVoid || expr.type === 'initializer_list') {
      edits.insert(st.startIndex, `{${stepExpr(line, scopes, 'return', fn)};`);
      edits.insert(st.endIndex, '}');
      return;
    }
    const e = text(expr);
    if (dialect === 'c') {
      const decl = expr.type === 'string_literal' || expr.type === 'concatenated_string' ? 'const char* __tb_r' : `__typeof__(${e}) __tb_r`;
      const rk = fn.retKind;
      const retReg = rk ? `__tb_ret(${rk.kind},(const void*)&__tb_r,sizeof(__tb_r),${rk.st})` : '';
      edits.replace(st.startIndex, st.endIndex, `{${decl}=(${e});${stepExpr(line, scopes, 'return', fn, retReg)};return __tb_r;}`);
    } else {
      edits.replace(st.startIndex, st.endIndex, `{auto&& __tb_r=(${e});${stepExpr(line, scopes, 'return', fn, '::__tb::tbRet(__tb_r)')};return static_cast<decltype(__tb_r)>(__tb_r);}`);
    }
  }

  /* ── Functions ────────────────────────────────────────────────────────── */

  function functionName(declarator: SyntaxNode): { name: string; qualifier: string | null } {
    let n: SyntaxNode | null = declarator;
    while (n && n.type !== 'function_declarator') n = n.childForFieldName('declarator') || n.namedChild(0);
    const id = n?.childForFieldName('declarator');
    if (!id) return { name: 'function', qualifier: null };
    if (id.type === 'qualified_identifier') {
      const scope = id.childForFieldName('scope')?.text || null;
      return { name: id.text.replace(/\s+/g, ''), qualifier: scope };
    }
    return { name: id.text, qualifier: null };
  }

  function visitFunction(def: SyntaxNode, owner: string | null) {
    const body = def.childForFieldName('body');
    const declarator = def.childForFieldName('declarator');
    if (!body || body.type !== 'compound_statement' || !declarator) return;
    // A constexpr function can't hold the recorder's frame object; leave it as it is.
    if (/\b(constexpr|consteval)\b/.test(source.slice(def.startIndex, body.startIndex))) {
      notes.add('constexpr functions run without steps.');
      return;
    }
    const { name, qualifier } = functionName(declarator);
    const typeNode = def.childForFieldName('type');
    const p = peel(declarator);
    const returnsVoid = !typeNode ? true : typeNode.text === 'void' && p.ptr === 0;
    const isMain = name === 'main';
    let retKind: FnInfo['retKind'] = null;
    if (dialect === 'c' && !returnsVoid) {
      const base = baseKind(typeNode);
      if (p.ptr === 1 && base?.kind === K.C) retKind = { kind: K.S, st: -1 };
      else if (p.ptr === 1 && base?.kind === K.ST) retKind = { kind: K.SP, st: base.st };
      else if (p.ptr > 0) retKind = { kind: K.P, st: 0 };
      else if (base) retKind = base;
    }

    // Is this a member function that has a `this`?
    let thisReg: string | null = null;
    const cls = owner || (qualifier && knownClasses.has(qualifier) ? qualifier : null);
    if (dialect === 'cpp' && cls) {
      const isStatic = namedChildren(def).some((c) => c.type === 'storage_class_specifier' && c.text === 'static') || classesWithStatic.get(cls)?.has(name.split('::').pop() || '');
      if (!isStatic) thisReg = '::__tb::tbVar("this",*this)';
    }
    const fn: FnInfo = { name, returnsVoid, retKind, isMain, thisReg };

    // Parameters are the function's first scope.
    const scope: Scope = { vars: [] };
    let fdecl: SyntaxNode | null = declarator;
    while (fdecl && fdecl.type !== 'function_declarator') fdecl = fdecl.childForFieldName('declarator') || fdecl.namedChild(0);
    const params = fdecl?.childForFieldName('parameters');
    const paramList = params ? namedChildren(params).filter((x) => x.type === 'parameter_declaration' || x.type === 'optional_parameter_declaration') : [];
    const sizeParam = paramList.map((x) => (x.childForFieldName('declarator') ? peel(x.childForFieldName('declarator')!).name : null)).find((n) => n && SIZE_PARAM.test(n)) || null;
    for (const pd of paramList) {
      const d = pd.childForFieldName('declarator');
      if (!d) continue;
      const pp = peel(d);
      if (!pp.name) continue;
      const looksLikeArray = (pp.dims.length === 1 && pp.ptr === 0) || (pp.ptr === 1 && pp.dims.length === 0);
      if (dialect === 'c' && pp.dims.length === 2 && pp.ptr === 0) {
        // int grid[][COLS]: a pointer to rows; shown as rows when there's a size parameter.
        const base = baseKind(pd.childForFieldName('type'));
        if (base && sizeParam && pp.dims[1]) scope.vars.push({ name: pp.name, reg: `__tb_v(${q(pp.name)},${base.kind},(const void*)&${pp.name},sizeof(${pp.name}[0][0]),(long)(${sizeParam}),(long)(${pp.dims[1]}),${base.st},1)`, pending: false, isArrayParam: true });
        continue;
      }
      if (dialect === 'c') {
        const v = classify(pd.childForFieldName('type'), { ...pp, dims: pp.dims.length === 1 && pp.ptr === 0 ? [] : pp.dims, ptr: pp.dims.length === 1 && pp.ptr === 0 ? 1 : pp.ptr });
        if (!v) continue;
        const base = baseKind(pd.childForFieldName('type'));
        if (looksLikeArray && sizeParam && base && base.kind !== K.C) {
          v.scalarKind = base.kind;
          v.st = base.st;
          scope.vars.push({ name: pp.name, reg: cReg({ ...v, scalarKind: base.kind }, name, false, sizeParam), pending: false, isArrayParam: true });
        } else scope.vars.push({ name: pp.name, reg: cReg(v, name), pending: false });
      } else {
        const tn = pd.childForFieldName('type');
        const isCharish = /\bchar\b/.test(tn?.text || '');
        if ((looksLikeArray || (pp.dims.length >= 2 && pp.ptr === 0)) && sizeParam && !isCharish && !pp.ref) scope.vars.push({ name: pp.name, reg: `::__tb::tbArr(${q(pp.name)},${pp.name},(long)(${sizeParam}))`, pending: false, isArrayParam: true });
        else scope.vars.push({ name: pp.name, reg: `::__tb::tbVar(${q(pp.name)},${pp.name})`, pending: false });
      }
    }

    const scopes = [scope];
    const line = lineOf(def);
    const label = owner && !name.includes('::') ? `${owner}::${name}` : name;
    const frame = dialect === 'c'
      ? `int __tb_fr __attribute__((cleanup(__tb_leave)))=__tb_enter(${q(label)},${line});(void)__tb_fr;`
      : `::__tb::TbFrame __tb_fr(${q(label)},${line});`;
    edits.insert(body.startIndex + 1, `${frame}${stepExpr(line, scopes, 'call', fn)};`);
    const bodyScope: Scope = { vars: [] };
    visitBlock(body, scopes, fn, bodyScope);
    if (returnsVoid || isMain) edits.insert(body.endIndex - 1, `${stepExpr(endLineOf(body), [...scopes, bodyScope], 'return', fn)};`);
  }

  /* ── Top level ────────────────────────────────────────────────────────── */

  function visitTop(n: SyntaxNode, owner: string | null, inNamespace: boolean) {
    for (const c of namedChildren(n)) {
      switch (c.type) {
        case 'function_definition':
          visitFunction(c, owner);
          break;
        case 'template_declaration':
          visitTop(c, owner, inNamespace);
          break;
        case 'linkage_specification': {
          const b = c.childForFieldName('body');
          if (b) visitTop(b.type === 'declaration_list' ? b : c, owner, inNamespace);
          break;
        }
        case 'namespace_definition': {
          const b = c.childForFieldName('body');
          if (b) visitTop(b, null, true);
          break;
        }
        case 'struct_specifier':
        case 'class_specifier':
        case 'union_specifier':
          topType(c, owner, inNamespace);
          break;
        case 'type_definition': {
          const t = c.childForFieldName('type');
          const names = fieldChildren(c, 'declarator').map((d) => peel(d)).filter((p) => p.name && p.ptr === 0 && p.dims.length === 0);
          if (t?.type === 'struct_specifier' && dialect === 'c') {
            const tag = t.childForFieldName('name')?.text || null;
            const info = t.childForFieldName('body') ? registerStruct(t, tag, tag ? null : names[0]?.name || null) : tag ? structByTag.get(tag) : null;
            names.forEach((p) => info && typedefs.set(p.name!, { kind: K.ST, st: info.index }));
          } else if (t?.type === 'struct_specifier' || t?.type === 'class_specifier') {
            topType(t, owner, inNamespace);
          } else {
            const base = baseKind(t);
            names.forEach((p) => base && typedefs.set(p.name!, base));
          }
          break;
        }
        case 'declaration': {
          const t = c.childForFieldName('type');
          if (t && ['struct_specifier', 'class_specifier'].includes(t.type) && t.childForFieldName('body')) topType(t, owner, inNamespace);
          if (owner || inNamespace || /^\s*(extern|typedef)\b/.test(c.text)) break;
          for (const d of fieldChildren(c, 'declarator')) {
            const p = peel(d);
            if (!p.name || p.isFunction) continue;
            if (dialect === 'c') {
              const v = classify(t, p);
              if (v) globals.push(cReg(v, null, true));
            } else globals.push(`::__tb::tbGlobal(${q(p.name)},::${p.name})`);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  function topType(spec: SyntaxNode, owner: string | null, inNamespace: boolean) {
    const body = spec.childForFieldName('body');
    if (!body) return;
    if (dialect === 'c') {
      const tag = spec.childForFieldName('name')?.text || null;
      if (tag) registerStruct(spec, tag, null);
      return;
    }
    if (spec.type !== 'union_specifier') cppClassPrinter(spec);
    const name = spec.childForFieldName('name')?.text || owner;
    // Member functions defined inside the class body.
    for (const m of namedChildren(body)) {
      if (m.type === 'function_definition') visitFunction(m, name);
      else if (m.type === 'template_declaration') visitTop(m, name, inNamespace);
      else if (['struct_specifier', 'class_specifier'].includes(m.type)) topType(m, name, inNamespace);
      else if (m.type === 'field_declaration') {
        const t = m.childForFieldName('type');
        if (t && ['struct_specifier', 'class_specifier'].includes(t.type)) topType(t, name, inNamespace);
      }
    }
  }

  visitTop(root, null, false);

  /* ── Assemble ─────────────────────────────────────────────────────────── */

  let instrumented = edits.apply(source);
  const head = `#define TB_MAX_STEPS ${limits.maxSteps}\n#define TB_MAX_BYTES ${limits.maxBytes}L\n`;
  if (dialect === 'c') {
    const printers = structs.map((s) => {
      const fields = s.fields.map((f, i) => {
        const a = `x->${f.name}`;
        if (f.kind === K.CA) return `__tb_field(${i},${q(f.name)},${K.CA},(const void*)${a},1,(long)sizeof(${a}),0,-1,d);`;
        if (f.ptr > 0) return `__tb_field(${i},${q(f.name)},${f.kind},(const void*)&${a},${f.kind === K.P && f.st > 0 ? `sizeof(*${a})` : '0'},0,0,${f.st},d);`;
        if (f.dims.length === 1) return `__tb_field(${i},${q(f.name)},${f.kind},(const void*)${a},sizeof(${a}[0]),(long)(sizeof(${a})/sizeof(${a}[0])),0,${f.st},d);`;
        if (f.dims.length === 2) return `__tb_field(${i},${q(f.name)},${f.kind},(const void*)${a},sizeof(${a}[0][0]),(long)(sizeof(${a})/sizeof(${a}[0])),(long)(sizeof(${a}[0])/sizeof(${a}[0][0])),${f.st},d);`;
        return `__tb_field(${i},${q(f.name)},${f.kind},(const void*)&${a},sizeof(${a}),0,0,${f.st},d);`;
      });
      return `static void __tb_sp_${s.index}(const void *p, int d) { const ${s.cType} *x = (const ${s.cType} *)p; (void)x; (void)d; ${fields.join(' ')} }`;
    });
    const tail = [
      '',
      '/* ---- TutorBoard step recorder: struct printers and globals ---- */',
      ...printers,
      `static void __tb_put_struct(int st, const void *p, int d) { switch (st) { ${structs.map((s) => `case ${s.index}: __tb_sp_${s.index}(p, d); break;`).join(' ')} default: break; } }`,
      `static const char *__tb_struct_name(int st) { switch (st) { ${structs.map((s) => `case ${s.index}: return ${q(s.name)};`).join(' ')} default: return "struct"; } }`,
      `static int __tb_struct_size(int st) { switch (st) { ${structs.map((s) => `case ${s.index}: return (int)sizeof(${s.cType});`).join(' ')} default: return 1; } }`,
      `static void __tb_globals(void) { ${globals.map((g) => `${g};`).join(' ')} }`,
      '',
    ].join('\n');
    instrumented = `${head}${C_PRELUDE}#line 1 "main.c"\n${instrumented}\n${tail}`;
  } else {
    const tail = `\n/* ---- TutorBoard step recorder: globals ---- */\ninline void __tb::globals() { ${globals.map((g) => `${g};`).join(' ')} }\n`;
    instrumented = `${head}${CPP_PRELUDE}#line 1 "main.cpp"\n${instrumented}\n${tail}`;
  }
  return { code: instrumented, notes: [...notes] };
}
