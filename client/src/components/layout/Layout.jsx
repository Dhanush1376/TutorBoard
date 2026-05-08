import React from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../toolbar/Toolbar';
import useTutorStore from '../../store/tutorStore';
import useWindowSize from '../../hooks/useWindowSize';
import ArtifactPanel from '../artifact/ArtifactPanel';
import { useTheme } from '../../context/ThemeContext';

const SIDEBAR_WIDTH = 350;
const PANEL_RADIUS = 28;
const PANEL_GAP = 0;

const sidebarStyle = {
  background: 'transparent',
};

const sidebarStyleRight = {
  background: 'transparent',
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

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden m-0 p-0 flex"
      style={{
        flexDirection: isRightHand ? 'row-reverse' : 'row',
        background: 'var(--bg-primary)',
      }}
    >
      {/* ── MOBILE BACKDROP ── */}
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

      {/* ── SIDEBAR PANEL ── */}
      <AnimatePresence initial={false}>
        {sidebarVisible && (
          <motion.aside
            key="sidebar"
            ref={sidebarRef}
            initial={{
              x: isRightHand ? '100%' : '-100%',
              opacity: 0.5,
              width: isMobile ? '100%' : 0
            }}
            animate={{
              x: 0,
              opacity: 1,
              width: currentSidebarWidth
            }}
            exit={{
              x: isRightHand ? '100%' : '-100%',
              opacity: 0,
              width: isMobile ? '100%' : 0
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
            className="tb-sidebar flex-shrink-0 flex flex-col overflow-hidden h-full z-[5000] md:z-auto fixed md:relative pointer-events-auto"
            style={{
              ...(isRightHand ? sidebarStyleRight : sidebarStyle),
              boxShadow: isMobile ? '0 0 40px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            <div className="w-full h-full">
              {sidebar}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT AREA ── */}
      <main
        className="relative flex-1 min-w-0 h-full overflow-hidden"
        style={{
          padding: 0,
          background: 'var(--bg-primary)',
        }}
      >
        {/* Floating Glass Layer (Decorative) */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-all duration-500"
          style={{
            margin: 0,
            borderRadius: 0,
            borderTopLeftRadius: !isMobile && !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomLeftRadius: !isMobile && !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderTopRightRadius: !isMobile && isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomRightRadius: !isMobile && isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: 'none',
          }}
        />

        {/* The Actual Interactive Canvas + Artifact Panel */}
        <div
          className="relative w-full h-full z-10 flex"
          style={{
            borderRadius: 0,
            borderTopLeftRadius: !isMobile && !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomLeftRadius: !isMobile && !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderTopRightRadius: !isMobile && isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomRightRadius: !isMobile && isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            overflow: 'hidden',
            borderLeft: !isMobile && !isRightHand && sidebarVisible ? 'var(--glass-border-width) solid var(--border-color)' : 'none',
            borderRight: !isMobile && isRightHand && sidebarVisible ? 'var(--glass-border-width) solid var(--border-color)' : 'none',
          }}
        >
          <div className={`relative h-full overflow-hidden transition-all duration-300 ${isArtifactPanelOpen && !isMobile ? 'flex-1 min-w-0' : 'w-full'}`}>
            {children}
          </div>
          {isArtifactPanelOpen && !isMobile && (
            <div
              className="h-full overflow-hidden border-l border-[var(--border-color)]"
              style={{
                width: artifactPanelFullscreen ? '100%' : '50%',
                maxWidth: artifactPanelFullscreen ? 'none' : 800,
                minWidth: artifactPanelFullscreen ? 'none' : 380,
                zIndex: 20
              }}
            >
              <ArtifactPanel isDark={isDark} />
            </div>
          )}
        </div>

        {/* ── MOBILE ARTIFACT OVERLAY ── */}
        <AnimatePresence>
          {isArtifactPanelOpen && isMobile && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[6000] bg-[var(--bg-primary)] flex flex-col"
            >
              <ArtifactPanel isDark={isDark} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── OVERLAYS (Pills, Toolbar, etc.) ── */}

        {/* ─── 5. UNIFIED TOP CONTROLS ─── */}
        <div className={`absolute top-5 left-0 right-0 px-5 z-[50] pointer-events-none flex items-center justify-between gap-4 ${isRightHand ? 'flex-row-reverse' : 'flex-row'}`}>
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
                    padding: '6px 10px',
                  }}
                >
                  <button
                    onClick={toggleSidebar}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-[var(--bg-tertiary)]/40"
                  >
                    {isSidebarOpen ? <PanelRight size={15} strokeWidth={2} /> : <PanelLeft size={15} strokeWidth={2} />}
                    <span className="hidden md:block text-[10px] uppercase tracking-[0.25em] font-bold opacity-90" style={{ color: 'var(--text-secondary)' }}>
                      {isSidebarOpen ? 'Close' : 'Workspace'}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Toolbar - Hidden in Teaching Split View */}
          <div
            className={`pointer-events-auto transition-all duration-500 flex-1 flex ${isRightHand ? 'justify-start' : 'justify-end'} ${isSidebarOpen && isMobile ? 'opacity-0 pointer-events-none -translate-y-10' : 'opacity-100'}`}
          >
            <div className="w-fit">
              <Toolbar
                onShare={() => { }}
                onSettingsClick={() => useTutorStore.getState().setOverlay('settings')}
              />
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE BACKDROP */}
    </div>
  );
};

export default Layout;
