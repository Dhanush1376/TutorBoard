import { describe, it, expect } from 'vitest';
import { closeOpenMarkdown } from '../MessageUtils';

describe('closeOpenMarkdown (streaming display only)', () => {
  it('closes a code fence that is still open', () => {
    expect(closeOpenMarkdown('Here:\n```python\ndef f():\n    return 1')).toBe('Here:\n```python\ndef f():\n    return 1\n```');
  });

  it('leaves balanced fences alone', () => {
    const done = 'A\n```js\nx()\n```\nB';
    expect(closeOpenMarkdown(done)).toBe(done);
  });

  it('closes with the same marker that opened (tilde, longer fence)', () => {
    expect(closeOpenMarkdown('~~~\ncode')).toBe('~~~\ncode\n~~~');
    // a ```` fence is only closed by 4+ backticks: the inner ``` lines are content
    expect(closeOpenMarkdown('````md\n```js\nx\n```\nstill open')).toBe('````md\n```js\nx\n```\nstill open\n````');
    // a closing fence must stand alone; "```js" inside an open block doesn't close it
    expect(closeOpenMarkdown('```\na\n```js\nb')).toBe('```\na\n```js\nb\n```');
  });

  it('does not add a newline when the text already ends with one', () => {
    expect(closeOpenMarkdown('```\nx\n')).toBe('```\nx\n```');
  });

  it('closes open display math', () => {
    expect(closeOpenMarkdown('So $$h = \\log n')).toBe('So $$h = \\log n$$');
    expect(closeOpenMarkdown('$$a$$ and $$b')).toBe('$$a$$ and $$b$$');
  });

  it('ignores fences inside prose and empty input', () => {
    expect(closeOpenMarkdown('use ``` to start code')).toBe('use ``` to start code');
    expect(closeOpenMarkdown('')).toBe('');
    expect(closeOpenMarkdown(undefined)).toBe(undefined);
  });
});
