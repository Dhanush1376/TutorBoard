import { useEffect } from 'react';
import useTutorStore from '../store/tutorStore';
import { useTeachingMachine } from './useTeachingMachine';

/**
 * useKeyboardShortcuts
 * Global hook to handle app-wide keyboard shortcuts.
 */
export function useKeyboardShortcuts() {
  const { 
    activeTool, 
    setActiveTool, 
    deselectAll, 
    undo, 
    redo,
    isPlaying,
    activeOverlay,
    setOverlay
  } = useTutorStore();

  const { play, pause, nextStep, prevStep } = useTeachingMachine();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Skip if the user is typing in an input, textarea, or contentEditable element
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;
      
      if (isInput) return;

      // 2. Map keys to actions
      switch (e.key) {
        case ' ': // Space: Toggle Play/Pause
          e.preventDefault();
          if (isPlaying) {
            pause();
          } else {
            play();
          }
          break;

        case 'ArrowRight': // Right: Next Step
          e.preventDefault();
          nextStep();
          break;

        case 'ArrowLeft': // Left: Previous Step
          e.preventDefault();
          prevStep();
          break;

        case 'Escape': // Esc: Deselect or Close Overlay
          e.preventDefault();
          if (activeOverlay) {
            setOverlay(null);
          } else {
            deselectAll();
          }
          break;

        case 'v':
        case 'V': // V: Select Tool
          setActiveTool('select');
          break;

        case 'z':
        case 'Z': // Cmd/Ctrl+Z: Undo / Redo
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying, play, pause, nextStep, prevStep, 
    activeTool, setActiveTool, deselectAll, undo, redo,
    activeOverlay, setOverlay
  ]);
}

export default useKeyboardShortcuts;
