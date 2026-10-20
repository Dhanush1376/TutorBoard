import { createRequire } from 'module';
import Parser from 'web-tree-sitter';

/**
 * tree-sitter parsers for the languages the server instruments. Parsing only
 * reads the learner's source as text — nothing here runs it.
 */
export type SyntaxNode = Parser.SyntaxNode;
export type ParsedLanguage = 'c' | 'cpp' | 'java';

const require = createRequire(import.meta.url);
let ready: Promise<void> | null = null;
const parsers = new Map<ParsedLanguage, Parser>();

async function init() {
  await Parser.init();
  for (const lang of ['c', 'cpp', 'java'] as ParsedLanguage[]) {
    const wasm = require.resolve(`tree-sitter-wasms/out/tree-sitter-${lang}.wasm`);
    const language = await Parser.Language.load(wasm);
    const parser = new Parser();
    parser.setLanguage(language);
    parsers.set(lang, parser);
  }
}

export async function parseSource(lang: ParsedLanguage, source: string) {
  ready = ready || init();
  await ready;
  return parsers.get(lang)!.parse(source);
}

export const lineOf = (n: SyntaxNode) => n.startPosition.row + 1;
export const endLineOf = (n: SyntaxNode) => n.endPosition.row + 1;

export function namedChildren(n: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let i = 0; i < n.namedChildCount; i++) out.push(n.namedChild(i)!);
  return out;
}

/** Children reached through a field (tree-sitter allows a field to repeat, e.g. several declarators). */
export function fieldChildren(n: SyntaxNode, field: string): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  const c = n.walk();
  if (c.gotoFirstChild()) {
    do {
      if (c.currentFieldName === field) out.push(c.currentNode);
    } while (c.gotoNextSibling());
  }
  return out;
}

/** First syntax error in the tree, as a line and a short description. */
export function firstSyntaxError(root: SyntaxNode): { line: number; text: string } | null {
  if (!root.hasError) return null;
  const stack = [root];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.type === 'ERROR' || n.isMissing) return { line: lineOf(n), text: n.isMissing ? `missing ${n.type}` : n.text.slice(0, 40) };
    for (let i = 0; i < n.childCount; i++) stack.push(n.child(i)!);
  }
  return { line: 1, text: '' };
}

/** Text insertions and replacements, applied together at the end. */
export class Edits {
  private list: { start: number; end: number; text: string; seq: number }[] = [];
  private seq = 0;

  insert(pos: number, text: string) {
    this.list.push({ start: pos, end: pos, text, seq: this.seq++ });
  }

  replace(start: number, end: number, text: string) {
    this.list.push({ start, end, text, seq: this.seq++ });
  }

  apply(source: string): string {
    // Back to front; at the same spot, earlier edits end up first.
    const sorted = [...this.list].sort((a, b) => b.start - a.start || b.seq - a.seq);
    let out = source;
    for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    return out;
  }
}
