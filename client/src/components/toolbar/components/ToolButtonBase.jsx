import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../../store/tutorStore';

/**
 * ToolButtonBase
 *
 * Figma/Canvas-grade mutually exclusive tool button, now with Submenu support!
 * - Shared layout animation for the active pill
 * - Keyboard shortcut binding via useEffect
 * - Tooltip with shortcut badge
 * - Hover submenu for tool variants (Shape, Draw)
 */
const ToolButtonBase = ({ id, icon: DefaultIcon, label: defaultLabel, shortcut, disabled = false, variants, customSubmenu, forceOpenSubmenu, onClick, onMouseEnter, onMouseLeave, isHoveredExternally }) => {
  const { activeTool, setActiveTool } = useTutorStore();
  const [isHovered, setIsHovered] = useState(false);
  
  // Track this group's "last used" variant, defaulting to the first variant or the group itself.
  const [activeVariantId, setActiveVariantId] = useState(variants ? variants[0].id : id);

  // If the global active tool changes to one of our variants (e.g. via keyboard shortcut),
  // update our local active variant pointer.
  useEffect(() => {
    if (variants && variants.some(v => v.id === activeTool)) {
      setActiveVariantId(activeTool);
    }
  }, [activeTool, variants]);

  const hasVariants = Array.isArray(variants) && variants.length > 0;
  
  // Determine if this group is currently active
  const isGroupActive = hasVariants 
    ? variants.some(v => v.id === activeTool)
    : activeTool === id;

  // Determine what to display natively
  const currentVariant = hasVariants ? variants.find(v => v.id === activeVariantId) : null;
  const DisplayIcon = currentVariant ? currentVariant.icon : DefaultIcon;
  const displayLabel = currentVariant ? currentVariant.label : defaultLabel;

  // Global keyboard shortcut binding
  useEffect(() => {
    if (disabled) return;
    
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      
      // Handle base tool shortcut
      if (shortcut && e.key.toUpperCase() === shortcut.toUpperCase() && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setActiveTool(activeVariantId);
      }
      
      // Handle variant shortcuts
      if (hasVariants) {
        variants.forEach(variant => {
          if (variant.shortcut && e.key.toUpperCase() === variant.shortcut.toUpperCase() && !e.ctrlKey && !e.metaKey && !e.altKey) {
            setActiveTool(variant.id);
            setActiveVariantId(variant.id);
          }
        });
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcut, activeVariantId, disabled, setActiveTool, hasVariants, variants]);

  const handleMainClick = () => {
    if (disabled) return;
    if (typeof onClick === 'function') {
      onClick();
    } else {
      setActiveTool(activeVariantId);
    }
  };

  const handleVariantClick = (e, variant) => {
    e.stopPropagation();
    if (disabled) return;
    
    if (typeof variant.onSelect === 'function') {
      variant.onSelect();
    } else {
      setActiveTool(variant.id);
      setActiveVariantId(variant.id);
    }
    
    setIsHovered(false); // Close menu on click
  };

  // Only show tooltip if NOT showing variants menu
  const showTooltip = isHovered && !disabled && !hasVariants && !customSubmenu;
  const showVariantsMenu = (isHovered || forceOpenSubmenu) && !disabled && (hasVariants || customSubmenu);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: 36, height: 36, isolation: 'isolate' }}
      onMouseEnter={() => {
        if (!disabled) {
          setIsHovered(true);
          onMouseEnter?.(id);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave?.();
      }}
    >
      <motion.button
        whileHover={!disabled ? { y: -1 } : {}}
        whileTap={!disabled ? { scale: 0.93 } : {}}
        onClick={handleMainClick}
        disabled={disabled}
        aria-label={`${displayLabel}${shortcut ? ` (${shortcut})` : ''}`}
        aria-pressed={isGroupActive}
        title=""
        className="relative w-full h-full flex items-center justify-center rounded-full transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]/40"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
        }}
      >
        {/* Shared Liquid Hover Pill */}
        {isHovered && !disabled && (
          <motion.div
            layoutId="liquid-hover-pill"
            className="absolute inset-0 rounded-full z-0"
            style={{ 
              background: 'rgba(255, 255, 255, 0.08)',
              boxShadow: '0 0 15px rgba(255,255,255,0.02)'
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
          />
        )}

        {/* Shared layout active background pill */}
        {isGroupActive && (
          <motion.div
            layoutId="active-tool-pill"
            className="absolute inset-0 rounded-full z-0"
            style={{ background: 'var(--text-primary)' }}
            initial={false}
            transition={{ type: 'spring', stiffness: 600, damping: 38 }}
          />
        )}

        <span
          className="relative z-10 flex items-center justify-center"
          style={{
            color: isGroupActive
              ? 'var(--bg-primary)'
              : (isHovered || isHoveredExternally)
              ? 'var(--text-primary)'
              : 'var(--text-tertiary)',
            transition: 'color 0.15s ease',
          }}
        >
          <DisplayIcon size={17} strokeWidth={isGroupActive ? 2.2 : 1.9} />
        </span>
        
        {/* Tiny dropdown indicator if variants exist */}
        {hasVariants && (
           <div 
             className="absolute bottom-1 right-1 w-0 h-0" 
             style={{
               borderLeft: '3px solid transparent',
               borderRight: '3px solid transparent',
               borderBottom: `3px solid ${isGroupActive ? 'var(--bg-primary)' : 'var(--text-tertiary)'}`,
               opacity: 0.6,
               transform: 'rotate(135deg)'
             }}
           />
        )}
      </motion.button>

      {/* Basic Tooltip (Only if no variants) */}
      <AnimatePresence>
        {showTooltip && (
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
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)',
              }}
            >
              <span
                className="text-[11px] font-semibold tracking-wide"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}
              >
                {displayLabel}
              </span>
              {shortcut && (
                <span
                  className="flex items-center justify-center rounded-md text-[10px] font-bold"
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {shortcut}
                </span>
              )}
            </div>
            {/* Tooltip caret */}
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
              style={{
                background: 'var(--bg-primary)',
                borderLeft: '1px solid var(--border-color)',
                borderTop: '1px solid var(--border-color)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Submenu for Variants */}
      <AnimatePresence>
        {showVariantsMenu && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            role="menu"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[9999]"
          >
            <div
              className="flex flex-col p-1 rounded-xl"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)',
                backdropFilter: 'blur(20px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                minWidth: customSubmenu ? 'auto' : 160,
              }}
            >
              {customSubmenu ? customSubmenu : (
                variants.map((variant) => {
                  const isVariantActive = variant.activeState !== undefined 
                    ? variant.activeState 
                    : activeTool === variant.id;

                  return (
                    <button
                      key={variant.id}
                      onClick={(e) => handleVariantClick(e, variant)}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all relative outline-none group/item"
                      style={{ 
                        minWidth: 160,
                        background: isVariantActive ? 'rgba(var(--text-primary-rgb, 255,255,255), 0.05)' : 'transparent'
                      }}
                    >
                      <span 
                        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-colors"
                        style={{ 
                          color: isVariantActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          background: isVariantActive ? 'var(--bg-secondary)' : 'transparent',
                          boxShadow: isVariantActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <variant.icon size={14} strokeWidth={isVariantActive ? 2.5 : 2} />
                      </span>
                      
                      <span 
                        className="flex-1 text-[12px] font-medium transition-colors"
                        style={{ color: isVariantActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {variant.label}
                      </span>
                      
                      {isVariantActive && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)]"
                        />
                      )}

                      {!isVariantActive && variant.shortcut && (
                        <span className="text-[10px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                          {variant.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
            
            {/* Submenu Caret */}
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45"
              style={{
                background: 'var(--bg-primary)',
                borderLeft: '1px solid var(--border-color)',
                borderTop: '1px solid var(--border-color)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolButtonBase;