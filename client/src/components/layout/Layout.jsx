import React from 'react';
import { PanelLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../toolbar/Toolbar';
import useTutorStore from '../../store/tutorStore';

const SIDEBAR_WIDTH = 320;
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

const Layout = ({ sidebar, children, title = "TutorBoard", onBack, forceCollapse = false }) => {
  const navigate = useNavigate();
  const {
    isSidebarOpen, setSidebarOpen, toggleSidebar, layoutView,
  } = useTutorStore();
  const isRightHand = layoutView === 'right';
  const { user } = useAuth();

  const sidebarVisible = isSidebarOpen && !forceCollapse;

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden m-0 p-0"
      style={{
        display: 'flex',
        flexDirection: isRightHand ? 'row-reverse' : 'row',
        background: 'var(--bg-primary)',
      }}
    >
      {/* ── SIDEBAR PANEL ── */}
      <AnimatePresence initial={false}>
        {sidebarVisible && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="tb-sidebar flex-shrink-0 flex flex-col overflow-hidden h-full"
            style={{
              ...(isRightHand ? sidebarStyleRight : sidebarStyle),
              minWidth: 0,
            }}
          >
            <div style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: '100%' }}>
              {sidebar}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT AREA ── */}
      <main
        className="relative flex-1 min-w-0 h-full transition-all duration-500"
        style={{
          padding: 0,
          paddingLeft: !isRightHand && sidebarVisible ? PANEL_GAP : 0,
          paddingRight: isRightHand && sidebarVisible ? PANEL_GAP : 0,
          background: 'var(--bg-primary)',
        }}
      >
        {/* Floating Glass Layer (Decorative) */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-all duration-500"
          style={{
            margin: 0,
            marginLeft: !isRightHand && sidebarVisible ? PANEL_GAP : 0,
            marginRight: isRightHand && sidebarVisible ? PANEL_GAP : 0,
            borderRadius: 0,
            borderTopLeftRadius: !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomLeftRadius: !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderTopRightRadius: isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomRightRadius: isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: 'none',
            boxShadow: `
              ${isRightHand ? 10 : -10}px 40px 120px -20px rgba(0, 0, 0, 0.18),
              ${isRightHand ? 5 : -5}px 20px 60px -15px rgba(0, 0, 0, 0.12),
              inset 0 1px 1px rgba(255, 255, 255, 0.8),
              inset 0 0 0 1px var(--glass-border)
            `,
          }}
        />

        {/* The Actual Interactive Canvas */}
        <div
          className="relative w-full h-full z-10"
          style={{
            borderRadius: 0,
            borderTopLeftRadius: !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomLeftRadius: !isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderTopRightRadius: isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            borderBottomRightRadius: isRightHand && sidebarVisible ? PANEL_RADIUS : 0,
            overflow: 'hidden'
          }}
        >
          {children}
        </div>

        {/* ── OVERLAYS (Pills, Toolbar, etc.) ── */}

        {/* Floating Top-Left Pill */}
        <AnimatePresence>
          {!isSidebarOpen && !forceCollapse && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: isRightHand ? 20 : -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: isRightHand ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              className={`absolute top-5 ${isRightHand ? 'right-5' : 'left-5'} z-50 flex items-center`}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--glass-shadow)',
                borderRadius: 'var(--radius-2xl)',
                padding: '6px 10px',
                gap: '8px'
              }}
            >
              <button
                onClick={toggleSidebar}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-[var(--bg-tertiary)]/40"
              >
                <PanelLeft size={15} strokeWidth={1.8} style={{ opacity: 0.7 }} />
                <span className="text-[10px] uppercase tracking-widest opacity-60">Workspace</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Top-Right Toolbar */}
        {!forceCollapse && (
          <div
            className={`absolute top-5 ${isRightHand ? 'left-5' : 'right-5'} z-50 flex items-center gap-2 transition-opacity duration-300 ${isSidebarOpen ? 'max-md:opacity-0 pointer-events-none' : 'opacity-100'
              }`}
          >
            <Toolbar
              onShare={() => { }}
              onSettingsClick={() => useTutorStore.getState().setOverlay('settings')}
            />
          </div>
        )}
      </main>

      {/* MOBILE BACKDROP */}
      <AnimatePresence>
        {sidebarVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4999] bg-black/20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
