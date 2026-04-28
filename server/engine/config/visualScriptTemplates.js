/**
 * VisualScriptTemplates v1.0
 * 
 * Reusable animation sequences for common doubt categories.
 */
export const DELTA_TEMPLATES = {
  IDENTIFY: (id) => [
    { id, action: 'highlight', duration: 0.8, delay: 0 },
    { id, action: 'pulseElement', duration: 0.6, delay: 0.2 }
  ],
  COMPARE: (idA, idB) => [
    { id: idA, action: 'highlight', duration: 0.5, delay: 0 },
    { id: idB, action: 'highlight', duration: 0.5, delay: 0.1 },
    { id: idA, action: 'shake', duration: 0.3, delay: 0.6 }
  ],
  POINTER_TO: (x, y, label) => [
    { id: 'teacher-pointer', action: 'pointer_move', props: { x, y }, duration: 0.6, delay: 0 },
    { id: 'teacher-pointer', action: 'annotate', text: label, duration: 0.4, delay: 0.6 }
  ],
  NOT_THIS: (id) => [
    { id, action: 'shake', duration: 0.4, delay: 0 },
    { id, action: 'fade_out', duration: 0.4, delay: 0.4 }
  ]
};
