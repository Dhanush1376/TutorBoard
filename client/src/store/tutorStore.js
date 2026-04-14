/**
 * TutorStore v2.0 — Centralized Zustand state management
 *
 * WHAT CHANGED FROM v1:
 *   1. setTimeline now EXPLICITLY maps all three canvas fields:
 *        canvasObjects    ← data.elements || data.objects
 *        canvasConnections← data.connections
 *        canvasSteps      ← data.timeline || data.steps
 *      Previously these three fields were set correctly but the comment said "already
 *      set above" — in practice they were missing the alias fallback in some code paths,
 *      causing AgentCanvasRenderer to receive empty arrays and render nothing.
 *      Now the mapping is explicit, doubly aliased, and documented.
 *
 *   2. canvasMode is forced to FULLSCREEN when setTimeline is called, so the canvas
 *      always opens as soon as a lesson is ready.
 *
 *   3. totalSteps is now derived from the processed step array, never from the raw
 *      LLM-reported count (which was sometimes 0 or wrong).
 *
 *   4. A `generationProgress` field is added so UI components can show a live
 *      progress message during the GENERATING state.
 *
 *   5. toggleDoubtThread typo fixed (was referencing isDoubtTransition, a non-existent field).
 *
 *   6. The `hydrate` action now also reads selectedAgent from localStorage correctly.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CANVAS_MODE = {
  CLOSED:     'CLOSED',
  FULLSCREEN: 'FULLSCREEN',
  MINIMIZED:  'MINIMIZED',
};

export const STATES = {
  IDLE:            'IDLE',
  GENERATING:      'GENERATING',
  TEACHING:        'TEACHING',
  DOUBT_TRIGGERED: 'DOUBT_TRIGGERED',
  RESPONDING:      'RESPONDING',
  RESUMING:        'RESUMING',
  COMPLETED:       'COMPLETED',
  ERROR:           'ERROR',
};

const useTutorStore = create(
  persist(
    (set, get) => ({
      // ═══════════════════════════════════════════════════
      // SESSION STATE
      // ═══════════════════════════════════════════════════
      machineState:       STATES.IDLE,
      sessionId:          null,
      topic:              '',
      isConnected:        false,
      connectionError:    null,
      error:              null,
      greetingMessage:    null,
      generationProgress: null, // Live progress message during GENERATING state

      // ═══════════════════════════════════════════════════
      // TIMELINE & STEPS
      // ═══════════════════════════════════════════════════
      timeline:       null,
      learningNodes:  [],
      currentStepIndex: 0,
      totalSteps:     0,
      mode:           'explain',
      difficulty:     'beginner',
      professorNote:  '',
      memoryAnchor:   '',
      keyFormula:     '',
      renderer:       'cinematic',

      // ═══════════════════════════════════════════════════
      // CANVAS STATE
      // ═══════════════════════════════════════════════════
      canvasMode:        CANVAS_MODE.CLOSED,
      canvasObjects:     [],      // Normalized elements array — AgentCanvasRenderer reads this
      pinnedNotes:       [],      // Global floating sticky notes
      canvasConnections: [],      // Normalized connections array
      canvasSteps:       [],      // Normalized timeline/steps array
      canvasTransform:   { x: 0, y: 0, scale: 1 },
      isCanvasLocked:    false,   // Disables pan/zoom when a note is active
      showNotes:         true,    // Global toggle for sticky notes visibility
      chatInputText:     "",      // Pipeline to inject sticky note text to AI Chat
      
      // Canvas Interaction State (Figma/Miro features)
      selectedElementIds: [],
      history: { past: [], future: [] },

      // ═══════════════════════════════════════════════════
      // DOUBT STATE
      // ═══════════════════════════════════════════════════
      doubtHistory:      [],
      activeDoubtId:     null,
      isDoubtProcessing: false,
      doubtResponse:     null,
      showDoubtThread:   false,

      // ═══════════════════════════════════════════════════
      // CANVAS SNAPSHOTS
      // ═══════════════════════════════════════════════════
      snapshots: {},

      // ═══════════════════════════════════════════════════
      // PLAYBACK STATE
      // ═══════════════════════════════════════════════════
      isPlaying:    false,
      isPaused:     false,
      playbackSpeed: 1,
      voiceEnabled: false,

      // ═══════════════════════════════════════════════════
      // UI STATE
      // ═══════════════════════════════════════════════════
      showFloatingSidebar: false,
      showMinimap:         false,
      selectedAgent:       'OpenRouter',
      layoutView:          'right',
      isSidebarOpen:       true,
      activeTool:          'select',
      editingObjectId:     null,
      
      // Fine-grained UI preferences
      showGrid:            true,
      isSnapToGrid:        true,
      isProfileOpen:       false,
      
      // Drawing Properties
      drawColor:           'var(--text-primary)',
      drawWidth:           3,

      // Grid & Layout Properties
      gridType:            'dots',
      gridSize:            20,

      // Note Properties
      noteColor:           '#fef9c3', // Standard Yellow
      noteSize:            'M',

      // Shape Properties
      shapeFill:           'none',
      shapeStrokeStyle:    'solid',

      // Typography Properties
      textType:            'standard',
      textSize:            16,
      textWeight:          'regular',
      textAlign:           'center',
      textBgColor:         'transparent',

      // ═══════════════════════════════════════════════════
      // SESSION ACTIONS
      // ═══════════════════════════════════════════════════
      setLayoutView:    (view) => set({ layoutView: view }),
      setMachineState:  (state) => set({ machineState: state, error: null }),
      setSidebarOpen:   (open)  => set({ isSidebarOpen: open }),
      toggleSidebar:    ()      => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
      setSessionId:     (id)    => set({ sessionId: id }),
      setTopic:         (topic) => set({ topic }),
      setSelectedAgent: (agent) => {
        localStorage.setItem('tutorboard-agent', agent);
        set({ selectedAgent: agent });
      },
      setConnected:     (connected) => set({ isConnected: connected, connectionError: null }),
      setConnectionError: (err)     => set({ connectionError: err, isConnected: false }),
      setError:         (err)       => set({ error: err }),
      setGreeting:      (msg)       => set({ greetingMessage: msg, machineState: STATES.IDLE }),
      setGenerationProgress: (msg)  => set({ generationProgress: msg }),

      // ═══════════════════════════════════════════════════
      // TIMELINE ACTIONS
      // ═══════════════════════════════════════════════════
      setTimeline: (data) => {
        // ── CRITICAL: Explicit canvas field mapping ──────────────────────────
        // These three lines are the most important in the store.
        // AgentCanvasRenderer reads ONLY from canvasObjects, canvasConnections, canvasSteps.
        // If these aren't set here, the canvas renders nothing.
        //
        // The server always sends both aliased keys (elements/objects, timeline/steps)
        // but we normalize to one canonical set on the client side.
        const canvasObjects     = data.elements     || data.objects      || [];
        const canvasConnections = data.connections  || [];
        const canvasSteps       = data.timeline     || data.steps        || [];
        const totalSteps        = canvasSteps.length; // Derive from array, never trust LLM's reported count

        set({
          timeline: {
            ...data,
            // Store both forms so any consumer can access either
            elements:    canvasObjects,
            objects:     canvasObjects,
            connections: canvasConnections,
            timeline:    canvasSteps,
            steps:       canvasSteps,
            renderer:    data.renderer || 'cinematic',
            totalSteps,
          },
          renderer:          data.renderer || 'cinematic',
          learningNodes:     data.learningNodes || [],
          mode:              data.mode       || 'explain',
          difficulty:        data.difficulty || 'beginner',
          professorNote:     data.professorNote  || '',
          memoryAnchor:      data.memoryAnchor   || '',
          keyFormula:        data.keyFormula     || '',

          // ── Canvas fields (the critical mapping) ──
          canvasObjects,
          canvasConnections,
          canvasSteps,
          totalSteps,

          currentStepIndex:  0,
          doubtResponse:     null,
          greetingMessage:   null,
          generationProgress: null,

          // Open the canvas as soon as the lesson is ready
          canvasMode:        CANVAS_MODE.FULLSCREEN,
          canvasTransform:   { x: 0, y: 0, scale: 1 },
        });
      },

      setCurrentStep: (index) => set({ currentStepIndex: index }),

      setCanvasSnapshot: ({ canvasObjects, canvasSteps, totalSteps }) => {
        const steps = canvasSteps || [];
        const count = totalSteps  || steps.length;

        set({
          canvasObjects: canvasObjects || [],
          canvasSteps:   steps,
          totalSteps:    count,
          currentStepIndex: Math.max(0, steps.length - 1),
          canvasMode: CANVAS_MODE.FULLSCREEN,
          timeline: {
            title:       'Lesson Snapshot',
            domain:      'general',
            objects:     canvasObjects || [],
            elements:    canvasObjects || [],
            steps,
            timeline:    steps,
            totalSteps:  count,
            render_mode: 'svg_canvas',
          },
        });
      },

      getCurrentStep: () => {
        const { canvasSteps, currentStepIndex } = get();
        return canvasSteps[currentStepIndex] || null;
      },

      // ═══════════════════════════════════════════════════
      // UI ACTIONS
      // ═══════════════════════════════════════════════════
      setEditingObjectId: (id) => set({ editingObjectId: id }),

      // ═══════════════════════════════════════════════════
      // CANVAS ACTIONS
      // ═══════════════════════════════════════════════════
      setCanvasMode: (mode) => set({ canvasMode: mode }),
      openCanvas:    ()     => set({ canvasMode: CANVAS_MODE.FULLSCREEN }),
      minimizeCanvas:()     => set({ canvasMode: CANVAS_MODE.MINIMIZED }),
      closeCanvas:   ()     => set({ canvasMode: CANVAS_MODE.CLOSED }),
      expandCanvas:  ()     => set({ canvasMode: CANVAS_MODE.FULLSCREEN }),

      setCanvasTransform: (transform) => set({ canvasTransform: transform }),
      setChatInputText:   (text) => set({ chatInputText: text }),
      setShowNotes:       (val) => set({ showNotes: val }),
      setCanvasLocked:    (locked) => set({ isCanvasLocked: locked }),

      mutateCanvasObjects: (mutationsOrPatches) => {
        const { canvasObjects, canvasSteps } = get();
        let newObjects = [...canvasObjects];
        let newSteps   = [...canvasSteps];
        let lastAddedIndex = -1;

        const items = Array.isArray(mutationsOrPatches) ? mutationsOrPatches : [];

        for (const item of items) {
          if (item.op === 'add' && item.frame) {
            const newStepIndex = item.afterStepIndex !== undefined ? item.afterStepIndex + 1 : newSteps.length;
            const newStep = {
              index:        newStepIndex,
              id:           item.frame.id || `doubt-step-${Date.now()}`,
              title:        item.frame.label || 'Explanation',
              narration:    item.frame.label || item.frame.explanation || '',
              explanation:  item.frame.explanation || '',
              highlightIds: item.frame.shapes?.map(s => s.id) || [],
              objectIds:    item.frame.shapes?.map(s => s.id) || [],
              cameraFocus:  item.frame.cameraFocus || { x: 0.5, y: 0.5, zoom: 0.8 },
              animation:    item.frame.animation   || { type: 'draw', duration: 0.8 },
            };

            newSteps.splice(newStepIndex, 0, newStep);
            for (let i = newStepIndex + 1; i < newSteps.length; i++) newSteps[i].index = i;
            lastAddedIndex = newStepIndex;

            if (item.frame.shapes) {
              item.frame.shapes.forEach(shape => {
                if (!newObjects.find(o => o.id === shape.id)) {
                  newObjects.push({ ...shape, doubtDriven: true });
                }
              });
            }
          } else if (item.op === 'modify' && item.shapeId) {
            newObjects = newObjects.map(obj =>
              obj.id === item.shapeId ? { ...obj, ...item.props } : obj
            );
          }
        }

        set({
          canvasObjects: newObjects,
          canvasSteps:   newSteps,
          totalSteps:    newSteps.length,
          ...(lastAddedIndex !== -1 ? { currentStepIndex: lastAddedIndex, canvasMode: CANVAS_MODE.FULLSCREEN } : {}),
        });

        return lastAddedIndex;
      },


      setSelectedElements: (ids) => set({ selectedElementIds: ids }),
      
      setCanvasObjectsWithHistory: (newObjects) => {
        const { canvasObjects, history, canvasSteps, currentStepIndex } = get();
        
        // AUTO-VISIBILITY: If we are in a session, ensure new objects are visible in current step
        let newSteps = [...canvasSteps];
        if (currentStepIndex >= 0 && newSteps[currentStepIndex]) {
          const existingIds = new Set(canvasObjects.map(o => o.id));
          const addedIds = newObjects.filter(o => !existingIds.has(o.id)).map(o => o.id);
          
          if (addedIds.length > 0) {
            const step = { ...newSteps[currentStepIndex] };
            step.objectIds = [...(step.objectIds || []), ...addedIds];
            newSteps[currentStepIndex] = step;
          }
        }

        set({
          canvasObjects: newObjects,
          canvasSteps: newSteps,
          history: {
            past: [...history.past, canvasObjects],
            future: [],
          }
        });
      },

      undo: () => {
        const { history, canvasObjects } = get();
        if (history.past.length === 0) return;
        
        const previousState = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);
        
        set({
          canvasObjects: previousState,
          selectedElementIds: [],
          history: {
            past: newPast,
            future: [canvasObjects, ...history.future]
          }
        });
      },

      redo: () => {
        const { history, canvasObjects } = get();
        if (history.future.length === 0) return;
        
        const nextState = history.future[0];
        const newFuture = history.future.slice(1);
        
        set({
          canvasObjects: nextState,
          selectedElementIds: [],
          history: {
            past: [...history.past, canvasObjects],
            future: newFuture
          }
        });
      },

      // ═══════════════════════════════════════════════════
      // SNAPSHOT ACTIONS
      // ═══════════════════════════════════════════════════
      takeSnapshot: () => {
        const { canvasObjects, canvasConnections, currentStepIndex, canvasTransform, canvasSteps } = get();
        const id = `snap-${Date.now()}`;
        set(state => ({
          snapshots: {
            ...state.snapshots,
            [id]: {
              objects:     [...canvasObjects],
              connections: [...canvasConnections],
              steps:       [...canvasSteps],
              stepIndex:   currentStepIndex,
              transform:   { ...canvasTransform },
              timestamp:   Date.now(),
            },
          },
        }));
        return id;
      },

      restoreSnapshot: (snapshotId) => {
        const { snapshots } = get();
        const snap = snapshots[snapshotId];
        if (!snap) return;
        set({
          canvasObjects:     [...snap.objects],
          canvasConnections: [...(snap.connections || [])],
          canvasSteps:       [...snap.steps],
          currentStepIndex:  snap.stepIndex,
          canvasTransform:   { ...snap.transform },
        });
      },

      // ═══════════════════════════════════════════════════
      // DOUBT ACTIONS
      // ═══════════════════════════════════════════════════
      setDoubtProcessing: (processing) => set({ isDoubtProcessing: processing }),

      addDoubt: (question, answer, hasVisuals = false, visualUpdate = null, followUp = null) => {
        const { takeSnapshot } = get();
        const snapshotId = takeSnapshot();

        const doubtNode = {
          id:          `doubt-${Date.now()}`,
          question,
          answer,
          followUp,
          hasVisuals,
          visualUpdate,
          snapshotId,
          timestamp:   Date.now(),
        };

        set(state => ({
          doubtHistory:      [...state.doubtHistory, doubtNode],
          doubtResponse:     { answer, followUp, hasVisuals, visualUpdate, _question: question },
          isDoubtProcessing: false,
          activeDoubtId:     doubtNode.id,
        }));

        return doubtNode;
      },

      pinDoubtToCanvas: (doubtId) => {
        const { doubtHistory, canvasTransform, addCanvasObjects } = get();
        const doubt = doubtHistory.find(d => d.id === doubtId);
        if (!doubt || !doubt.answer) return;

        const note = {
          id:           `pinned-${doubt.id}`,
          shape:        'doubt_note',
          type:         'doubt_note',
          x:            -canvasTransform.x / canvasTransform.scale + (400 / canvasTransform.scale),
          y:            -canvasTransform.y / canvasTransform.scale + (300 / canvasTransform.scale),
          text:         doubt.answer,
          question:     doubt.question,
          color:        '#fbbf24',
          appearsAtStep: 0,
          pinned:       true,
        };

        addCanvasObjects([note]);
      },

      unpinDoubtFromCanvas: (objectId) => {
        set(state => ({ canvasObjects: state.canvasObjects.filter(o => o.id !== objectId) }));
      },

      setDoubtResponse:  (response) => set({ doubtResponse: response }),
      setActiveDoubt:    (id)       => set({ activeDoubtId: id }),
      // FIX: was `!s.isDoubtTransition` (non-existent field) — now correctly toggles showDoubtThread
      toggleDoubtThread: () => set(s => ({ showDoubtThread: !s.showDoubtThread })),
      openDoubtThread:   () => set({ showDoubtThread: true }),
      closeDoubtThread:  () => set({ showDoubtThread: false }),

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
      setPlaying:     (playing) => set({ isPlaying: playing,  isPaused: !playing }),
      setPaused:      (paused)  => set({ isPaused: paused,    isPlaying: !paused }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      toggleVoice:    ()        => set(s => ({ voiceEnabled: !s.voiceEnabled })),
      play:           ()        => set({ isPlaying: true,  isPaused: false }),
      pause:          ()        => set({ isPlaying: false, isPaused: true }),

      nextStep: () => {
        const { currentStepIndex, totalSteps } = get();
        if (currentStepIndex < totalSteps - 1) set({ currentStepIndex: currentStepIndex + 1 });
      },

      prevStep: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1 });
      },

      goToStep: (index) => set({ currentStepIndex: index, isPlaying: false }),

      // ═══════════════════════════════════════════════════
      // UI ACTIONS
      // ═══════════════════════════════════════════════════
      toggleFloatingSidebar: () => set(s => ({ showFloatingSidebar: !s.showFloatingSidebar })),
      openFloatingSidebar:   () => set({ showFloatingSidebar: true }),
      closeFloatingSidebar:  () => set({ showFloatingSidebar: false }),
      toggleMinimap:         () => set(s => ({ showMinimap: !s.showMinimap })),
      setActiveTool:         (tool) => set({ activeTool: tool }),
      toggleGrid:            ()     => set(s => ({ showGrid: !s.showGrid })),
      toggleSnap:            ()     => set(s => ({ isSnapToGrid: !s.isSnapToGrid })),
      toggleProfile:         ()     => set(s => ({ isProfileOpen: !s.isProfileOpen })),
      
      // Cleanup Actions
      clearAll: () => set(state => ({ 
        canvasObjects: [],
        history: { past: [], present: [], future: [] } 
      })),
      
      clearDrawings: () => set(state => ({ 
        canvasObjects: state.canvasObjects.filter(o => o.type !== 'path') 
      })),

      clearNotes: () => set(state => ({ 
        canvasObjects: state.canvasObjects.filter(o => o.type !== 'note' && o.type !== 'step_box') 
      })),

      setDrawColor:          (color) => set({ drawColor: color }),
      setDrawWidth:          (width) => set({ drawWidth: width }),

      setGridType:           (type)  => set({ gridType: type }),
      setGridSize:           (size)  => set({ gridSize: size }),

      setNoteColor:          (color) => set({ noteColor: color }),
      setNoteSize:           (size)  => set({ noteSize: size }),

      setShapeFill:          (fill)  => set({ shapeFill: fill }),
      setShapeStrokeStyle:   (style) => set({ shapeStrokeStyle: style }),

      setTextType:           (type)  => set({ textType: type }),
      setTextSize:           (size)  => set({ textSize: size }),
      setTextWeight:         (weight) => set({ textWeight: weight }),
      setTextAlign:          (align) => set({ textAlign: align }),
      setTextBgColor:        (color) => set({ textBgColor: color }),

      // Advanced addCanvasObjects with Step tracking Support
      addCanvasObjects: (objects) => {
        const { canvasObjects, history, canvasSteps, currentStepIndex } = get();
        const existingIds = new Set(canvasObjects.map(o => o.id));
        const newOnes = objects.filter(o => !existingIds.has(o.id));
        const addedIds = newOnes.map(o => o.id);

        let newSteps = [...canvasSteps];
        if (currentStepIndex >= 0 && newSteps[currentStepIndex] && addedIds.length > 0) {
          const step = { ...newSteps[currentStepIndex] };
          step.objectIds = [...(step.objectIds || []), ...addedIds];
          newSteps[currentStepIndex] = step;
        }

        set({
          canvasObjects: [...canvasObjects, ...newOnes],
          canvasSteps: newSteps,
          history: {
            past: [...history.past, canvasObjects],
            future: []
          }
        });
      },

      addNoteToCanvas: (worldX, worldY) => {
        const { noteColor, noteSize, notePinned, addCanvasObjects } = get();
        
        // Map logical sizes to world-unit dimensions (approx 160px base)
        const sizeMap = {
          'xs': { w: 120, h: 120 },
          's':  { w: 160, h: 160 },
          'm':  { w: 200, h: 200 },
          'l':  { w: 260, h: 260 },
          'xl': { w: 340, h: 340 },
          // Support uppercase too just in case
          'XS': { w: 120, h: 120 },
          'S':  { w: 160, h: 160 },
          'M':  { w: 200, h: 200 },
          'L':  { w: 260, h: 260 },
          'XL': { w: 340, h: 340 }
        };
        const dims = sizeMap[noteSize] || sizeMap['m'];

        const newNote = {
          id: `manual-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'sticky',
          x: worldX / 800,
          y: worldY / 600,
          w: dims.w,
          h: dims.h,
          content: '', // Unified field
          label: '',   // Keep for legacy compat
          color: noteColor,
          rotation: (Math.random() * 12) - 6,
          isPinned: !!notePinned,
          styles: {
            fontSize: 16,
            fontWeight: 500,
          }
        };

        if (notePinned) {
          set({ pinnedNotes: [...get().pinnedNotes, newNote] });
        } else {
          addCanvasObjects([newNote]);
        }
      },

      setCanvasLocked: (isLocked) => set({ isCanvasLocked: isLocked }),
      setChatInputText: (text) => set({ chatInputText: text }),

       updateCanvasObject: (id, updates) => {
        const { canvasObjects, pinnedNotes, setCanvasObjectsWithHistory } = get();
        
        const applyUpdates = (obj) => {
          const next = { ...obj, ...updates };
          
          // Handle nested styles if provided
          if (updates.styles) {
            next.styles = { ...(obj.styles || {}), ...updates.styles };
          }

          // Handle spatial deltas with bounds clamping (Step 7)
          if (updates.dx !== undefined) {
             const newX = (obj.x || 0) + updates.dx;
             next.x = Math.max(0.02, Math.min(0.98, newX));
          }
          if (updates.dy !== undefined) {
             const newY = (obj.y || 0) + updates.dy;
             next.y = Math.max(0.02, Math.min(0.98, newY));
          }
          
          delete next.dx; 
          delete next.dy;

          // Mirror content to legacy fields if necessary
          if (updates.content !== undefined) {
             if (obj.type === 'code') next.code = updates.content;
             else next.label = updates.content;
          }

          return next;
        };

        const isPinned = pinnedNotes.some(n => n.id === id);
        
        if (isPinned) {
          set({ pinnedNotes: pinnedNotes.map(obj => obj.id === id ? applyUpdates(obj) : obj) });
        } else {
          setCanvasObjectsWithHistory(canvasObjects.map(obj => obj.id === id ? applyUpdates(obj) : obj));
        }
      },

      deleteCanvasObject: (id) => {
        const { canvasObjects, pinnedNotes, setCanvasObjectsWithHistory } = get();
        const isPinned = pinnedNotes.some(n => n.id === id);
        if (isPinned) {
          set({ pinnedNotes: pinnedNotes.filter(n => n.id !== id) });
        } else {
          setCanvasObjectsWithHistory(canvasObjects.filter(obj => obj.id !== id));
        }
      },

      toggleNotePin: (id) => {
        const { canvasObjects, pinnedNotes } = get();
        
        // Find if it's currently pinned or unpinned
        const pinnedIndex = pinnedNotes.findIndex(n => n.id === id);
        if (pinnedIndex !== -1) {
          // Unpin: move to canvasObjects
          const note = { ...pinnedNotes[pinnedIndex], isPinned: false };
          const newPinned = [...pinnedNotes];
          newPinned.splice(pinnedIndex, 1);
          set({ pinnedNotes: newPinned, canvasObjects: [...canvasObjects, note] });
        } else {
          // Pin: move to pinnedNotes
          const canvasIndex = canvasObjects.findIndex(n => n.id === id);
          if (canvasIndex !== -1) {
            const note = { ...canvasObjects[canvasIndex], isPinned: true };
            const newObj = [...canvasObjects];
            newObj.splice(canvasIndex, 1);
            set({ canvasObjects: newObj, pinnedNotes: [...pinnedNotes, note] });
          }
        }
      },

      duplicateNote: (id) => {
        const { canvasObjects, pinnedNotes } = get();
        const srcArray = pinnedNotes.find(n => n.id === id) ? pinnedNotes : canvasObjects;
        const srcNote = srcArray.find(n => n.id === id);
        if (!srcNote) return;

        const clone = {
          ...srcNote,
          id: `manual-note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          x: srcNote.x + (20 / 800), // Drop slightly to the right
          y: srcNote.y + (20 / 600), // Drop slightly down
        };

        if (srcNote.isPinned) {
          set({ pinnedNotes: [...pinnedNotes, clone] });
        } else {
          set({ canvasObjects: [...canvasObjects, clone] });
        }
      },

      bringToFront: (id) => {
        const { canvasObjects, pinnedNotes } = get();
        
        // Z-Index trick for SVG: move node to end of array
        const isPinned = pinnedNotes.some(n => n.id === id);
        if (isPinned) {
          const arr = [...pinnedNotes];
          const idx = arr.findIndex(n => n.id === id);
          if (idx !== -1) {
            const [item] = arr.splice(idx, 1);
            arr.push(item);
            set({ pinnedNotes: arr });
          }
        } else {
          const arr = [...canvasObjects];
          const idx = arr.findIndex(n => n.id === id);
          if (idx !== -1) {
            const [item] = arr.splice(idx, 1);
            arr.push(item);
            set({ canvasObjects: arr }); // We don't necessarily need full history for just a reorder
          }
        }
      },


      // ═══════════════════════════════════════════════════
      // SESSION LIFECYCLE
      // ═══════════════════════════════════════════════════
      startSession: (topic, initialQuestion) => {
        const initialDoubt = initialQuestion ? [{
          id:         `initial-doubt-${Date.now()}`,
          question:   initialQuestion,
          answer:     null,
          hasVisuals: false,
          snapshotId: null,
          timestamp:  Date.now(),
        }] : [];

        set({
          topic,
          error:              null,
          timeline:           null,
          learningNodes:      [],
          mode:               'explain',
          difficulty:         'beginner',
          professorNote:      '',
          memoryAnchor:       '',
          keyFormula:         '',
          canvasObjects:      [],
          canvasConnections:  [],
          canvasSteps:        [],
          doubtResponse:      null,
          doubtHistory:       initialDoubt,
          snapshots:          {},
          greetingMessage:    null,
          generationProgress: null,
          currentStepIndex:   0,
          totalSteps:         0,
          isPlaying:          false,
          isPaused:           false,
          activeDoubtId:      null,
          showDoubtThread:    false,
          canvasMode:         CANVAS_MODE.FULLSCREEN,
          canvasTransform:    { x: 0, y: 0, scale: 1 },
          machineState:       STATES.GENERATING,
        });
      },

      hydrate: () => {
        if (typeof window === 'undefined') return;
        set({
          isSidebarOpen: window.innerWidth >= 768,
          selectedAgent: localStorage.getItem('tutorboard-agent') || 'OpenRouter',
        });
      },

      endSession: () => set({
        isPlaying:          false,
        isPaused:           false,
        canvasMode:         CANVAS_MODE.CLOSED,
        timeline:           null,
        canvasObjects:      [],
        canvasConnections:  [],
        canvasSteps:        [],
        currentStepIndex:   0,
        totalSteps:         0,
        doubtResponse:      null,
        doubtHistory:       [],
        snapshots:          {},
        error:              null,
        greetingMessage:    null,
        generationProgress: null,
        machineState:       STATES.IDLE,
        sessionId:          null,
        topic:              '',
        activeDoubtId:      null,
        showDoubtThread:    false,
      }),

      resetTeaching: () => set({
        machineState:       STATES.IDLE,
        timeline:           null,
        canvasObjects:      [],
        canvasConnections:  [],
        canvasSteps:        [],
        currentStepIndex:   0,
        totalSteps:         0,
        isPlaying:          false,
        isPaused:           false,
        doubtResponse:      null,
        doubtHistory:       [],
        snapshots:          {},
        error:              null,
        generationProgress: null,
      }),
    }),
    {
      name: 'tutorboard-session',
      // Only persist UI preferences and global notes — never session data (canvas state, timelines, etc.)
      partialize: (state) => ({
        playbackSpeed: state.playbackSpeed,
        voiceEnabled:  state.voiceEnabled,
        layoutView:    state.layoutView,
        pinnedNotes:   state.pinnedNotes,
      }),
    }
  )
);

export default useTutorStore;