/**
 * uiSlice.js — TutorBoard UI State
 *
 * IMMER FIXES:
 *   - addRecentColor: was set(state => ({...})) — returns new object inside Immer draft → CRASH
 *   - markSessionRead: same pattern → CRASH
 *   - removeToast: same pattern → CRASH
 *   - closeAlert: same pattern → CRASH
 *   - setAlertPref: same pattern → CRASH
 *   - toggleSidebar, toggleSidebarPosition, toggleVoice, etc.: same pattern → CRASH
 *
 * Rule: Inside immer()-wrapped zustand, NEVER return a new object from set(state => ...).
 *   Either: mutate state directly, OR use set({ key: value }) (plain object, no callback).
 */

export const createUiSlice = (set, get) => ({
  showFloatingSidebar: false,
  showMinimap:         false,
  selectedAgent:       'Universal',
  layoutView:          'left',
  isSidebarOpen:       true,
  activeTool:          'select',
  editingObjectId:     null,

  showGrid:            true,
  isSnapToGrid:        true,
  isProfileOpen:       false,
  activeOverlay:       null,
  settingsActiveSection: 'general',
  isExplainMinimized:  false,
  isVisualizerMinimized: false,
  isSettingsMinimized: false,
  isMasteryOpen:        false,
  unreadSessions:       [],

  // ✅ FIX: mutate draft instead of returning new object
  addUnreadSession: (sessionId) => set(s => {
    if (s.unreadSessions.includes(sessionId)) return;
    s.unreadSessions.push(sessionId);
  }),

  // ✅ FIX: plain set() call — no callback returning new object
  markSessionRead: (sessionId) => set((s) => {
    s.unreadSessions = s.unreadSessions.filter(id => id !== sessionId);
  }),

  codeEditorCode:      '',
  codeEditorLang:      'javascript',

  drawColor:           'var(--text-primary)',
  drawWidth:           3,
  laserWidth:          6,
  recentColors:        [],

  gridType:            'dots',
  gridSize:            20,
  snapshots:           {},
  hasTextSelection:    false,

  noteColor:           '#fef9c3',
  noteSize:            'M',
  notePinned:          false,
  noteToolSize:        16,

  shapeStrokeStyle:    'solid',
  shapeFill:           'transparent',

  textType:            'standard',
  textToolSize:        24,
  textWeight:          'regular',
  textItalic:          false,
  textUnderline:       false,
  textAlign:           'center',
  textBgColor:         'transparent',
  globalOverlay:       { isActive: false, message: '', type: 'sync' },

  globalFont:          'geist',
  glassIntensity:      80,
  canvasTone:          'neutral',
  motionMode:          'fluid',
  alertPrefs:          {},
  chatInputText:       '',
  selectedTextContext: null,
  isVoiceEnabled:      true,
  isHydrated:          false,

  globalAlert: {
    isActive: false,
    type: 'info',
    title: '',
    message: '',
    confirmLabel: 'OK',
    cancelLabel: 'Cancel',
    onConfirm: null,
    onCancel: null
  },
  toasts: [],
  featureFlags: {
    enableCodeExecution: true,
    enable3DRenderer: false,
    enableMatterPhysics: true
  },

  setLayoutView: (view) => set({ layoutView: view }),

  setGlobalOverlay: (overlay) => {
    const current = get().globalOverlay;
    if (overlay.isActive === current.isActive &&
        overlay.type === current.type &&
        overlay.message === current.message) return;
    set({ globalOverlay: { ...current, ...overlay } });
  },

  showAlert: (config) => set({
    globalAlert: {
      isActive: true,
      type: 'info',
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
      onConfirm: null,
      onCancel: null,
      ...config
    }
  }),

  // ✅ FIX: mutate draft
  closeAlert: () => set((s) => {
    s.globalAlert.isActive = false;
  }),

  showToast: (config) => {
    const id = Date.now();
    // ✅ CORRECT: already uses draft mutation — no return value inside set()
    set(s => {
      s.toasts.push({ id, type: 'info', duration: 5000, ...config });
      if (s.toasts.length > 3) s.toasts.shift();
    });
    return id; // ✅ Safe: returned from outer function, not from inside set()
  },

  // ✅ FIX: mutate draft
  removeToast: (id) => set((s) => {
    s.toasts = s.toasts.filter(t => t.id !== id);
  }),

  // ✅ FIX: mutate draft
  setAlertPref: (key, val) => set((s) => {
    s.alertPrefs[key] = val;
  }),

  setSidebarOpen:   (open)  => set({ isSidebarOpen: open }),

  // ✅ FIX: mutate draft
  toggleSidebar:    ()      => set(s => { s.isSidebarOpen = !s.isSidebarOpen; }),

  setChatInputText: (text)  => set({ chatInputText: text }),

  // ✅ FIX: mutate draft
  toggleSidebarPosition: () => set(s => {
    s.layoutView = s.layoutView === 'left' ? 'right' : 'left';
  }),

  setSelectedTextContext: (text) => set({ selectedTextContext: text }),
  setSelectedAgent: (agent) => {
    localStorage.setItem('tutorboard-agent', agent);
    set({ selectedAgent: agent });
  },
  setEditingObjectId: (id) => set({ editingObjectId: id }),
  setHasTextSelection: (val) => set({ hasTextSelection: val }),

  // ✅ FIX: mutate draft
  toggleVoice: () => set(s => { s.isVoiceEnabled = !s.isVoiceEnabled; }),

  setHydrated: (val) => set({ isHydrated: val }),

  // ✅ FIX: mutate draft
  toggleFloatingSidebar: () => set(s => { s.showFloatingSidebar = !s.showFloatingSidebar; }),
  openFloatingSidebar:   () => set({ showFloatingSidebar: true }),
  closeFloatingSidebar:  () => set({ showFloatingSidebar: false }),
  setShowMinimap:         (show) => set({ showMinimap: show }),

  // ✅ FIX: mutate draft
  toggleMinimap:         () => set(s => { s.showMinimap = !s.showMinimap; }),

  setActiveTool:         (tool) => set({ activeTool: tool }),
  deselectAll: () => {
    set({
      activeTool: 'select',
      selectedElementIds: [],
      editingObjectId: null,
      hasTextSelection: false
    });
  },
  setShowGrid:           (show) => set({ showGrid: show }),

  // ✅ FIX: mutate draft
  toggleGrid:            ()     => set(s => { s.showGrid = !s.showGrid; }),
  setSnapToGrid:         (snap) => set({ isSnapToGrid: snap }),

  // ✅ FIX: mutate draft
  toggleSnap:            ()     => set(s => { s.isSnapToGrid = !s.isSnapToGrid; }),
  setGridType:           (type) => set({ gridType: type }),
  setGridSize:           (size) => set({ gridSize: size }),

  // ✅ FIX: mutate draft
  toggleProfile:         ()     => set(s => { s.isProfileOpen = !s.isProfileOpen; }),
  setOverlay:            (id)   => set({ activeOverlay: id }),
  setSettingsActiveSection: (section) => set({ settingsActiveSection: section }),
  setVisualizerOpen:     (open) => set({ activeOverlay: open ? 'scene-visualizer' : null }),
  setCodeEditorOpen:     (open) => set({ activeOverlay: open ? 'code-editor' : null }),
  setExplainMinimized:   (min)  => set({ isExplainMinimized: min }),
  setVisualizerMinimized: (min) => set({ isVisualizerMinimized: min }),
  setSettingsMinimized: (min) => set({ isSettingsMinimized: min }),
  setMasteryOpen: (open) => set({ isMasteryOpen: open }),

  setCodeEditorData: (code, lang) => set({
    codeEditorCode: code,
    codeEditorLang: lang || 'javascript',
    activeOverlay: 'code-editor'
  }),

  setDrawColor:          (color) => set({ drawColor: color }),
  setDrawWidth:          (width) => set({ drawWidth: width }),
  setLaserWidth:         (width) => set({ laserWidth: width }),

  // ✅ FIX: mutate draft — no return value inside set() callback
  addRecentColor: (color) => set((state) => {
    if (color === '__clear__') { state.recentColors = []; return; }
    if (color.startsWith('var')) return;
    const filtered = (state.recentColors || []).filter(c => c !== color);
    state.recentColors = [color, ...filtered].slice(0, 8);
  }),

  setNoteColor:          (color) => set({ noteColor: color }),
  setNoteSize:           (size)  => set({ noteSize: size }),
  setNoteToolSize:       (size)  => set({ noteToolSize: size }),
  setNotePinned:         (pinned) => set({ notePinned: pinned }),
  setShapeStrokeStyle:   (style) => set({ shapeStrokeStyle: style }),
  setShapeFill:          (fill)  => set({ shapeFill: fill }),

  showNotes:             true,
  setShowNotes:          (show) => set({ showNotes: show }),
  toggleNotes:           () => set(s => { s.showNotes = !s.showNotes; }),

  setTextType:      (type)  => set({ textType: type }),
  setTextToolSize:  (size)  => set({ textToolSize: size }),
  setTextWeight:    (weight)=> set({ textWeight: weight }),
  setTextItalic:    (v)     => set({ textItalic: v }),
  setTextUnderline: (v)     => set({ textUnderline: v }),
  setTextAlign:     (align) => set({ textAlign: align }),
  setTextBgColor:   (color) => set({ textBgColor: color }),

  setGlobalFont:    (font) => set({ globalFont: font }),
  setGlassIntensity:(val)  => set({ glassIntensity: val }),
  setCanvasTone:    (tone) => set({ canvasTone: tone }),
  setMotionMode:    (mode) => set({ motionMode: mode }),

  takeSnapshot: () => {
    const { canvasObjects, canvasConnections, currentStepIndex, canvasTransform, canvasSteps } = get();
    const id = `snap-${Date.now()}`;
    set(state => {
      if (!state.snapshots) state.snapshots = {};
      const currentSnaps = state.snapshots;
      const keys = Object.keys(currentSnaps);
      if (keys.length >= 10) {
        const oldestKey = keys.sort()[0];
        delete currentSnaps[oldestKey];
      }
      currentSnaps[id] = {
        objects:     [...(canvasObjects || [])],
        connections: [...(canvasConnections || [])],
        steps:       [...(canvasSteps || [])],
        stepIndex:   currentStepIndex,
        transform:   { ...(canvasTransform || { x: 0, y: 0, scale: 1 }) },
        timestamp:   Date.now(),
      };
    });
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

  addNoteToCanvas: (worldX, worldY) => {
    const { noteColor, noteSize, notePinned, noteToolSize, addCanvasObjects } = get();
    const note = {
      id: `manual-note-${Date.now()}`,
      type: 'note',
      shape: 'note',
      x: worldX,
      y: worldY,
      w: 0.225,
      h: 0.3,
      color: noteColor,
      size: noteSize,
      isPinned: notePinned,
      label: '',
      content: '',
      fontSize: noteToolSize,
      appearsAtStep: 0,
    };
    addCanvasObjects([note]);
  },
});