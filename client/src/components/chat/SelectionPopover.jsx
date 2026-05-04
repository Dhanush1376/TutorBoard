import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

/**
 * SelectionPopover — ChatGPT-style floating action menu.
 * Appears when user selects text within the chat window or markdown content.
 */
const SelectionPopover = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selection, setSelection] = useState('');
  const popoverRef = useRef(null);

  const { setChatInputText, setSidebarOpen, setSelectedTextContext } = useTutorStore();

  useEffect(() => {
    const handleSelection = () => {
      try {
        const sel = window.getSelection();
        const selectedText = sel.toString().trim();

        if (selectedText && selectedText.length > 2) {
          if (sel.rangeCount === 0) return;
          const range = sel.getRangeAt(0);
          
          // Only show if selection is within a "chat-window" or "markdown-content" container
          let container = range.commonAncestorContainer;
          if (container.nodeType === 3) container = container.parentNode;
          
          const isValidArea = container.closest('.chat-window, .markdown-content, .message-bubble');
          if (!isValidArea) {
            setIsVisible(false);
            return;
          }

          // Don't show if selecting inside an input or button
          if (container.closest('button, input, textarea, .no-select')) {
            setIsVisible(false);
            return;
          }

          const rect = range.getBoundingClientRect();
          
          // Position popover above the selection, centered
          setPosition({
            top: rect.top + window.scrollY - 45,
            left: rect.left + window.scrollX + (rect.width / 2)
          });
          setSelection(selectedText);
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } catch (err) {
        console.warn('[SelectionPopover] Error handling selection:', err);
        setIsVisible(false);
      }
    };

    const handleMouseUp = () => {
      // Small delay to ensure window.getSelection() is populated
      setTimeout(handleSelection, 10);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keyup', handleSelection); // Support keyboard selection

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keyup', handleSelection);
    };
  }, []);

  const handleAsk = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (selection) {
      setSelectedTextContext(selection);
      setSidebarOpen(true);
      setIsVisible(false);
      
      // Clear the selection for better UX
      try {
        window.getSelection().removeAllRanges();
      } catch (err) {}
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="pointer-events-auto"
        >
          <button
            onClick={handleAsk}
            onMouseDown={(e) => e.preventDefault()}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-lg transition-all hover:bg-[var(--text-primary)] hover:scale-105 active:scale-95 group border border-[var(--border-color)]/20"
            style={{
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              opacity: 1,
            }}
          >
            <Quote size={11} className="fill-current" />
            <span className="text-[10px] font-medium tracking-tight">Ask</span>
            
            {/* The Arrow (Pointer) */}
            <div 
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -z-10"
              style={{ backgroundColor: 'var(--text-primary)' }}
            />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SelectionPopover;
