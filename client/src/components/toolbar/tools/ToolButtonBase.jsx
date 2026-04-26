import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../../store/tutorStore';
import useWindowSize from '../../../hooks/useWindowSize';

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

  const { isMobile } = useWindowSize();
  const btnSize = isMobile ? 32 : 40;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: `${btnSize}px`, height: `${btnSize}px`, isolation: 'isolate' }}
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
        whileTap={!disabled ? { scale: 0.92 } : {}}
        onClick={handleMainClick}
        disabled={disabled}
        aria-label={displayLabel}
        aria-pressed={isGroupActive}
        title=""
        className="relative w-full h-full flex items-center justify-center rounded-[12px] md:rounded-2xl transition-all duration-200 outline-none"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
        }}
      >
        {(isHovered || isHoveredExternally) && !isGroupActive && !isInteracting && !disabled && (
          <motion.div
            layoutId="liquid-hover-pill"
            className="absolute inset-[1.5px] rounded-[10px] md:rounded-[14px] z-0"
            style={{
              background: 'var(--bg-tertiary)cc',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 0 8px rgba(255,255,255,0.03)',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
          />
        )}

        {isGroupActive && (
          <motion.div
            layoutId="active-tool-pill"
            className="absolute inset-[1.5px] rounded-[10px] md:rounded-[14px] z-0"
            style={{ 
              background: 'var(--text-primary)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
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
            transition: 'color 0.2s ease',
          }}
        >
          <DisplayIcon size={isMobile ? 15 : 18} strokeWidth={isGroupActive ? 2.2 : 2} />
        </span>

        {/* Subtle dropdown indicator - only show if NOT active to avoid clutter */}
        {(hasVariants || customSubmenu) && !isGroupActive && (
          <div
            className="absolute bottom-1.5 right-1.5 w-1 h-1 rounded-full"
            style={{ 
              background: 'var(--text-tertiary)',
              opacity: 0.6,
              transform: isPinned ? 'scale(1.2)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl whitespace-nowrap"
              style={{
                background: 'rgba(var(--bg-primary-rgb), 0.85)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                fontFamily: 'var(--global-font)'
              }}
            >
              <span
                className="text-[11px] font-semibold tracking-tight"
                style={{ color: 'var(--text-primary)', letterSpacing: '0.01em' }}
              >
                {displayLabel}
              </span>
            </div>
            {/* Tooltip caret removed for a cleaner glass look */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Submenu for Variants */}
      <AnimatePresence>
        {showVariantsMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 8, scale: 0.96, x: '-50%' }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: menuOffset !== 0 ? `calc(-50% + ${menuOffset}px)` : '-50%'
            }}
            exit={{ opacity: 0, y: 6, scale: 0.98, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            className="absolute top-full left-1/2 z-[9999] pt-2"
          >
            {/* Interaction Bridge */}
            <div className="absolute inset-x-0 -top-2 h-4 pointer-events-auto" />

            <div
              className="flex flex-col p-1.5 rounded-2xl"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.1)',
                minWidth: customSubmenu ? 'auto' : 200,
                fontFamily: '"Outfit", sans-serif'
              }}
            >
              {customSubmenu ? (
                typeof customSubmenu.type === 'string'
                  ? customSubmenu
                  : React.isValidElement(customSubmenu)
                    ? React.cloneElement(customSubmenu, { closeMenu: () => setIsPinned(false) })
                    : customSubmenu
              ) : (
                variants.map((variant) => {
                  const isVariantActive = variant.activeState !== undefined
                    ? variant.activeState
                    : activeTool === variant.id;

                  return (
                    <motion.button
                      key={variant.id}
                      onClick={(e) => handleVariantClick(e, variant)}
                      onMouseEnter={() => setHoveredId(variant.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative outline-none group/item"
                      style={{
                        minWidth: 180,
                        background: 'transparent'
                      }}
                    >
                      {/* Submenu Item Hover Pill */}
                      {hoveredId === variant.id && !isVariantActive && (
                        <motion.div
                          layoutId={`submenu-hover-${id}`}
                          className="absolute inset-0 bg-[var(--bg-tertiary)]/50 rounded-xl z-0"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}

                      <span
                        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors relative z-10"
                        style={{
                          color: isVariantActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          background: isVariantActive ? 'var(--bg-primary)' : 'transparent',
                          boxShadow: isVariantActive ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
                          border: isVariantActive ? '1px solid var(--border-color)' : '1px solid transparent'
                        }}
                      >
                        <variant.icon size={16} strokeWidth={isVariantActive ? 2.5 : 2} />
                      </span>

                      <div className="flex-1 flex flex-col relative z-10">
                        <span
                          className="text-[13px] font-medium transition-colors"
                          style={{ color: isVariantActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                        >
                          {variant.label}
                        </span>
                        {variant.description && (
                          <span className="text-[10px] text-[var(--text-tertiary)] opacity-70">
                            {variant.description}
                          </span>
                        )}
                      </div>

                      {isVariantActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] shadow-[0_0_8px_rgba(var(--text-primary-rgb),0.5)]"
                        />
                      )}
                    </motion.button>
                  )
                })
              )}
            </div>

            {/* Submenu Caret removed for cleaner look and to avoid overlapping glitches */}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToolButtonBase;
