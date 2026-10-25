import { sourceHash } from './traceModel';

/**
 * When a question is better answered by watching the code run. Used when an
 * answer finishes: if the learner asked to step through / trace / see what
 * happens to the variables, and the answer has a program in one of the five
 * runnable languages, its walkthrough is suggested (or opened, if they chose so).
 * A plain "what is polymorphism?" never triggers it.
 */

// Asking to watch the code run.
const RUN_WORDS = /\b(step[- ]?through|step[- ]by[- ]step|line[- ]by[- ]line|trace|tracing|dry[- ]?run|walk (?:me )?through|visuali[sz]e|animate|animation|debug)\b|\bwhat happens (?:to|when|in|at)\b|\bshow (?:me )?(?:how|what happens)\b|\bhow (?:does|do) (?:the )?(?:variables?|values?|pointers?|stack|loop|recursion)\b/i;
// …about code, not, say, a historical event.
const CODE_WORDS = /\b(code|program|function|method|loop|recursion|recursive|algorithm|variables?|pointers?|arrays?|lists?|linked list|stack|queue|tree|\w*sort|sorting|search|binary search|bfs|dfs|dijkstra|fibonacci|factorial|class|object|closure|promise|async|event loop|python|java|javascript|c\+\+|cpp|this)\b|```/i;

export function wantsWalkthrough(question) {
  const text = String(question || '');
  return RUN_WORDS.test(text) && CODE_WORDS.test(text);
}

const LANGS = { js: 'javascript', javascript: 'javascript', mjs: 'javascript', py: 'python', python: 'python', python3: 'python', java: 'java', cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c' };

/** The first fenced block in a language the walkthrough runs: { lang, code }, or null. */
export function firstRunnableBlock(markdown) {
  const re = /```([\w+#-]*)[^\n]*\n([\s\S]*?)```/g;
  for (const m of String(markdown || '').matchAll(re)) {
    const lang = LANGS[m[1].toLowerCase()];
    const code = m[2].replace(/\n$/, '');
    if (lang && code.trim()) return { lang, code };
  }
  return null;
}

/** The same key for a block of code wherever it's seen (the hint and the code block compare these). */
export const codeKey = (code) => sourceHash('', String(code || '').replace(/\r\n/g, '\n').trim());
