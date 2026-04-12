import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * ActionButtonBase
 *
 * Figma/Canvas-grade stateless action button (Share, Delete).
 * - Immediate effect + 2s success state with spring morphing
 * - Destructive variant uses red semantic color
 * - Accessible tooltip with consistent spring physics
 */
const ActionButtonBase = ({
  id,
  icon: Icon,
  label,
  successLabel = 'Done',
  isDestructive = false,
  onClick,
  disabled = false,
  onMouseEnter,
  onMouseLeave,
  isHoveredExternally,
  customSubmenu
}) => {
  const [didAction, setDidAction] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    if (customSubmenu) {
      setIsMenuOpen(!isMenuOpen);
    } else {
      if (onClick) onClick();
      setDidAction(true);
      setTimeout(() => setDidAction(false), 2000);
    }
  };

  const showSuccess = didAction && !isDestructive;
  const showMenu = isMenuOpen && customSubmenu;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: 36, height: 36 }}
      onMouseEnter={() => {
        if (!disabled) {
          setIsHovered(true);
          onMouseEnter?.(id || label);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false); // Auto-close on leave
        onMouseLeave?.();
      }}
    >
      <motion.button
        whileHover={!disabled ? { y: -1 } : {}}
        whileTap={!disabled ? { scale: 0.93 } : {}}
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        title=""
        className="relative w-full h-full flex items-center justify-center rounded-[9px] outline-none focus-visible:ring-2 transition-colors duration-150"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          background: showSuccess ? 'rgba(34,197,94,0.12)' : (showMenu ? 'rgba(255,255,255,0.06)' : 'transparent'),
          focusVisibleRingColor: isDestructive ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)',
        }}
      >


        {/* Shared Liquid Hover Pill */}
        {isHovered && !disabled && !showSuccess && !showMenu && (
          <motion.div
            layoutId="liquid-hover-pill"
            className="absolute inset-0 rounded-full z-0"
            style={{ 
              background: isDestructive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.08)',
              boxShadow: '0 0 15px rgba(255,255,255,0.02)'
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
          />
        )}

        {/* Success / Selection ring */}
        {(showSuccess || showMenu) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 rounded-[9px] z-0"
            style={{
              boxShadow: showSuccess 
                ? 'inset 0 0 0 1px rgba(34,197,94,0.35)' 
                : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
              background: showSuccess ? 'rgba(34,197,94,0.1)' : 'transparent',
            }}
          />
        )}

        <div className="relative z-10 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              >
                <Check size={15} strokeWidth={2.5} style={{ color: 'rgb(34,197,94)' }} />
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="flex items-center justify-center"
              >
                <Icon
                  size={16}
                  strokeWidth={1.9}
                  style={{
                    color: isDestructive
                      ? (isHovered || isHoveredExternally) ? 'rgb(239,68,68)' : 'var(--text-tertiary)'
                      : (isHovered || isHoveredExternally || showMenu)
                      ? 'var(--text-primary)'
                      : 'var(--text-tertiary)',
                    transition: 'color 0.15s ease',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {/* Action Submenu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            className="absolute top-full right-0 mt-3 z-[9999]"
          >
            <div 
              className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
              style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}
              onMouseEnter={() => setIsMenuOpen(true)}
            >
              {React.cloneElement(customSubmenu, { 
                onMouseLeave: () => {
                  setIsHovered(false);
                  setIsMenuOpen(false);
                }
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && !disabled && !showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 600, damping: 32, mass: 0.6 }}
            role="tooltip"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 z-[9999] pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg whitespace-nowrap"
              style={{
                background: isDestructive
                  ? 'rgba(220,38,38,0.92)'
                  : showSuccess
                  ? 'rgba(22,163,74,0.92)'
                  : 'var(--bg-primary)',
                border: `1px solid ${
                  isDestructive
                    ? 'rgba(239,68,68,0.25)'
                    : showSuccess
                    ? 'rgba(34,197,94,0.25)'
                    : 'var(--border-color)'
                }`,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span
                className="text-[11px] font-semibold tracking-wide"
                style={{
                  color: isDestructive || showSuccess ? '#fff' : 'var(--text-primary)',
                  letterSpacing: '0.04em',
                }}
              >
                {showSuccess ? successLabel : label}
              </span>
            </div>
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
              style={{
                background: isDestructive
                  ? 'rgba(220,38,38,0.92)'
                  : showSuccess
                  ? 'rgba(22,163,74,0.92)'
                  : 'var(--bg-primary)',
                borderLeft: `1px solid ${isDestructive ? 'rgba(239,68,68,0.25)' : showSuccess ? 'rgba(34,197,94,0.25)' : 'var(--border-color)'}`,
                borderTop: `1px solid ${isDestructive ? 'rgba(239,68,68,0.25)' : showSuccess ? 'rgba(34,197,94,0.25)' : 'var(--border-color)'}`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActionButtonBase;