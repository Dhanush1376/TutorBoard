import React, { useState } from 'react';
import { PanelLeft, PanelRight, Check, Trash, Type, Square, StickyNote, Share, Hand, LayoutGrid, Sparkles, User, TableProperties, Grid3X3, Minimize2, Maximize2, X, MousePointer2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import Toolbar from '../toolbar/Toolbar';
import ThemeSelector from '../ThemeSelector';
import useTutorStore from '../../store/tutorStore';

const GRID_TYPES = [
  { id: 'dots',  icon: TableProperties, label: 'Dots' },
  { id: 'lines', icon: Grid3X3,        label: 'Lines' },
];

const SIZES = [
  { id: 20, label: 'Small',  icon: Minimize2 },
  { id: 40, label: 'Medium', icon: Square },
  { id: 80, label: 'Large',  icon: Maximize2 },
];

const GridPreview = ({ type, size, isActive }) => {
  const isDots = type === 'dots';
  
  return (
    <div 
      className="w-10 h-10 rounded-xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-secondary)] flex items-center justify-center p-1.5 shadow-sm transition-all"
      style={{ opacity: isActive ? 1 : 0.4 }}
    >
      {isDots ? (
        <div className="grid grid-cols-4 gap-1.5 opacity-60">
          {[...Array(16)].map((_, i) => (
            <div 
              key={i} 
              className={`w-[2px] h-[2px] rounded-full ${i === 10 ? 'bg-[var(--text-primary)] scale-150 shadow-[0_0_4px_var(--text-primary)]' : 'bg-[var(--text-tertiary)]'}`}
            />
          ))}
        </div>
      ) : (
        <div className="w-full h-full relative opacity-40">
          <div className="absolute inset-0 grid grid-cols-4">
            {[...Array(3)].map((_, i) => <div key={i} className="border-r border-[var(--text-tertiary)] h-full" />)}
          </div>
          <div className="absolute inset-0 grid grid-rows-4">
            {[...Array(3)].map((_, i) => <div key={i} className="border-b border-[var(--text-tertiary)] w-full" />)}
          </div>
          {/* Highlighted intersection */}
          <div className="absolute top-[50%] left-[50%] w-1.5 h-1.5 bg-[var(--text-primary)] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_4px_var(--text-primary)]" />
        </div>
      )}
    </div>
  );
};

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
  const { 
    isSidebarOpen, setSidebarOpen, toggleSidebar, layoutView, setLayoutView,
    showGrid, toggleGrid, isSnapToGrid, toggleSnap, gridType, setGridType, gridSize, setGridSize
  } = useTutorStore();
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
            onSettingsClick={() => setShowSettings(true)}
          />
        </div>
      )}

      {/* ── MAIN CONTENT / CANVAS ── */}
      <main className="absolute inset-0 z-10 m-0 p-0">
        {children}
      </main>

      {/* Settings Modal (Global) */}
      {showSettings && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60">
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

              {/* Grid Layout Settings - Unified Design */}
              <div>
                <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-4">Grid Settings</h4>
                
                {/* 1. Status Row - Styled like Mode Toggle */}
                <div className="flex items-center justify-between px-1 mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider leading-none mb-1">Live Preview</span>
                    <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                      {(gridType || 'dots').charAt(0).toUpperCase() + (gridType || 'dots').slice(1)} • {gridSize || 20}px
                    </span>
                  </div>
                  <div className="p-1 px-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl">
                    <GridPreview type={gridType || 'dots'} size={gridSize || 20} isActive={true} />
                  </div>
                </div>

                {/* 2. Style Grid - Styled like Layout View Cards */}
                <div className="flex gap-3">
                  {GRID_TYPES.map(type => {
                    const isActive = (gridType || 'dots') === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setGridType(type.id)}
                        className={`flex-1 flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-2xl border transition-all relative ${
                          isActive 
                            ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)] shadow-md' 
                            : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)] opacity-60'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-full flex items-center justify-center">
                            <Check size={10} strokeWidth={4} />
                          </div>
                        )}
                        <type.icon size={22} strokeWidth={2.5} />
                        <span className="text-[12px] font-bold uppercase tracking-widest leading-none">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
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
