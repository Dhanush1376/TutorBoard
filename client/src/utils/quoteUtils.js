const BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,pre,blockquote,td,th,div';

/** Finds `quote` inside `scope`, ignoring whitespace differences, and returns a Range. */
export function findQuote(scope, quote) {
  if (!scope || !quote) return null;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let text = '';
  const map = [];
  let prevSpace = true;
  let prevBlock = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const block = n.parentElement?.closest(BLOCKS);
    if (prevBlock && block !== prevBlock && !prevSpace) {
      text += ' ';
      map.push(null);
      prevSpace = true;
    }
    prevBlock = block;
    const t = n.nodeValue;
    for (let i = 0; i < t.length; i++) {
      if (/\s/.test(t[i])) {
        if (prevSpace) continue;
        text += ' ';
        prevSpace = true;
      } else {
        text += t[i].toLowerCase();
        prevSpace = false;
      }
      map.push([n, i]);
    }
  }
  const q = quote.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return null;
  const at = text.indexOf(q);
  if (at < 0) return null;
  let s = at;
  while (s < at + q.length && !map[s]) s++;
  let e = at + q.length - 1;
  while (e > s && !map[e]) e--;
  if (!map[s] || !map[e]) return null;
  const range = document.createRange();
  range.setStart(map[s][0], map[s][1]);
  range.setEnd(map[e][0], map[e][1] + 1);
  return range;
}
