import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Share2,
  Trash2,
  Image as ImageIcon,
  Settings,
  LogOut,
  User,
} from 'lucide-react';

import ToolButtonBase from './tools/ToolButtonBase';
import ActionButtonBase from './tools/ActionButtonBase';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../context/AuthContext';

// Tool Components
import TextTool from './tools/TextTool';
import DrawTool from './tools/DrawTool';
import NoteTool from './tools/NoteTool';
import ShapeTool from './tools/ShapeTool';
import VisualizerTool from './tools/VisualizerTool';

import ShareAction from './actions/ShareAction';
import DeleteAction from './actions/DeleteAction';

const ToolbarDivider = () => (
  <div 
    className="w-[1px] h-[18px] opacity-20" 
    style={{ background: 'var(--text-tertiary)' }} 
  />
);

const ProfileDropdown = ({ isLeftHand, user, onSettingsClick, handleLogout }) => {
  const [offset, setOffset] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const padding = 12;
      let off = 0;
      if (rect.left < padding) off = padding - rect.left;
      else if (rect.right > window.innerWidth - padding) off = window.innerWidth - padding - rect.right;
      if (off !== 0) setOffset(off);
    }
  }, []);

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: offset }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`absolute top-full mt-4 z-[9999] min-w-[200px] ${isLeftHand ? 'left-0' : 'right-0'}`}
    >
      <div 
        className="p-1.5 rounded-2xl relative shadow-2xl"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        }}
      >
        <div
          className={`absolute -top-1.5 w-3 h-3 rotate-45 ${isLeftHand ? 'left-4' : 'right-4'}`}
          style={{
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border-color)',
            borderTop: '1px solid var(--border-color)',
            zIndex: -1,
            transform: `translateX(${-offset}px) rotate(45deg)` // Counter-shift the caret
          }}
        />

        <div className="rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-color)] mb-1">
            <p className="text-[12px] font-normal text-[var(--text-primary)]">{user?.name || (user?.isGuest ? 'Guest' : 'Account')}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">{user?.email || 'Not signed in'}</p>
          </div>
          
          {[
            { label: 'Settings', icon: Settings, onClick: onSettingsClick },
            { label: 'Log Out', icon: LogOut, destructive: true, onClick: handleLogout },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-normal transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: item.destructive ? 'rgb(239,68,68)' : 'var(--text-secondary)' }}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const Toolbar = ({ onSettingsClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState(null);
  const toolbarRef = useRef(null);
  
    const { 
    isProfileOpen, toggleProfile, endSession, layoutView
  } = useTutorStore();

  const { user, logout } = useAuth();
  
  const isLeftHand = layoutView === 'left';

  const handleLogout = () => {
    logout();
    endSession();
  };

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileOpen && toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        toggleProfile();
      }
    };
    
    const handleKeyDown = (event) => {
      const state = useTutorStore.getState();
      if (event.key === 'Escape') {
        state.setActiveTool('select');
        state.setInteracting(false);
        state.setEditingObjectId(null);
      } else if (event.key.toLowerCase() === 'v' && !state.editingObjectId) {
        state.setActiveTool('select');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen, toggleProfile]);

  const commonToolProps = {
    onMouseEnter: setHoveredId,
    onMouseLeave: () => setHoveredId(null),
    hoveredId,
  };

  const isInteracting = useTutorStore(state => state.isInteracting);
  const isHidden = isInteracting && !isHovered;

  return (
    <motion.div
      ref={toolbarRef}
      initial={{ y: 16, opacity: 0, scale: 0.97 }}
      animate={{ 
        y: isHidden ? 20 : 0, 
        opacity: isHidden ? 0.2 : 1, 
        scale: isHidden ? 0.95 : 1,
        filter: isHidden ? 'blur(2px)' : 'blur(0px)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Ensure body cursor is restored if we leave the toolbar area
        if (!isInteracting) document.body.style.cursor = 'default';
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
      className={`flex items-center rounded-2xl relative transition-all duration-500 ${isLeftHand ? 'flex-row' : 'flex-row-reverse'} ${isInteracting ? 'scale-[0.98]' : ''}`}
      style={{
        gap: 'var(--tool-gap)',
        padding: 'calc(var(--tool-gap) * 1.5) calc(var(--tool-gap) * 2)',
        background: isInteracting 
          ? 'rgba(var(--bg-primary-rgb), 0.25)' 
          : 'var(--bg-primary)',
        backdropFilter: isInteracting ? 'blur(24px) saturate(160%)' : 'blur(0px)',
        border: isInteracting 
          ? '1px solid rgba(var(--bg-primary-rgb), 0.15)' 
          : '1px solid var(--border-color)',
        boxShadow: isInteracting
          ? '0 12px 40px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <LayoutGroup id="main-toolbar">
        {/* Group 1: Drawing & Pedagogical Tools */}
        <TextTool {...commonToolProps} isHoveredExternally={hoveredId === 'text'} />
        <DrawTool {...commonToolProps} isHoveredExternally={hoveredId === 'draw'} />
        <NoteTool {...commonToolProps} isHoveredExternally={hoveredId === 'note'} />
        <ShapeTool {...commonToolProps} isHoveredExternally={hoveredId === 'shape'} />
        <VisualizerTool 
          {...commonToolProps} 
          id="visualizer"
          isHoveredExternally={hoveredId === 'visualizer'} 
        />
        
        <ToolbarDivider />

        {/* Group 2: Session Actions */}
        <ShareAction 
          {...commonToolProps} 
          id="action:share"
          isHoveredExternally={hoveredId === 'action:share'} 
        />

        <DeleteAction 
          {...commonToolProps} 
          id="action:delete"
          isHoveredExternally={hoveredId === 'action:delete'} 
        />

        <ToolbarDivider />
        
        <div className="relative">
          <motion.button
            whileHover={!isProfileOpen ? { y: -1 } : {}}
            whileTap={{ scale: 0.95 }}
            onClick={toggleProfile}
            onMouseEnter={() => {
              if (!isProfileOpen) {
                setIsHovered(true);
                setHoveredId('profile');
              }
            }}
            onMouseLeave={() => {
              setIsHovered(false);
              setHoveredId(null);
            }}
            className="relative w-[32px] h-[32px] rounded-full flex items-center justify-center font-normal text-[11px] outline-none"
          >
            {(isHovered) && !isProfileOpen && (
              <motion.div
                layoutId="profile-liquid-hover"
                className="absolute inset-0.5 rounded-full z-0"
                style={{ 
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <User 
              size={18} 
              strokeWidth={2.5}
              className="relative z-10 transition-colors"
              style={{
                color: (isProfileOpen || isHovered) ? 'var(--text-primary)' : 'var(--text-tertiary)'
              }}
            />
          </motion.button>
          
          <AnimatePresence>
            {isProfileOpen && (
              <ProfileDropdown 
                isLeftHand={isLeftHand} 
                user={user} 
                onSettingsClick={onSettingsClick} 
                handleLogout={handleLogout} 
              />
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>

        <style>{`
          @keyframes active-glow {
            0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
            70% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
            100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
          }
        `}</style>
      </motion.div>
  );
};


export default Toolbar;
