import React from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Toolbar from '../toolbar/Toolbar';
import useTutorStore from '../../store/tutorStore';

const glassStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
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
  const isLeftHand = layoutView === 'left';
  const { user } = useAuth();

  const sidebarVisible = isSidebarOpen && !forceCollapse;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden m-0 p-0 pointer-events-none">



      {/* ── FLOATING TOP-LEFT: collapsed pill ── */}
      <AnimatePresence>
        {!isSidebarOpen && !forceCollapse && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: isLeftHand ? 20 : -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: isLeftHand ? 20 : -20 }}
            transition={{ duration: 0.2 }}
            className={`tb-top-left-pill absolute top-6 ${isLeftHand ? 'right-6' : 'left-6'} z-[5000] flex items-center pointer-events-auto transition-all`}
            style={{ 
              ...miniGlass, 
              borderRadius: 'var(--radius-2xl)', 
              gap: 'var(--tool-gap)',
              padding: 'calc(var(--tool-gap) * 1.5) calc(var(--tool-gap) * 2)'
            }}
          >
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-2 px-3 rounded-xl transition-all text-[var(--text-primary)] font-bold active:scale-95 group hover:bg-[var(--bg-secondary)]"
              style={{ height: 'var(--tool-size)' }}
            >
              <PanelLeft size={17} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
              <span className="text-[11px] uppercase tracking-[0.2em] opacity-90 pr-1 max-md:hidden">Workspace</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── FLOATING TOP-RIGHT: Integrated Control Center ── */}
      {!forceCollapse && (
        <div
          className={`tb-control-center absolute top-6 ${isLeftHand ? 'left-6 flex-row-reverse' : 'right-6'} z-[5000] flex items-center gap-1.5 p-0 pointer-events-auto transition-opacity duration-300 ${
            isSidebarOpen ? 'max-md:opacity-0 max-md:pointer-events-none' : 'opacity-100'
          }`}
        >
          <Toolbar 
            onShare={() => {}} 
            onSettingsClick={() => navigate('/settings')}
          />
        </div>
      )}

      {/* ── MAIN CONTENT / CANVAS ── */}
      <main className="absolute inset-0 z-10 m-0 p-0">
        {children}
      </main>

      {/* ── FLOATING SIDEBAR PANEL ── */}
      <AnimatePresence>
        {sidebarVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="tb-mobile-backdrop absolute inset-0 z-[4999] bg-black/20 pointer-events-auto hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {sidebarVisible && (
          <motion.aside
            initial={{ x: isLeftHand ? 350 : -350, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isLeftHand ? 350 : -350, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`tb-sidebar absolute top-4 ${isLeftHand ? 'right-4' : 'left-4'} z-[5000] flex flex-col overflow-hidden pointer-events-auto`}
          style={{
            width: 320,
            height: 'calc(100vh - 32px)',
            borderRadius: 32,
            ...glassStyle,
          }}
        >
          {sidebar}
        </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
