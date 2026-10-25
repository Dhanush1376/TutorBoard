import { useEffect } from 'react';
import useTutorStore from '../store/tutorStore';
import { wantsWalkthrough, firstRunnableBlock, codeKey } from './intent';

// The server gives a finished answer its permanent id moments after the stream ends;
// wait for it, so a walkthrough opened here is saved under the same message as one
// opened from the answer's own Step through button (no duplicate).
const SETTLE_MS = 700;

/**
 * Watches answers as they finish. When the learner asked to step through,
 * trace or see what happens in some code, and the answer contains a program in
 * a runnable language, its Step through button is highlighted — or, with the
 * "Open code walkthroughs automatically" setting on, the walkthrough opens.
 * Only answers that finish while the app is open count, never ones loaded
 * from history.
 */
export default function useWalkthroughSuggestions() {
  useEffect(() => {
    const handled = new Set();
    let timer = null;
    let streaming = useTutorStore.getState().streamingMessageId;

    const check = () => {
      const s = useTutorStore.getState();
      const messages = s.conversationMessages || [];
      const at = messages.map((m) => m.role).lastIndexOf('assistant');
      if (at < 0) return;
      const answer = messages[at];
      if (handled.has(answer.id)) return;
      handled.add(answer.id);
      const question = messages.slice(0, at).reverse().find((m) => m.role === 'user');
      if (!question || !wantsWalkthrough(question.content)) return;
      const block = firstRunnableBlock(answer.content);
      if (!block) return;
      s.setWalkthroughHint?.({ messageId: answer.id, hash: codeKey(block.code) });
      if (s.alertPrefs?.codeWalkthrough === 'auto' && s.activeOverlay !== 'code-editor') {
        s.setCodeEditorData(block.code, block.lang, { sessionId: s.chatSessionId || null, messageId: answer.id, autoVisualize: true });
      }
    };

    const unsubscribe = useTutorStore.subscribe((s) => {
      const now = s.streamingMessageId;
      if (streaming && !now) {
        clearTimeout(timer);
        timer = setTimeout(check, SETTLE_MS);
      }
      streaming = now;
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
}
