import React, { useState } from 'react';
import { PanelLeft, PanelRight, Check, Trash, Type, Square, StickyNote, Share, Edit, Hand, LayoutGrid, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import AccountMenu from '../sidebar/AccountMenu';
import ThemeSelector from '../ThemeSelector';
import { X } from 'lucide-react';
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
  const { isSidebarOpen, setSidebarOpen, toggleSidebar, layoutView, setLayoutView } = useTutorStore();
  const isLeftHand = layoutView === 'left';
  const [showSettings, setShowSettings] = useState(false);
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
            className={`absolute top-6 ${isLeftHand ? 'right-6' : 'left-6'} z-50 flex items-center pointer-events-auto`}
            style={{ ...miniGlass, borderRadius: 16, padding: '6px' }}
          >
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-[var(--text-primary)] font-bold active:scale-95 group hover:bg-[var(--bg-secondary)]"
            >
              <PanelLeft size={15} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
              <span className="text-[11px] uppercase tracking-[0.2em] opacity-90 pr-1">Workspace</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── FLOATING TOP-RIGHT: Integrated Control Center ── */}
      {!forceCollapse && (
        <div
          className={`absolute top-6 ${isLeftHand ? 'left-6 flex-row-reverse' : 'right-6'} z-50 flex items-center gap-1.5 p-1.5 pointer-events-auto`}
          style={{ borderRadius: 16, ...miniGlass }}
        >
          {/* A. Drawing Tools */}
          {[
            { icon: <Hand size={15} />, label: 'Pan Tool' },
            { icon: <Type size={15} />, label: 'Add Text' },
            { icon: <Square size={15} />, label: 'Draw Shape' },
            { icon: <StickyNote size={15} />, label: 'Sticky Note' },
            { icon: <LayoutGrid size={15} />, label: 'Layout Grid' },
          ].map(({ icon, label }) => (
            <div key={label} className="relative group">
              <button
                className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90"
              >
                {icon}
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap shadow-xl">
                {label}
              </div>
            </div>
          ))}
          
          {/* B. Session Actions */}
          <div className="relative group">
            <button className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90">
              <Edit size={15} strokeWidth={2} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap shadow-xl">
              Rename
            </div>
          </div>

          <div className="relative group">
            <button className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90">
              <Share size={15} strokeWidth={2} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap shadow-xl">
              Share
            </div>
          </div>

          <div className="relative group">
            <button
              className="p-2 rounded-xl hover:bg-red-500/10 transition-all text-[var(--text-tertiary)] hover:text-red-500 active:scale-90"
            >
              <Trash size={15} />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none transition-all duration-200 z-[100] whitespace-nowrap shadow-xl">
              Delete
            </div>
          </div>

          <div className="w-[1px] h-4 bg-[var(--border-color)] mx-1" />

          <AnimatePresence mode="wait">
            <AccountMenu
              variant="compact"
              onSettingsClick={() => setShowSettings(true)}
              layoutView={layoutView}
            />
          </AnimatePresence>
        </div>
      )}

      {/* ── MAIN CONTENT / CANVAS ── */}
      <main className="absolute inset-0 z-10 m-0 p-0">
        {children}
      </main>

      {/* Settings Modal (Global) */}
      {showSettings && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
                Appearance Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:text-[var(--text-primary)] transition-colors text-[var(--text-tertiary)]">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              <div>
                <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-3">Theme</h4>
                <ThemeSelector />
              </div>
              
              <div>
                <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-3">Layout View</h4>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLayoutView('right')}
                    className={`flex-1 flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-2xl border transition-all relative ${
                      layoutView === 'right' 
                        ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)] shadow-md' 
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] opacity-60'
                    }`}
                  >
                    {layoutView === 'right' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-full flex items-center justify-center">
                        <Check size={10} strokeWidth={4} />
                      </div>
                    )}
                    <PanelLeft size={22} strokeWidth={2.5} />
                    <span className="text-[12px] font-bold uppercase tracking-widest leading-none">Right Hand</span>
                  </button>
                  
                  <button
                    onClick={() => setLayoutView('left')}
                    className={`flex-1 flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-2xl border transition-all relative ${
                      layoutView === 'left' 
                        ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)] shadow-md' 
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] opacity-60'
                    }`}
                  >
                    {layoutView === 'left' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-full flex items-center justify-center">
                        <Check size={10} strokeWidth={4} />
                      </div>
                    )}
                    <PanelRight size={22} strokeWidth={2.5} />
                    <span className="text-[12px] font-bold uppercase tracking-widest leading-none">Left Hand</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-color)] flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── FLOATING SIDEBAR PANEL ── */}
      <AnimatePresence>
        {sidebarVisible && (
          <motion.aside
            initial={{ x: isLeftHand ? 350 : -350, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isLeftHand ? 350 : -350, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute top-4 ${isLeftHand ? 'right-4' : 'left-4'} z-50 flex flex-col overflow-hidden pointer-events-auto`}
          style={{
            width: 320,
            height: 'calc(100vh - 32px)',
            borderRadius: 20,
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
