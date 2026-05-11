/**
 * Tooltip.jsx — TutorBoard Primitive Tooltip
 * 
 * Lightweight hover/focus tooltip using CSS-only approach.
 * No JS library dependency.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const POSITIONS = {
  top:    { initial: { opacity: 0, y: 4 }, style: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 } },
  bottom: { initial: { opacity: 0, y: -4 }, style: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 } },
  left:   { initial: { opacity: 0, x: 4 }, style: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 } },
  right:  { initial: { opacity: 0, x: -4 }, style: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 } },
};

const Tooltip = ({
  content,
  position = 'top',
  delay = 200,
  children,
  className = '',
}) => {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  const pos = POSITIONS[position] || POSITIONS.top;

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  if (!content) return children;

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, ...pos.initial }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[9999] pointer-events-none"
            style={pos.style}
          >
            <div
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shadow-lg"
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              role="tooltip"
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;
