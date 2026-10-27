/**
 * The canvas side of a chat request, driven by the real stream events:
 *  - "a visual is planned" opens and clears nothing (no blank canvas posing as a lesson)
 *  - a lesson starts only on content, exactly once, while more steps stream in
 *  - a failed / stopped visual is shown as such on the card, never as ready
 *  - progress events from an older stream or another request are dropped
 *  - Replay goes back to the first step of the same lesson
 *  - a saved position is never replaced by an older one
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('zustand/middleware', () => ({ persist: (config) => config, createJSONStorage: vi.fn() }));

import useTutorStore from '../../tutorStore';

const initialState = useTutorStore.getState();
const S = () => useTutorStore.getState();
const ev = (e) => S().handleProgressiveStreamEvent(e);

const lesson = (n, partial, title = 'Circle area') => ({
  type: 'scene_v2',
  partial,
  timeline: {
    title, domain: 'math', renderer: 'scene-v2',
    sceneV2: { beats: Array.from({ length: n }, (_, i) => ({ id: `b${i}` })) },
    steps: Array.from({ length: n }, (_, i) => ({ title: `Step ${i + 1}` })),
  },
});

beforeEach(() => {
  useTutorStore.setState(initialState, true);
  useTutorStore.setState({
    conversationSessions: {}, activeConversationSessionId: 'chat-a', conversationMessages: [],
    isStreaming: false, streamingContent: '', streamingMessageId: null, streamingSessionId: null,
    isWaitingForAI: false, waitingSessionId: null, lastAIError: null, sessionStates: {},
    chatSessionId: 'chat-a', sessionId: 'chat-a', canvasLayout: 'inline', activeScene: null,
    artifactLifecycle: { status: 'idle', sessionId: null, messageId: null }, lessonPositions: {},
  });
});

/** A question with its answer streaming, committed so card metadata can be read. */
const streamingAnswer = () => {
  S().addUserMessage('Why is the area of a circle πr²?', 'chat-a');
  S().startStreaming('asst-1', 'chat-a', 'tok', 'req-1');
  useTutorStore.setState((st) => {
    st.conversationMessages.push({ id: 'asst-1', role: 'assistant', content: '', metadata: { versions: [], activeVersionIndex: 0 } });
  });
};
const card = () => S().conversationMessages.find((m) => m.id === 'asst-1')?.metadata || {};

describe('canvas readiness', () => {
  it('a planned visual neither opens nor clears the canvas', () => {
    streamingAnswer();
    ev({ type: 'canvas_skeleton', layout: 'split', rendererType: 'd3' });
    expect(S().canvasLayout).toBe('inline');
    expect(S().activeScene).toBeNull();
    expect(S().canvasSteps).toEqual([]);
    expect(S().artifactLifecycle.status).toBe('preparing');
    expect(card()).toMatchObject({ hasVisualArtifact: true, artifactStatus: 'generating' });
  });

  it('a lesson already on screen stays until the new one has content', () => {
    ev(lesson(3, false, 'Old lesson'));
    streamingAnswer();
    ev({ type: 'canvas_skeleton', layout: 'split', rendererType: 'd3' });
    expect(S().activeScene.title).toBe('Old lesson');
    expect(S().totalSteps).toBe(3);
  });

  it('an empty scene (no steps yet) does not start a lesson or open the canvas', () => {
    streamingAnswer();
    ev(lesson(0, true));
    ev({ type: 'scene_nodes', nodes: [], renderer: 'd3' });
    expect(S().activeScene).toBeNull();
    expect(S().canvasLayout).toBe('inline');
  });

  it('the lesson starts once on its first steps; later beats extend it without restarting', () => {
    streamingAnswer();
    ev({ type: 'canvas_skeleton', layout: 'split', rendererType: 'scene-v2' });
    const setTimeline = vi.spyOn(S(), 'setTimeline');
    ev(lesson(2, true));
    expect(S().canvasLayout).toBe('split');
    expect(S().artifactLifecycle.status).toBe('rendering');
    useTutorStore.setState({ currentStepIndex: 1 }); // the learner moved on
    ev(lesson(4, true));
    ev(lesson(5, false));
    expect(setTimeline).toHaveBeenCalledTimes(1); // initialised once, on the first steps
    expect(S().currentStepIndex).toBe(1);
    expect(S().totalSteps).toBe(5);
    expect(S().artifactLifecycle.status).toBe('ready');
    expect(card().artifactStatus).toBe('completed');
  });

  it('a visual that could not be drawn is shown as failed on the card — the answer stays', () => {
    streamingAnswer();
    ev({ type: 'canvas_skeleton', layout: 'split', rendererType: 'scene-v2' });
    ev({ type: 'scene_failed', message: "I couldn't draw this lesson." });
    expect(S().artifactLifecycle.status).toBe('failed');
    expect(card()).toMatchObject({ hasVisualArtifact: true, artifactStatus: 'failed' });

    S().appendStreamChunk('The area is πr².', 'chat-a', 'tok');
    S().finishStreaming('The area is πr².', 'chat-a', '', [], null, null, 10, 'tok');
    const answer = S().conversationMessages.find((m) => m.role === 'assistant');
    expect(answer.content).toBe('The area is πr².');
    expect(answer.metadata.artifactStatus).toBe('failed'); // never "completed"
  });

  it('a server "lesson failed" without a reason marks it failed too', () => {
    streamingAnswer();
    ev({ type: 'progress', requestId: 'req-1', stage: 'lesson', state: 'active' });
    ev({ type: 'progress', requestId: 'req-1', stage: 'lesson', state: 'failed' });
    expect(S().artifactLifecycle.status).toBe('failed');
  });

  it('Stop while the visual is being built cancels it; what arrived stays viewable', () => {
    streamingAnswer();
    ev({ type: 'canvas_skeleton', layout: 'split', rendererType: 'scene-v2' });
    ev(lesson(2, true));
    ev({ type: 'lesson_cancelled' });
    expect(S().artifactLifecycle.status).toBe('cancelled');
    expect(S().activeScene).toMatchObject({ streaming: false, cancelled: true });
    expect(S().totalSteps).toBe(2);
    expect(card().artifactStatus).toBe('cancelled');
  });

  it('Stop after the visual was ready changes nothing', () => {
    streamingAnswer();
    ev(lesson(3, false));
    ev({ type: 'lesson_cancelled' });
    expect(S().artifactLifecycle.status).toBe('ready');
  });
});

describe('request progress in the store', () => {
  it('records the server stages for the running request', () => {
    streamingAnswer();
    S().applyRequestProgress({ requestId: 'req-1', stage: 'web', state: 'active' }, 'chat-a', 'tok');
    expect(S().sessionStates['chat-a'].progress.stages.web.state).toBe('active');
  });

  it('drops events from an older stream, another request, or after Stop', () => {
    streamingAnswer();
    S().applyRequestProgress({ requestId: 'req-1', stage: 'web', state: 'active' }, 'chat-a', 'old-token');
    S().applyRequestProgress({ requestId: 'req-0', stage: 'web', state: 'active' }, 'chat-a', 'tok');
    expect(S().sessionStates['chat-a'].progress.stages).toEqual({});

    S().abortStreaming('chat-a');
    S().applyRequestProgress({ requestId: 'req-1', stage: 'writing', state: 'active' }, 'chat-a', 'tok');
    expect(S().sessionStates['chat-a'].progress).toBeNull();
  });

  it('is cleared when the answer completes or fails (the status line goes away)', () => {
    streamingAnswer();
    S().applyRequestProgress({ requestId: 'req-1', stage: 'writing', state: 'active' }, 'chat-a', 'tok');
    S().finishStreaming('Done.', 'chat-a', '', [], null, null, 10, 'tok');
    expect(S().sessionStates['chat-a'].progress).toBeNull();

    S().addUserMessage('Again', 'chat-a');
    S().startStreaming('asst-2', 'chat-a', 'tok2', 'req-2');
    S().failStreaming({ sessionId: 'chat-a', streamToken: 'tok2', assistantMessageId: 'asst-2', error: { message: 'x' } });
    expect(S().sessionStates['chat-a'].progress).toBeNull();
  });
});

describe('replay and saved positions', () => {
  it('Replay returns the same lesson to its first step and plays it', () => {
    ev(lesson(5, false));
    const scene = S().activeScene;
    useTutorStore.setState({ currentStepIndex: 4, isPlaying: false, isPaused: true, stepPlayback: { index: 4, animDone: true, voiceDone: true } });
    const nonce = S().replayNonce;
    S().replayLesson();
    expect(S().activeScene).toBe(scene); // nothing new was created
    expect(S()).toMatchObject({ currentStepIndex: 0, isPlaying: true, isPaused: false });
    expect(S().stepPlayback).toEqual({ index: 0, animDone: false, voiceDone: false });
    expect(S().replayNonce).toBe(nonce + 1);
  });

  it('an older saved position never replaces a newer one', () => {
    S().rememberLessonPosition('art-1', { step: 4, totalSteps: 5, savedAt: 200 });
    S().rememberLessonPosition('art-1', { step: 1, totalSteps: 5, savedAt: 100 });
    expect(S().lessonPositions['art-1'].step).toBe(4);
  });

  it('a lesson reopened at a saved step is paused there', () => {
    S().setTimeline({ ...lesson(5, false).timeline, artifactId: 'art-1', currentStepIndex: 3 });
    expect(S()).toMatchObject({ currentStepIndex: 3, isPlaying: false });
    expect(S().activeScene.artifactId).toBe('art-1');
  });
});
