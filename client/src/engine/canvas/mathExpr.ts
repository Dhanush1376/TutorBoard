/**
 * mathExpr.ts — tiny, safe evaluator for plot expressions in x.
 *
 * Supports numbers, x, + - * / ^, parentheses, unary minus, implicit
 * multiplication (4x, 2(x+1), (x-1)(x-3)), constants pi/e and
 * sin cos tan exp log ln sqrt abs. No eval/new Function: model output is
 * untrusted text.
 */

type Tok = { t: 'num'; v: number } | { t: 'x' } | { t: 'op'; v: string } | { t: 'fn'; v: string } | { t: '(' } | { t: ')' };

const FNS: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp,
  log: Math.log10, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs,
};
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4, 'neg': 3 };

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, '').replace(/[·×]/g, '*').replace(/−/g, '-').replace(/\*\*/g, '^').replace(/²/g, '^2').replace(/³/g, '^3');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
    } else if (/[a-z]/i.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-z]/i.test(s[j])) j++;
      const word = s.slice(i, j).toLowerCase();
      if (FNS[word]) out.push({ t: 'fn', v: word });
      else if (word === 'pi') out.push({ t: 'num', v: Math.PI });
      else if (word === 'e') out.push({ t: 'num', v: Math.E });
      else if (word === 'x') out.push({ t: 'x' });
      else throw new Error(`unknown symbol ${word}`);
      i = j;
    } else if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else if (c === '(') { out.push({ t: '(' }); i++; }
    else if (c === ')') { out.push({ t: ')' }); i++; }
    else throw new Error(`unexpected ${c}`);
  }
  // implicit multiplication: 4x, 2(, )(, )x, x(, x2
  const res: Tok[] = [];
  for (const tok of out) {
    const prev = res[res.length - 1];
    const prevEndsValue = prev && (prev.t === 'num' || prev.t === 'x' || prev.t === ')');
    const startsValue = tok.t === 'num' || tok.t === 'x' || tok.t === '(' || tok.t === 'fn';
    if (prevEndsValue && startsValue) res.push({ t: 'op', v: '*' });
    res.push(tok);
  }
  return res;
}

/** Compile to a function of x; throws on malformed input. */
export function compileExpr(src: string): (x: number) => number {
  const body = String(src).split('=').pop() || ''; // accept "y = ..." / "f(x) = ..."
  const toks = tokenize(body);
  const rpn: Tok[] = [];
  const stack: Tok[] = [];
  let prevValue = false;
  for (const tok of toks) {
    if (tok.t === 'num' || tok.t === 'x') { rpn.push(tok); prevValue = true; }
    else if (tok.t === 'fn') { stack.push(tok); prevValue = false; }
    else if (tok.t === '(') { stack.push(tok); prevValue = false; }
    else if (tok.t === ')') {
      while (stack.length && stack[stack.length - 1].t !== '(') rpn.push(stack.pop()!);
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === 'fn') rpn.push(stack.pop()!);
      prevValue = true;
    } else {
      const op = tok.v === '-' && !prevValue ? 'neg' : tok.v;
      if (op === '+' && !prevValue) continue; // unary plus
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t !== 'op') break;
        const pTop = PREC[top.v];
        const pCur = PREC[op];
        if (pTop > pCur || (pTop === pCur && op !== '^' && op !== 'neg')) rpn.push(stack.pop()!);
        else break;
      }
      stack.push({ t: 'op', v: op });
      prevValue = false;
    }
  }
  while (stack.length) rpn.push(stack.pop()!);

  return (x: number) => {
    const st: number[] = [];
    for (const tok of rpn) {
      if (tok.t === 'num') st.push(tok.v);
      else if (tok.t === 'x') st.push(x);
      else if (tok.t === 'fn') st.push(FNS[tok.v](st.pop()!));
      else if (tok.t === 'op') {
        if (tok.v === 'neg') { st.push(-st.pop()!); continue; }
        const b = st.pop()!;
        const a = st.pop()!;
        st.push(tok.v === '+' ? a + b : tok.v === '-' ? a - b : tok.v === '*' ? a * b : tok.v === '/' ? a / b : Math.pow(a, b));
      }
    }
    return st.length === 1 ? st[0] : NaN;
  };
}
