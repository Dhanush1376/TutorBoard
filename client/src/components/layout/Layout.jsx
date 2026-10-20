import React from 'react';
import { PanelLeft, PanelRight, Maximize2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../toolbar/Toolbar';
import useTutorStore, { CANVAS_LAYOUT } from '../../store/tutorStore';
import useWindowSize from '../../hooks/useWindowSize';
const ArtifactPanel = React.lazy(() => import('../artifact/ArtifactPanel'));
import { useTheme } from '../../context/useTheme';

// V-3 FIX: Layout dimensions as CSS custom property defaults — can be overridden via @media or :root
const SIDEBAR_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--layout-sidebar-width') || '350');
const PANEL_GAP = 0;

// No border of its own: the canvas draws the dividing line, curved at the corners.
const sidebarStyle = {
  background: 'var(--bg-primary)',
};

const sidebarStyleRight = {
  background: 'var(--bg-primary)',
};

const miniGlass = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
};

const Layout = ({ sidebar, children, title = "TutorBoard", onBack, forceCollapse = false, isSplitView = false }) => {
  const navigate = useNavigate();
  const isSidebarOpen = useTutorStore(state => state.isSidebarOpen);
  const setSidebarOpen = useTutorStore(state => state.setSidebarOpen);
  const toggleSidebar = useTutorStore(state => state.toggleSidebar);
  const layoutView = useTutorStore(state => state.layoutView);
  const canvasLayout = useTutorStore(state => state.canvasLayout);
  const isArtifactPanelOpen = useTutorStore(state => state.isArtifactPanelOpen);
  const artifactPanelFullscreen = useTutorStore(state => state.artifactPanelFullscreen);
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const isRightHand = layoutView === 'right';
  const { user } = useAuth();
  const sidebarRef = React.useRef(null);

  // Responsive logic
  const { isMobile } = useWindowSize();
  const baseSidebarWidth = SIDEBAR_WIDTH; // Fixed width for chatbox as requested by user
  const currentSidebarWidth = isMobile ? '100%' : baseSidebarWidth;
  const sidebarVisible = isSidebarOpen && !forceCollapse;

  const isMinimap = canvasLayout === CANVAS_LAYOUT.MINIMAP;

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden m-0 p-0 flex"
      style={{
        flexDirection: isRightHand ? 'row-reverse' : 'row',
        background: 'var(--bg-primary)',
      }}
    >
      {/* -- MOBILE BACKDROP -- */}
      <AnimatePresence>
        {sidebarVisible && isMobile && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4999] bg-black/40 md:hidden"
            onClick={(e) => {
              if (sidebarRef.current) {
                const rect = sidebarRef.current.getBoundingClientRect();
                // If click is within sidebar boundaries, ignore it
                if (
                  e.clientX >= rect.left &&
                  e.clientX <= rect.right &&
                  e.clientY >= rect.top &&
                  e.clientY <= rect.bottom
                ) {
                  return;
                }
              }
              // Only close if it's truly outside
              setSidebarOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* -- SIDEBAR PANEL -- */}
      <motion.aside
        key="sidebar"
        ref={sidebarRef}
        initial={false}
        animate={{
          x: sidebarVisible ? 0 : (isRightHand ? '100%' : '-100%'),
          opacity: sidebarVisible ? 1 : 0,
          width: sidebarVisible ? currentSidebarWidth : (isMobile ? '100%' : 0)
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 0.8 }}
        onClick={(e) => {
          // Stop propagation to prevent hitting the backdrop
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          // Safety for mobile pointer events
          e.stopPropagation();
        }}
        className={`tb-sidebar flex-shrink-0 flex flex-col overflow-hidden h-full z-[5000] md:z-30 fixed md:relative ${sidebarVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{
          ...(isRightHand ? sidebarStyleRight : sidebarStyle),
          boxShadow: sidebarVisible && !isMobile
            ? (isDark
                ? `${isRightHand ? '-' : ''}18px 0 36px -14px rgba(0, 0, 0, 0.85)`
                : `${isRightHand ? '-' : ''}16px 0 32px -16px rgba(0, 0, 0, 0.16)`)
            : 'none',
        }}
      >
        <div className="h-full" style={{ width: isMobile ? '100%' : baseSidebarWidth }}>
          {sidebar}
        </div>
      </motion.aside>

      {/* -- MAIN CONTENT AREA -- */}
      <main
        className="relative flex-1 min-w-[320px] min-h-[400px] h-full overflow-hidden"
        // ACC-7: Prevent keyboard focus from escaping behind mobile sidebar overlay
        {...(sidebarVisible && isMobile ? { inert: '' } : {})}
        style={{
          padding: 0,
          background: 'var(--bg-primary)',
        }}
      >
        {/* The Actual Interactive Canvas + Artifact Panel */}
        {/* The canvas fills the space; the sidebar's edge shadow is what separates the two */}
        <div
          className="relative w-full h-full z-10 flex overflow-hidden"
          style={
            !isMobile && sidebarVisible
              ? {
                  // Rounded inward where it meets the sidebar; the top and bottom
                  // edges sit just off-screen so only the curved side line shows.
                  borderTopLeftRadius: isRightHand ? 0 : 22,
                  borderBottomLeftRadius: isRightHand ? 0 : 22,
                  borderTopRightRadius: isRightHand ? 22 : 0,
                  borderBottomRightRadius: isRightHand ? 22 : 0,
                  border: isDark 
                    ? '1px solid rgba(255, 255, 255, 0.28)' 
                    : '1px solid rgba(255, 255, 255, 0.65)',
                  [isRightHand ? 'borderRight' : 'borderLeft']: isDark 
                    ? '1px solid rgba(255, 255, 255, 0.45)' 
                    : '1px solid rgba(255, 255, 255, 0.85)',
                  [isRightHand ? 'borderLeft' : 'borderRight']: 'none',
                  boxShadow: isDark
                    ? `${isRightHand ? '' : '-'}1px 0 0 rgba(255, 255, 255, 0.4), inset ${isRightHand ? '-1px' : '1px'} 1px 0 rgba(255, 255, 255, 0.35)`
                    : `${isRightHand ? '' : '-'}1px 0 0 rgba(255, 255, 255, 0.8), inset ${isRightHand ? '-1px' : '1px'} 1px 0 rgba(255, 255, 255, 0.7)`,
                  marginTop: -1,
                  height: 'calc(100% + 2px)',
                  transition: 'border-radius 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                }
              : undefined
          }
        >
          <div className={`relative h-full overflow-hidden transition-all duration-300 ${isArtifactPanelOpen && !isMobile && !isMinimap ? 'flex-1 min-w-0' : 'w-full'}`}>
            {children}
          </div>
          {isArtifactPanelOpen && !isMobile && !isMinimap && (
            <div
              className="h-full overflow-hidden border-l border-[var(--border-color)]"
              style={{
                width: artifactPanelFullscreen ? '100%' : '50%',
                maxWidth: artifactPanelFullscreen ? 'none' : 800,
                minWidth: artifactPanelFullscreen ? 'none' : 380,
                zIndex: 20
              }}
            >
              <React.Suspense fallback={null}>
                <ArtifactPanel isDark={isDark} />
              </React.Suspense>
            </div>
          )}
        </div>

        {/* -- MINIMAP OVERLAY -- */}
        <AnimatePresence>
          {isArtifactPanelOpen && isMinimap && !isMobile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50, x: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50, x: 50 }}
              className="minimap-container liquid-glass shadow-premium"
            >
              <div className="w-full h-full scale-[0.35] origin-top-left" style={{ width: '285%', height: '285%' }}>
                <React.Suspense fallback={null}>
                  <ArtifactPanel isDark={isDark} />
                </React.Suspense>
              </div>
              {/* Click to restore overlay */}
              <button 
                onClick={() => useTutorStore.getState().toggleMinimap()}
                className="absolute inset-0 z-[100] group"
              >
                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center">
                   <div className="opacity-0 group-hover:opacity-100 bg-white/20 backdrop-blur-md rounded-full p-3 transform scale-90 group-hover:scale-100 transition-all">
                      <Maximize2 size={24} className="text-white" />
                   </div>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- MOBILE ARTIFACT OVERLAY -- */}
        <AnimatePresence>
          {isArtifactPanelOpen && isMobile && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[6000] bg-[var(--bg-primary)] flex flex-col"
            >
              <React.Suspense fallback={null}>
                <ArtifactPanel isDark={isDark} />
              </React.Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- PORTAL TARGETS -- */}
        <div id="radial-nav-portal" className="fixed inset-0 z-[6000] pointer-events-none" />

        {/* --- 5. UNIFIED TOP CONTROLS --- */}
        <div className={`absolute top-3 left-0 right-0 px-3 sm:top-5 sm:px-5 z-[50] pointer-events-none flex items-center justify-between gap-2 sm:gap-4 ${isRightHand ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Workspace Toggle Pill */}
          <div className="pointer-events-auto flex-shrink-0">
            <AnimatePresence>
              {!isSidebarOpen && !forceCollapse && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--glass-shadow)',
                    borderRadius: 'var(--radius-2xl)',
                    padding: isMobile ? '4px' : '6px 10px',
                  }}
                >
                  <button
                    onClick={toggleSidebar}
                    aria-label={isSidebarOpen ? 'Close workspace' : 'Open workspace'}
                    className="flex items-center gap-2 rounded-xl p-2 transition-all hover:bg-[var(--bg-tertiary)]/40 md:px-3"
                  >
                    {isSidebarOpen ? <PanelRight size={16} strokeWidth={1.8} /> : <PanelLeft size={16} strokeWidth={1.8} />}
                    <span className="hidden text-[13px] font-medium tracking-[-0.01em] text-[var(--text-secondary)] md:block">
                      {isSidebarOpen ? 'Close' : 'Workspace'}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Toolbar */}
          <div
            className={`pointer-events-auto transition-all duration-500 flex-1 min-w-0 flex ${isRightHand ? 'justify-start' : 'justify-end'} ${isSidebarOpen && isMobile ? 'opacity-0 pointer-events-none -translate-y-10' : 'opacity-100'}`}
          >
            <div className="w-fit min-w-0 max-w-full">
              <Toolbar
                onSettingsClick={() => useTutorStore.getState().setOverlay('settings')}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
