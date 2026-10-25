// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { wantsWalkthrough, firstRunnableBlock, codeKey } from '../intent';

describe('when a question asks to watch code run', () => {
  it('recognises step-through, tracing and "what happens to the variables" questions', () => {
    for (const q of [
      'Explain this code line by line',
      'Visualize binary search',
      'Show how recursion works',
      'Step through this Python function for me',
      'Debug this program and show me where it fails',
      'What happens to the variables when this loop executes?',
      'Can you trace quicksort on [3, 1, 2]?',
      'Show me how promises and the event loop work in JavaScript',
      'Dry run this:\n```c\nint x = 1;\n```',
    ]) expect(wantsWalkthrough(q), q).toBe(true);
  });

  it('leaves ordinary questions alone', () => {
    for (const q of ['What is polymorphism?', 'Why is the sky blue?', 'Trace the causes of the French Revolution', 'What is a binary heap?', 'Visualize photosynthesis', '']) {
      expect(wantsWalkthrough(q), q).toBe(false);
    }
  });
});

describe('the code to step through', () => {
  it('takes the first block in a runnable language, under any of its names', () => {
    const md = 'Here:\n\n```text\nnot code\n```\n\n```py\nx = 1\nprint(x)\n```\n\n```java\nclass A {}\n```';
    expect(firstRunnableBlock(md)).toEqual({ lang: 'python', code: 'x = 1\nprint(x)' });
    expect(firstRunnableBlock('```c++\nint main(){}\n```').lang).toBe('cpp');
    expect(firstRunnableBlock('```js\nlet a\n```').lang).toBe('javascript');
    expect(firstRunnableBlock('```rust\nfn main(){}\n```')).toBeNull();
    expect(firstRunnableBlock('no code here')).toBeNull();
  });

  it('keys code the same however its line endings and edges look', () => {
    expect(codeKey('x = 1\r\nprint(x)\n')).toBe(codeKey('x = 1\nprint(x)'));
    expect(codeKey('x = 1')).not.toBe(codeKey('x = 2'));
  });
});
