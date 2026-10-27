import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * GlobalTooltip
 * Replaces the ugly OS/browser default tooltip (caused by [title] attribute)
 * with a sleek, cinematic, glassmorphic tooltip throughout the application.
 */
export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState({
    visible: false,
    text: '',
    x: 0,
    y: 0,
    placement: 'bottom',
  });

  const hideTimerRef = useRef(null);
  const showTimerRef = useRef(null);
  const targetElementRef = useRef(null);

  useEffect(() => {
    const handleMouseOver = (e) => {
      // Find closest element with title or data-tb-tooltip
      const target = e.target.closest('[title], [data-tb-tooltip]');
      if (!target) return;

      // If it has title, stash it in data-tb-tooltip and clear title so the browser tooltip won't trigger
      let text = target.getAttribute('data-tb-tooltip');
      const rawTitle = target.getAttribute('title');

      if (rawTitle) {
        text = rawTitle.trim();
        target.setAttribute('data-tb-tooltip', text);
        target.removeAttribute('title');
      }

      if (!text) return;

      // Do not display raw JSON objects/arrays or huge blobs as hovering tooltips to avoid screen clutter
      const trimmed = text.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')) || trimmed.length > 120) {
        return;
      }

      targetElementRef.current = target;

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }

      showTimerRef.current = setTimeout(() => {
        if (!targetElementRef.current) return;
        const rect = target.getBoundingClientRect();

        // Determine best placement based on space & element orientation
        // If element is along left edge (like the zoom toolbar or left rail), show to the right
        let placement = 'bottom';
        let x = 0;
        let y = 0;

        if (rect.left < 90 && rect.right + 180 < window.innerWidth) {
          placement = 'right';
          x = rect.right + 10;
          y = rect.top + rect.height / 2;
        } else if (rect.right > window.innerWidth - 90 && rect.left - 180 > 0) {
          placement = 'left';
          x = rect.left - 10;
          y = rect.top + rect.height / 2;
        } else if (rect.top - 36 > 0) {
          placement = 'top';
          x = Math.max(70, Math.min(window.innerWidth - 70, rect.left + rect.width / 2));
          y = rect.top - 8;
        } else {
          placement = 'bottom';
          x = Math.max(70, Math.min(window.innerWidth - 70, rect.left + rect.width / 2));
          y = rect.bottom + 8;
        }

        setTooltip({
          visible: true,
          text,
          x,
          y,
          placement,
        });
      }, 120);
    };

    const handleMouseOut = (e) => {
      const target = e.target.closest('[data-tb-tooltip]');
      if (!target) return;

      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      targetElementRef.current = null;
      hideTimerRef.current = setTimeout(() => {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }, 50);
    };

    const handleMouseDown = () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const handleScroll = () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener('mouseover', handleMouseOver, { capture: true, passive: true });
    window.addEventListener('mouseout', handleMouseOut, { capture: true, passive: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true, passive: true });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('mouseover', handleMouseOver, { capture: true });
      window.removeEventListener('mouseout', handleMouseOut, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('scroll', handleScroll, { capture: true });
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const getTransform = (placement) => {
    switch (placement) {
      case 'right': return 'translate(0, -50%)';
      case 'left': return 'translate(-100%, -50%)';
      case 'top': return 'translate(-50%, -100%)';
      default: return 'translate(-50%, 0)';
    }
  };

  const getInitialOffset = (placement) => {
    switch (placement) {
      case 'right': return { x: -4, y: 0 };
      case 'left': return { x: 4, y: 0 };
      case 'top': return { x: 0, y: 4 };
      default: return { x: 0, y: -4 };
    }
  };

  return (
    <AnimatePresence>
      {tooltip.visible && tooltip.text && (
        // The wrapper owns placement: framer-motion rewrites `transform` on the element it animates,
        // which used to drop the -100% shift and push left/top tooltips onto their target and off-screen
        <div
          key="global-tooltip"
          className="fixed z-[100000] pointer-events-none select-none max-w-[280px]"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: getTransform(tooltip.placement),
          }}
        >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, ...getInitialOffset(tooltip.placement) }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Subtle, soft glassmorphic pill - not overly dark or harsh */}
          <div className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-medium tracking-normal text-zinc-300 dark:text-zinc-200 bg-zinc-900/80 dark:bg-zinc-800/85 backdrop-blur-md border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)] whitespace-nowrap">
            {tooltip.text.includes('(') ? (
              <>
                <span className="leading-none">{tooltip.text.split('(')[0].trim()}</span>
                <span className="min-w-[17px] h-[17px] px-1 flex items-center justify-center text-[9.5px] font-mono text-zinc-400 dark:text-zinc-300 rounded-full bg-white/8 border border-white/5 leading-none">
                  {tooltip.text.match(/\((.*?)\)/)?.[1] || ''}
                </span>
              </>
            ) : (
              <span className="pr-1.5 leading-none">{tooltip.text}</span>
            )}
          </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
