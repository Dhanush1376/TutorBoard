/**
 * TutorStore — Centralized Zustand state management
 * 
 * Slices:
 *   - Session: topic, timeline, machine state, connection
 *   - Canvas: objects, transform, mode (open/minimized/closed), mutations
 *   - Doubt: thread nodes, history, active doubt, snapshots
 *   - Playback: speed, playing, paused, step index
 *   - UI: sidebar, doubt panel, voice
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Canvas mode constants
export const CANVAS_MODE = {
  CLOSED: 'CLOSED',
  FULLSCREEN: 'FULLSCREEN',
  MINIMIZED: 'MINIMIZED',
};

// Machine state constants (mirrors server)
export const STATES = {
  IDLE: 'IDLE',
  GENERATING: 'GENERATING',
  TEACHING: 'TEACHING',
  DOUBT_TRIGGERED: 'DOUBT_TRIGGERED',
  RESPONDING: 'RESPONDING',
  RESUMING: 'RESUMING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
};

const useTutorStore = create(
  persist(
    (set, get) => ({
      // ═══════════════════════════════════════════════════
      // SESSION STATE
      // ═══════════════════════════════════════════════════
      machineState: STATES.IDLE,
      sessionId: null,
      topic: '',
      isConnected: false,
      connectionError: null,
      error: null,
      greetingMessage: null,

      // ═══════════════════════════════════════════════════
      // TIMELINE & STEPS
      // ═══════════════════════════════════════════════════
      timeline: null,
      learningNodes: [],
      currentStepIndex: 0,
      totalSteps: 0,
      mode: 'explain',
      difficulty: 'beginner',
      professorNote: '',
      memoryAnchor: '',
      keyFormula: '',

      // ═══════════════════════════════════════════════════
      // CANVAS STATE
      // ═══════════════════════════════════════════════════
      canvasMode: CANVAS_MODE.CLOSED,
      canvasObjects: [],        // Mutable array of scene objects
      canvasSteps: [],          // Step definitions
      canvasTransform: { x: 0, y: 0, scale: 1 },

      // ═══════════════════════════════════════════════════
      // DOUBT STATE
      // ═══════════════════════════════════════════════════
      doubtHistory: [],         // Array of { id, question, answer, timestamp, snapshotId, hasVisuals }
      activeDoubtId: null,
      isDoubtProcessing: false,
      doubtResponse: null,
      showDoubtThread: false,   // Right panel visibility

      // ═══════════════════════════════════════════════════
      // CANVAS SNAPSHOTS (for doubt timeline)
      // ═══════════════════════════════════════════════════
      snapshots: {},            // snapshotId → { objects, stepIndex, transform }

      // ═══════════════════════════════════════════════════
      // PLAYBACK STATE
      // ═══════════════════════════════════════════════════
      isPlaying: false,
      isPaused: false,
      playbackSpeed: 1,
      voiceEnabled: false,

      // ═══════════════════════════════════════════════════
      // UI STATE
      // ═══════════════════════════════════════════════════
      showFloatingSidebar: false,
      showMinimap: false,

      // ═══════════════════════════════════════════════════
      // SESSION ACTIONS
      // ═══════════════════════════════════════════════════
      setMachineState: (state) => set({ machineState: state, error: null }),
      setSessionId: (id) => set({ sessionId: id }),
      setTopic: (topic) => set({ topic }),
      setConnected: (connected) => set({ isConnected: connected, connectionError: null }),
      setConnectionError: (err) => set({ connectionError: err, isConnected: false }),
      setError: (err) => set({ error: err }),
      setGreeting: (msg) => set({ greetingMessage: msg, machineState: STATES.IDLE }),

      // ═══════════════════════════════════════════════════
      // TIMELINE ACTIONS
      // ═══════════════════════════════════════════════════
      setTimeline: (data) => set({
        timeline: data,
        learningNodes: data.learningNodes || [],
        mode: data.mode || 'explain',
        difficulty: data.difficulty || 'beginner',
        professorNote: data.professorNote || '',
        memoryAnchor: data.memoryAnchor || '',
        keyFormula: data.keyFormula || '',
        canvasObjects: data.objects || [],
        canvasSteps: data.steps || [],
        totalSteps: data.totalSteps || data.steps?.length || 0,
        currentStepIndex: 0,
        doubtResponse: null,
        greetingMessage: null,
        canvasMode: CANVAS_MODE.FULLSCREEN,
      }),

      setCurrentStep: (index) => set({ currentStepIndex: index }),

      getCurrentStep: () => {
        const { canvasSteps, currentStepIndex } = get();
        return canvasSteps[currentStepIndex] || null;
      },

      // ═══════════════════════════════════════════════════
      // CANVAS ACTIONS
      // ═══════════════════════════════════════════════════
      setCanvasMode: (mode) => set({ canvasMode: mode }),

      openCanvas: () => set({ canvasMode: CANVAS_MODE.FULLSCREEN }),
      minimizeCanvas: () => set({ canvasMode: CANVAS_MODE.MINIMIZED }),
      closeCanvas: () => set({ canvasMode: CANVAS_MODE.CLOSED }),
      expandCanvas: () => set({ canvasMode: CANVAS_MODE.FULLSCREEN }),

      setCanvasTransform: (transform) => set({ canvasTransform: transform }),

      // Mutate canvas objects (for doubt-driven modifications)
      mutateCanvasObjects: (mutations) => {
        const { canvasObjects } = get();
        let newObjects = [...canvasObjects];

        for (const mutation of mutations) {
          switch (mutation.action) {
            case 'add':
              if (mutation.object) {
                // Don't add duplicates
                const exists = newObjects.find(o => o.id === mutation.object.id);
                if (!exists) {
                  newObjects.push(mutation.object);
                }
              }
              break;

            case 'modify':
              newObjects = newObjects.map(obj =>
                obj.id === mutation.targetId
                  ? { ...obj, ...mutation.changes }
                  : obj
              );
              break;

            case 'remove':
              newObjects = newObjects.filter(obj => obj.id !== mutation.targetId);
              break;

            case 'highlight':
              // handled at step level, but can modify glow/pulse
              if (mutation.targetIds) {
                newObjects = newObjects.map(obj =>
                  mutation.targetIds.includes(obj.id)
                    ? { ...obj, glow: true, pulse: true }
                    : obj
                );
              }
              break;

            case 'replace':
              // Full replacement (fallback for non-mutation AI responses)
              if (mutation.objects) {
                newObjects = mutation.objects;
              }
              break;

            default:
              break;
          }
        }

        set({ canvasObjects: newObjects });
      },

      // Add objects to canvas (append without replacing)
      addCanvasObjects: (objects) => {
        const { canvasObjects } = get();
        const existingIds = new Set(canvasObjects.map(o => o.id));
        const newOnes = objects.filter(o => !existingIds.has(o.id));
        set({ canvasObjects: [...canvasObjects, ...newOnes] });
      },

      // ═══════════════════════════════════════════════════
      // SNAPSHOT ACTIONS (for doubt timeline navigation)
      // ═══════════════════════════════════════════════════
      takeSnapshot: () => {
        const { canvasObjects, currentStepIndex, canvasTransform, canvasSteps } = get();
        const id = `snap-${Date.now()}`;
        set(state => ({
          snapshots: {
            ...state.snapshots,
            [id]: {
              objects: [...canvasObjects],
              steps: [...canvasSteps],
              stepIndex: currentStepIndex,
              transform: { ...canvasTransform },
              timestamp: Date.now(),
            }
          }
        }));
        return id;
      },

      restoreSnapshot: (snapshotId) => {
        const { snapshots } = get();
        const snap = snapshots[snapshotId];
        if (!snap) return;

        set({
          canvasObjects: [...snap.objects],
          canvasSteps: [...snap.steps],
          currentStepIndex: snap.stepIndex,
          canvasTransform: { ...snap.transform },
        });
      },

      // ═══════════════════════════════════════════════════
      // DOUBT ACTIONS
      // ═══════════════════════════════════════════════════
      setDoubtProcessing: (processing) => set({ isDoubtProcessing: processing }),

      addDoubt: (question, answer, hasVisuals = false, visualUpdate = null) => {
        const { takeSnapshot } = get();
        const snapshotId = takeSnapshot(); // Save canvas state before doubt

        const doubtNode = {
          id: `doubt-${Date.now()}`,
          question,
          answer,
          hasVisuals,
          visualUpdate,
          snapshotId,
          timestamp: Date.now(),
        };

        set(state => ({
          doubtHistory: [...state.doubtHistory, doubtNode],
          doubtResponse: { answer, hasVisuals, visualUpdate, _question: question },
          isDoubtProcessing: false,
          activeDoubtId: doubtNode.id,
        }));

        return doubtNode;
      },

      setDoubtResponse: (response) => set({ doubtResponse: response }),
      setActiveDoubt: (id) => set({ activeDoubtId: id }),
      toggleDoubtThread: () => set(s => ({ showDoubtThread: !s.showDoubtThread })),
      openDoubtThread: () => set({ showDoubtThread: true }),
      closeDoubtThread: () => set({ showDoubtThread: false }),

      // Jump to a doubt's canvas state
      jumpToDoubt: (doubtId) => {
        const { doubtHistory, restoreSnapshot } = get();
        const doubt = doubtHistory.find(d => d.id === doubtId);
        if (doubt?.snapshotId) {
          restoreSnapshot(doubt.snapshotId);
          set({ activeDoubtId: doubtId });
        }
      },

      // ═══════════════════════════════════════════════════
      // PLAYBACK ACTIONS
      // ═══════════════════════════════════════════════════
      setPlaying: (playing) => set({ isPlaying: playing, isPaused: !playing }),
      setPaused: (paused) => set({ isPaused: paused, isPlaying: !paused }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      toggleVoice: () => set(s => ({ voiceEnabled: !s.voiceEnabled })),

      play: () => set({ isPlaying: true, isPaused: false }),
      pause: () => set({ isPlaying: false, isPaused: true }),

      nextStep: () => {
        const { currentStepIndex, totalSteps } = get();
        if (currentStepIndex < totalSteps - 1) {
          set({ currentStepIndex: currentStepIndex + 1 });
        }
      },

      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 });
        }
      },

      goToStep: (index) => {
        set({ currentStepIndex: index, isPlaying: false });
      },

      // ═══════════════════════════════════════════════════
      // UI ACTIONS
      // ═══════════════════════════════════════════════════
      toggleFloatingSidebar: () => set(s => ({ showFloatingSidebar: !s.showFloatingSidebar })),
      openFloatingSidebar: () => set({ showFloatingSidebar: true }),
      closeFloatingSidebar: () => set({ showFloatingSidebar: false }),
      toggleMinimap: () => set(s => ({ showMinimap: !s.showMinimap })),

      // ═══════════════════════════════════════════════════
      // SESSION LIFECYCLE
      // ═══════════════════════════════════════════════════
      startSession: (topic) => set({
        topic,
        error: null,
        timeline: null,
        learningNodes: [],
        mode: 'explain',
        difficulty: 'beginner',
        professorNote: '',
        memoryAnchor: '',
        keyFormula: '',
        canvasObjects: [],
        canvasSteps: [],
        doubtResponse: null,
        doubtHistory: [],
        snapshots: {},
        greetingMessage: null,
        currentStepIndex: 0,
        totalSteps: 0,
        isPlaying: false,
        isPaused: false,
        activeDoubtId: null,
        showDoubtThread: false,
        canvasMode: CANVAS_MODE.FULLSCREEN,
      }),

      endSession: () => set({
        isPlaying: false,
        isPaused: false,
        canvasMode: CANVAS_MODE.CLOSED,
        timeline: null,
        canvasObjects: [],
        canvasSteps: [],
        currentStepIndex: 0,
        totalSteps: 0,
        doubtResponse: null,
        doubtHistory: [],
        snapshots: {},
        error: null,
        greetingMessage: null,
        machineState: STATES.IDLE,
        sessionId: null,
        topic: '',
        activeDoubtId: null,
        showDoubtThread: false,
        showFloatingSidebar: false,
      }),

      // Reset just the teaching state (keep connection)
      resetTeaching: () => set({
        machineState: STATES.IDLE,
        timeline: null,
        canvasObjects: [],
        canvasSteps: [],
        currentStepIndex: 0,
        totalSteps: 0,
        isPlaying: false,
        isPaused: false,
        doubtResponse: null,
        doubtHistory: [],
        snapshots: {},
        error: null,
      }),
    }),
    {
      name: 'tutorboard-session',
      // Only persist UI preferences, not session data
      partialize: (state) => ({
        playbackSpeed: state.playbackSpeed,
        voiceEnabled: state.voiceEnabled,
      }),
    }
  )
);

export default useTutorStore;
