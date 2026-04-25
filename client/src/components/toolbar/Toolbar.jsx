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
import CodeTool from './tools/CodeTool';
import VoiceTool from './tools/VoiceTool';

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
  const featureFlags = useTutorStore(state => state.featureFlags);
  const isHidden = isInteracting && !isHovered;

  return (
    <motion.div
      ref={toolbarRef}
      initial={{ y: 24, opacity: 0, scale: 0.95 }}
      animate={{ 
        y: isHidden ? 32 : 0, 
        opacity: isHidden ? 0.3 : 1, 
        scale: isHidden ? 0.96 : 1,
        filter: isHidden ? 'blur(4px)' : 'blur(0px)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isInteracting) document.body.style.cursor = 'default';
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
      className={`flex items-center rounded-[28px] relative transition-all duration-500 gap-1 ${isInteracting ? 'scale-[0.98]' : ''}`}
      style={{
        gap: '4px',
        padding: '6px',
        background: isInteracting 
          ? 'rgba(var(--bg-primary-rgb), 0.4)' 
          : 'var(--glass-bg)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid var(--glass-border)',
        boxShadow: isInteracting
          ? '0 8px 32px rgba(0,0,0,0.15)'
          : 'var(--glass-shadow)',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <LayoutGroup id="main-toolbar">
        {/* Drawing & Construction Tools */}
        <div className="flex items-center gap-1 px-1">
          <TextTool {...commonToolProps} isHoveredExternally={hoveredId === 'text'} />
          <DrawTool {...commonToolProps} isHoveredExternally={hoveredId === 'draw'} />
          <NoteTool {...commonToolProps} isHoveredExternally={hoveredId === 'note'} />
          <ShapeTool {...commonToolProps} isHoveredExternally={hoveredId === 'shape'} />
        </div>



        {/* Intelligence & Code Tools */}
        <div className="flex items-center gap-1 px-1">
          <CodeTool 
            {...commonToolProps} 
            id="code"
            isHoveredExternally={hoveredId === 'code'} 
          />
          {featureFlags?.enableVisualizer && (
            <VisualizerTool 
              {...commonToolProps} 
              id="visualizer"
              isHoveredExternally={hoveredId === 'visualizer'} 
            />
          )}
          {featureFlags?.enableVoice && (
            <VoiceTool 
              {...commonToolProps} 
              id="voice"
              isHoveredExternally={hoveredId === 'voice'} 
            />
          )}
        </div>
        
        <ToolbarDivider />

        {/* Session Management */}
        <div className="flex items-center gap-1 px-1">
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
        </div>

        <ToolbarDivider />
        
        {/* Profile / Account */}
        <div className="relative pl-1 pr-2">
          <motion.button
            whileHover={!isProfileOpen ? { scale: 1.05 } : {}}
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
            className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all overflow-hidden"
            style={{
              background: (isProfileOpen || hoveredId === 'profile') ? 'var(--text-primary)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <User 
              size={18} 
              strokeWidth={2.5}
              className="relative z-10 transition-colors"
              style={{
                color: (isProfileOpen || hoveredId === 'profile') ? 'var(--bg-primary)' : 'var(--text-tertiary)'
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
          0% { box-shadow: 0 0 0 0 rgba(var(--accent-primary-rgb), 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(var(--accent-primary-rgb), 0); }
          100% { box-shadow: 0 0 0 0 rgba(var(--accent-primary-rgb), 0); }
        }
      `}</style>
      </motion.div>
  );
};


export default Toolbar;
