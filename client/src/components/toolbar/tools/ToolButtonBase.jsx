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
  const { activeTool, setActiveTool, editingObjectId, layoutView, isInteracting } = useTutorStore();
  const hasVariants = Array.isArray(variants) && variants.length > 0;
  const isLeftHand = layoutView === 'left';
  const [isHovered, setIsHovered] = useState(false);
  const [isShortcutOpen, setIsShortcutOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false); // NEW: Sticky menu state
  const shortcutTimerRef = useRef(null);

  // Track this group's "last used" variant, defaulting to the first variant or the group itself.
  const [activeVariantId, setActiveVariantId] = useState(variants ? variants[0].id : id);

  // If the global active tool changes to a tool NOT in this group, reset local pin state
  useEffect(() => {
    const isOurTool = hasVariants
      ? variants.some(v => v.id === activeTool)
      : (activeTool === id || (customSubmenu && activeTool.startsWith(`${id}:`)));

    if (!isOurTool) setIsPinned(false);
  }, [activeTool]);

  // If the global active tool changes to one of our variants (e.g. via keyboard shortcut),
  // update our local active variant pointer.
  useEffect(() => {
    if (variants && variants.some(v => v.id === activeTool)) {
      setActiveVariantId(activeTool);
    }
  }, [activeTool, variants]);


  // Only show menu if pinned (clicked), forced, or via shortcut
  const showVariantsMenu = (isPinned || forceOpenSubmenu || isShortcutOpen) && !disabled && (hasVariants || customSubmenu);
  const showTooltip = isHovered && !disabled && !hasVariants && !customSubmenu;

  const [menuOffset, setMenuOffset] = useState(0);
  const menuRef = useRef(null);

  // EDGE-AWARE POSITIONING: Prevent submenus from going off-screen
  useEffect(() => {
    if (showVariantsMenu && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 12; // Screen edge padding
      let offset = 0;

      if (rect.left < padding) {
        offset = padding - rect.left;
      } else if (rect.right > window.innerWidth - padding) {
        offset = window.innerWidth - padding - rect.right;
      }

      if (offset !== 0) setMenuOffset(offset);
      else setMenuOffset(0);
    }
  }, [showVariantsMenu]);

  const isGroupActive = hasVariants
    ? variants.some(v => v.id === activeTool)
    : (activeTool === id || (customSubmenu && activeTool.startsWith(`${id}:`)));

  // Determine what to display natively
  const currentVariant = hasVariants ? variants.find(v => v.id === activeVariantId) : null;
  const DisplayIcon = currentVariant ? currentVariant.icon : DefaultIcon;
  const displayLabel = currentVariant ? currentVariant.label : defaultLabel;

  const handleMainClick = () => {
    if (disabled) return;

    // Toggle menu visibility on click for tools with sub-variants
    if (hasVariants || customSubmenu) {
      setIsPinned(!isPinned);
    }

    if (typeof onClick === 'function') {
      onClick();
    } else {
      // DESELECT LOGIC: Toggle off if already active
      if (activeTool === activeVariantId) {
        setActiveTool('select');
      } else {
        setActiveTool(activeVariantId);
      }
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

    setIsHovered(false);
    setIsPinned(false); // Close menu on specific selection
  };

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: 'var(--tool-size)', height: 'var(--tool-size)', isolation: 'isolate' }}
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
        aria-label={displayLabel}
        aria-pressed={isGroupActive}
        title=""
        className="relative w-full h-full flex items-center justify-center rounded-full transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]/40"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
        }}
      >
        {(isHovered || isHoveredExternally) && !isGroupActive && !isInteracting && !disabled && (
          <motion.div
            layoutId="liquid-hover-pill"
            className="absolute inset-0.9 rounded-full z-0"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
          />
        )}

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

        {/* Tiny dropdown indicator if variants or custom submenu exist */}
        {(hasVariants || customSubmenu) && (
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
            className={`absolute top-full mt-2.5 z-[9999] pointer-events-none ${isLeftHand ? 'left-0' : 'right-0'}`}
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
                className="text-[11px] font-normal tracking-wide"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}
              >
                {displayLabel}
              </span>
              {/* Shortcut badges removed */}
            </div>
            {/* Tooltip caret */}
            <div
              className={`absolute -top-1 w-2 h-2 rotate-45 ${isLeftHand ? 'left-4' : 'right-4'}`}
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
            ref={menuRef}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: menuOffset
            }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            className={`absolute top-full z-[9999] pt-2 ${isLeftHand ? 'left-0' : 'right-0'}`}
          >
            {/* Interaction Bridge: Prevents onMouseLeave from firing in the gap between button and panel */}
            <div className="absolute inset-x-0 -top-2 h-4 pointer-events-auto" />

            <div
              className="flex flex-col p-1 rounded-xl"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)',
                minWidth: customSubmenu ? 'auto' : 160,
              }}
            >
              {customSubmenu ? (
                React.isValidElement(customSubmenu)
                  ? React.cloneElement(customSubmenu, { closeMenu: () => setIsHovered(false) })
                  : customSubmenu
              ) : (
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
                        className="flex-1 text-[12px] font-normal transition-colors"
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

                      {/* Shortcut removed */}
                    </button>
                  )
                })
              )}
            </div>

            {/* Submenu Caret - Shifted to stay above the button center */}
            <div
              className={`absolute -top-1.5 w-3 h-3 rotate-45 ${isLeftHand ? 'left-4' : 'right-4'}`}
              style={{
                background: 'var(--bg-primary)',
                borderLeft: '1px solid var(--border-color)',
                borderTop: '1px solid var(--border-color)',
                zIndex: -1
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolButtonBase;
