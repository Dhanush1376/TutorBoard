/**
 * High-Contrast Tool Cursors for TutorBoard
 * 
 * Uses Dual-Stroke SVG Data URIs (White fill, Black stroke)
 * to ensure visibility on both light and dark backgrounds.
 */

const CURSORS = {
  pen: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'%3E%3C/path%3E%3C/svg%3E") 0 22, auto`,
  
  marker: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 11 3 3L22 4l-3-3z'%3E%3C/path%3E%3Cpath d='m2 22 3-3 8.5-8.5-3-3L2 19z'%3E%3C/path%3E%3Cpath d='m18 8 3 3'%3E%3C/path%3E%3C/svg%3E") 0 22, auto`,
  
  laser: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3'%3E%3Ccircle cx='12' cy='12' r='8' stroke='black' stroke-width='1.5'/%3E%3Ccircle cx='12' cy='12' r='4' fill='%23f43f5e'/%3E%3C/svg%3E") 12 12, auto`,
  
  eraser: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'%3E%3C/path%3E%3Cpath d='m22 21H7L13 15'%3E%3C/path%3E%3C/svg%3E") 5 18, auto`,
};

export const getToolCursor = (activeTool, isDragging = false, isSpacePressed = false, isHoveringContent = false) => {
  if (isDragging) return 'grabbing';
  if (isSpacePressed) return 'grab';

  if (!activeTool) return 'default';

  switch (activeTool) {
    case 'hand': 
      return 'grab';
    case 'draw:pen': 
      return CURSORS.pen;
    case 'draw:highlighter': 
      return CURSORS.marker;
    case 'draw:laser': 
      return CURSORS.laser;
    case 'draw:eraser': 
      return CURSORS.eraser;
    case 'text': 
      return 'text';
    case 'note': 
      return 'copy';
    case 'select': 
      // AUTO-SWITCH: If we are in select mode but hovering over background, show hand
      return isHoveringContent ? 'default' : 'grab';
    default:
      if (activeTool === 'shape' || activeTool.startsWith('shape:')) return 'crosshair';
      return 'default';
  }
};
