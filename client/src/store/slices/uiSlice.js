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
  activeOverlay:       null, // 'settings' | 'visualizer' | 'profile' (if as overlay) | null
  isExplainMinimized:  false,
  isVisualizerMinimized: false,
  isSettingsMinimized: false,
  
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
  shapeFill:           'transparent', // FIX: was missing, caused shapes to draw with fill:undefined

  textType:            'standard',
  textToolSize:        24,
  textWeight:          'regular',
  textItalic:          false,
  textUnderline:       false,
  textAlign:           'center',
  textBgColor:         'transparent',
  globalOverlay:       { isActive: false, message: '', type: 'sync' }, // sync | network | error
  
  // Appearance Expansion
  globalFont:          'geist',
  glassIntensity:      80,
  canvasTone:          'neutral',
  motionMode:          'fluid',
  alertPrefs:          {}, // { [key]: boolean }

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
  toasts: [], // { id, message, type, duration, onUndo }


  setLayoutView:    (view) => set({ layoutView: view }),
  setGlobalOverlay: (overlay) => set({ globalOverlay: { ...get().globalOverlay, ...overlay } }),
  
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
  
  closeAlert: () => set(s => ({ 
    globalAlert: { ...s.globalAlert, isActive: false } 
  })),

  showToast: (config) => {
    const id = Date.now();
    set(s => {
      const newToasts = [...s.toasts, { id, type: 'info', duration: 5000, ...config }];
      // Keep only the last 3 toasts
      return { toasts: newToasts.slice(-3) };
    });
    return id;
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  setAlertPref: (key, val) => set(s => ({
    alertPrefs: { ...s.alertPrefs, [key]: val }
  })),

  setSidebarOpen:   (open)  => set({ isSidebarOpen: open }),
  toggleSidebar:    ()      => set(s => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSelectedAgent: (agent) => {
    localStorage.setItem('tutorboard-agent', agent);
    set({ selectedAgent: agent });
  },
  setEditingObjectId: (id) => set({ editingObjectId: id }),
  setHasTextSelection: (val) => set({ hasTextSelection: val }),

  toggleFloatingSidebar: () => set(s => ({ showFloatingSidebar: !s.showFloatingSidebar })),
  openFloatingSidebar:   () => set({ showFloatingSidebar: true }),
  closeFloatingSidebar:  () => set({ showFloatingSidebar: false }),
  setShowMinimap:         (show) => set({ showMinimap: show }),
  toggleMinimap:         () => set(s => ({ showMinimap: !s.showMinimap })),
  setActiveTool:         (tool) => set({ activeTool: tool }),
  setShowGrid:           (show) => set({ showGrid: show }),
  toggleGrid:            ()     => set(s => ({ showGrid: !s.showGrid })),
  setSnapToGrid:         (snap) => set({ isSnapToGrid: snap }),
  toggleSnap:            ()     => set(s => ({ isSnapToGrid: !s.isSnapToGrid })),
  setGridType:           (type) => set({ gridType: type }),
  setGridSize:           (size) => set({ gridSize: size }),
  toggleProfile:         ()     => set(s => ({ isProfileOpen: !s.isProfileOpen })),
  setOverlay:            (id)   => set({ activeOverlay: id }),
  setVisualizerOpen:     (open) => set({ activeOverlay: open ? 'scene-visualizer' : null }),
  setCodeEditorOpen:     (open) => set({ activeOverlay: open ? 'code-editor' : null }),
  setExplainMinimized:   (min)  => set({ isExplainMinimized: min }),
  setVisualizerMinimized: (min) => set({ isVisualizerMinimized: min }),
  setSettingsMinimized: (min) => set({ isSettingsMinimized: min }),

  setDrawColor:          (color) => set({ drawColor: color }),
  setDrawWidth:          (width) => set({ drawWidth: width }),
  setLaserWidth:         (width) => set({ laserWidth: width }),
  addRecentColor: (color) => set(state => {
    if (color === '__clear__') return { recentColors: [] };
    if (color.startsWith('var')) return {};
    const filtered = (state.recentColors || []).filter(c => c !== color);
    return { recentColors: [color, ...filtered].slice(0, 8) };
  }),

  setNoteColor:          (color) => set({ noteColor: color }),
  setNoteSize:           (size)  => set({ noteSize: size }),
  setNoteToolSize:       (size)  => set({ noteToolSize: size }),
  setNotePinned:         (pinned) => set({ notePinned: pinned }),
  setShapeStrokeStyle:   (style) => set({ shapeStrokeStyle: style }),
  setShapeFill:          (fill)  => set({ shapeFill: fill }),

  // Show/hide notes layer — was missing, caused InteractiveCanvasLayer to get undefined
  showNotes:             true,
  setShowNotes:          (show) => set({ showNotes: show }),
  toggleNotes:           () => set(s => ({ showNotes: !s.showNotes })),

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
      const currentSnaps = state.snapshots || {};
      const keys = Object.keys(currentSnaps);
      if (keys.length >= 10) {
        const oldestKey = keys.sort()[0];
        const { [oldestKey]: _, ...rest } = currentSnaps;
        return {
          snapshots: {
            ...rest,
            [id]: {
              objects:     [...(canvasObjects || [])],
              connections: [...(canvasConnections || [])],
              steps:       [...(canvasSteps || [])],
              stepIndex:   currentStepIndex,
              transform:   { ...(canvasTransform || { x: 0, y: 0, scale: 1 }) },
              timestamp:   Date.now(),
            },
          },
        };
      }
      return {
        snapshots: {
          ...currentSnaps,
          [id]: {
            objects:     [...canvasObjects],
            connections: [...canvasConnections],
            steps:       [...canvasSteps],
            stepIndex:   currentStepIndex,
            transform:   { ...canvasTransform },
            timestamp:   Date.now(),
          },
        },
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
});
