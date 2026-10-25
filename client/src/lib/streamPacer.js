/**
 * streamPacer.js — turn bursty streamed text into a steady flow.
 *
 * Providers deliver answers in uneven chunks (a word, then half a sentence,
 * then a pause). Painting each chunk as it lands makes text jump; holding it
 * for a fixed throttle hides the tail of a burst until the next chunk arrives.
 * The pacer instead releases a slice of its backlog every frame — larger when
 * more is waiting — so text flows evenly and any backlog drains in roughly
 * `drainFrames` frames (~0.2 s), never lagging noticeably behind the model.
 */

const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

export function createStreamPacer(emit, { frameMs = 33, drainFrames = 6, minChars = 3 } = {}) {
  let pending = '';
  let timer = null;
  let cancelled = false;
  // Characters per frame. Raised when text arrives so the whole backlog drains
  // linearly in `drainFrames` frames (a fixed fraction per frame would decay
  // geometrically and leave a big chunk trickling out for seconds).
  let rate = minChars;

  const take = (n) => {
    let cut = Math.min(n, pending.length);
    // never split an emoji / astral character across two frames
    if (cut < pending.length && HIGH_SURROGATE.test(pending.slice(0, cut))) cut += 1;
    const out = pending.slice(0, cut);
    pending = pending.slice(cut);
    return out;
  };

  const tick = () => {
    timer = null;
    if (cancelled || !pending) return;
    emit(take(rate));
    if (pending) timer = setTimeout(tick, frameMs);
    else rate = minChars;
  };

  return {
    /** Queue streamed text; it is revealed over the next frames. */
    push(text) {
      if (cancelled || !text) return;
      pending += text;
      rate = Math.max(rate, minChars, Math.ceil(pending.length / drainFrames));
      if (!timer) timer = setTimeout(tick, 0);
    },
    /** Reveal everything still queued, now (stream end, error). */
    flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!cancelled && pending) emit(take(pending.length));
    },
    /** Drop anything queued (Stop): late text must not revive a stopped answer. */
    cancel() {
      cancelled = true;
      pending = '';
      if (timer) { clearTimeout(timer); timer = null; }
    },
    get pending() {
      return pending.length;
    },
  };
}
