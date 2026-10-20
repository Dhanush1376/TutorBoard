// paste into page: enters guest mode, sends one mocked message, then shows a rich sample conversation
(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  await wait(2500);
  if (location.pathname !== '/session') {
    [...document.querySelectorAll('button')].find(b => /Start (learning free|as a guest)/i.test(b.innerText))?.click();
    await wait(6000);
  }
  if (!window.__mockPatched) {
    const orig = window.fetch.bind(window);
    window.fetch = (url, opts = {}) => String(url).includes('/api/chat') ? orig(url, { ...opts, headers: { ...(opts.headers || {}), 'x-e2e-mock-ai': '1' } }) : orig(url, opts);
    window.__mockPatched = true;
  }
  const ta = document.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, 'hello');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(150);
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(3000);
  const answer = `A **binary heap** is a complete binary tree stored in an array, where every parent is ordered relative to its children.

## Key properties

1. **Shape** — every level is full except possibly the last, which fills left to right.
2. **Order** — in a *min-heap* each parent is ≤ its children, so the minimum sits at index \`0\`.

| Operation | Time | Notes |
|---|---|---|
| Insert | O(log n) | sift up from the new leaf |
| Extract min | O(log n) | move last to root, sift down |
| Peek | O(1) | read index 0 |

The height of a heap with $n$ nodes is $\\lfloor \\log_2 n \\rfloor$, which is why both operations are logarithmic:

$$h = \\lfloor \\log_2 n \\rfloor$$

\`\`\`python
def sift_up(heap, i):
    while i > 0:
        parent = (i - 1) // 2
        if heap[i] >= heap[parent]:
            break
        heap[i], heap[parent] = heap[parent], heap[i]
        i = parent
\`\`\`

> Tip: you never need explicit child pointers — children of index \`i\` live at \`2i + 1\` and \`2i + 2\`.

Further reading: https://en.wikipedia.org/wiki/Binary_heap_with_a_very_long_url_segment_that_should_wrap_instead_of_overflowing_the_layout`;
  const now = Date.now();
  const S = window.__tutorStore.getState();
  const sid = S.getSid();
  S.setConversationMessages([
    { id: 'u1', role: 'user', content: 'What is a binary heap, and why are insert and extract both O(log n)?', timestamp: new Date(now - 60000).toISOString() },
    { id: 'a1', role: 'assistant', content: answer, timestamp: new Date(now - 50000).toISOString(), metadata: { latencyMs: 3400 } },
    { id: 'u2', role: 'user', content: 'Explain heapify', timestamp: new Date(now - 20000).toISOString() },
    { id: 'a2', role: 'assistant', status: 'cancelled', content: 'Heapify turns an arbitrary array into a heap by sifting down every internal node, starting from', timestamp: new Date(now - 10000).toISOString() },
  ], sid);
  window.__tutorStore.setState({ lastAIError: { message: 'The connection dropped before the answer finished.', code: 'STREAM_INTERRUPTED', retryable: true, sessionId: sid, retry: { requestId: 'x', text: 'Explain heapify' } } });
  await wait(400);
  document.querySelector('.chat-window')?.scrollTo(0, 0);
  return 'ok';
})();
