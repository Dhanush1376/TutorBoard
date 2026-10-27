// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* The sandbox pages (client/public/sandbox) are the security boundary for code run
   in the browser; keep their policies exactly as strict as intended. */

const page = (name) => readFileSync(path.resolve(__dirname, '../../../public/sandbox', name), 'utf8');
const policy = (html) => html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const relay = (html) => html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\/\/ relay:.*\n/, '');

describe('sandbox pages', () => {
  it('JavaScript gets no network of any kind', () => {
    const p = policy(page('js.html'));
    expect(p).toMatch(/^default-src 'none';/);
    expect(p).not.toMatch(/connect-src|https?:|'self'/);
    expect(p).toMatch(/worker-src blob:/);
  });

  it('Python can reach only the Pyodide CDN', () => {
    const p = policy(page('python.html'));
    expect(p).toMatch(/^default-src 'none';/);
    expect(p).toMatch(/connect-src https:\/\/cdn\.jsdelivr\.net$/);
    expect([...p.matchAll(/https?:\/\/[^\s;]+/g)].map((m) => m[0])).toEqual(['https://cdn.jsdelivr.net', 'https://cdn.jsdelivr.net']);
    expect(p).not.toMatch(/'self'/);
  });

  it('both pages relay the same way, only to and from the page that opened them', () => {
    expect(relay(page('js.html'))).toBe(relay(page('python.html')));
    expect(relay(page('js.html'))).toMatch(/e\.source !== parent \|\| e\.origin !== page/);
  });

  it('the app\'s hosting headers leave the sandbox pages to their own policy', () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../../../../vercel.json'), 'utf8'));
    const rulesFor = (url) => vercel.headers.filter((r) => new RegExp(`^${r.source}$`).test(url));
    const sandboxKeys = rulesFor('/sandbox/js.html').flatMap((r) => r.headers.map((h) => h.key));
    expect(sandboxKeys).not.toContain('Content-Security-Policy'); // the app's policy would forbid the sandbox
    expect(rulesFor('/sandbox/js.html').flatMap((r) => r.headers).find((h) => h.key === 'X-Frame-Options').value).toBe('SAMEORIGIN');
    const app = rulesFor('/session').flatMap((r) => r.headers);
    expect(app.find((h) => h.key === 'X-Frame-Options').value).toBe('DENY');
    expect(app.find((h) => h.key === 'Content-Security-Policy').value).toMatch(/frame-src 'self'/);
  });
});
