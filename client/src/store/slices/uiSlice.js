export const createUiSlice = (set, get) => ({
  showFloatingSidebar: false,
  showMinimap:         false,
  selectedAgent:       localStorage.getItem('tutorboard-agent') || 'OpenRouter',
  layoutView:          'left',
  isSidebarOpen:       true,
  activeTool:          'select',
  editingObjectId:     null,
  
  showGrid:            true,
  isSnapToGrid:        true,
  isProfileOpen:       false,
  isVisualizerOpen:    false,
  
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

  textType:            'standard',
  textToolSize:        24,
  textWeight:          'regular',
  textItalic:          false,
  textUnderline:       false,
  textAlign:           'center',
  textBgColor:         'transparent',

  setLayoutView:    (view) => set({ layoutView: view }),
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
  toggleMinimap:         () => set(s => ({ showMinimap: !s.showMinimap })),
  setActiveTool:         (tool) => set({ activeTool: tool }),
  toggleGrid:            ()     => set(s => ({ showGrid: !s.showGrid })),
  toggleSnap:            ()     => set(s => ({ isSnapToGrid: !s.isSnapToGrid })),
  setGridType:           (type) => set({ gridType: type }),
  setGridSize:           (size) => set({ gridSize: size }),
  toggleProfile:         ()     => set(s => ({ isProfileOpen: !s.isProfileOpen })),
  setVisualizerOpen:     (open) => set({ isVisualizerOpen: open }),

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

  setTextType:      (type)  => set({ textType: type }),
  setTextToolSize:  (size)  => set({ textToolSize: size }),
  setTextWeight:    (weight)=> set({ textWeight: weight }),
  setTextItalic:    (v)     => set({ textItalic: v }),
  setTextUnderline: (v)     => set({ textUnderline: v }),
  setTextAlign:     (align) => set({ textAlign: align }),
  setTextBgColor:   (color) => set({ textBgColor: color }),

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
