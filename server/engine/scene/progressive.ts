/**
 * Progressive scenes: read a scene JSON while the model is still writing it.
 *
 * The planner asks for keys in a fixed order (… entities, layout, beats), so
 * once "beats" has started the header is complete. Each beat object that has
 * closed can be parsed on its own — the client starts animating beat 1 while
 * the model writes beat 2.
 */
import { strictParseJSON } from '../core/utils/jsonUtils.js';
import { parseModelJSON } from './coerce.js';

export type Partial = { header: Record<string, unknown>; beats: unknown[] };

/** Parse without the shared parser's console logging (called many times per stream). */
const quietParse = (t: string): unknown => {
  try { return JSON.parse(t.replace(/,\s*([\]}])/g, '$1')); } catch { return null; }
};

/** Header + every complete beat in a partial scene text, or null if the header isn't complete yet. */
export function readPartialScene(text: string): Partial | null {
  const start = text.indexOf('{');
  const key = text.indexOf('"beats"', start);
  if (start < 0 || key < 0) return null;
  const header = parseModelJSON(`${text.slice(start, key)}"beats": []}`, quietParse) as Record<string, unknown> | null;
  if (!header || typeof header !== 'object') return null;
  const open = text.indexOf('[', key);
  if (open < 0) return { header, beats: [] };

  const beats: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { if (depth === 0) objStart = i; depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const beat = parseModelJSON(text.slice(objStart, i + 1), quietParse);
        if (beat) beats.push(beat);
        objStart = -1;
      }
      continue;
    }
    if (ch === ']' && depth === 0) break; // end of the beats array
  }
  return { header, beats };
}

/** The final text, parsed with the shared (logging) parser. */
export const parseFinal = (text: string) => parseModelJSON(text, strictParseJSON);
