import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Share2,
  Trash2,
  Image as ImageIcon,
  Settings,
  LogOut,
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
            <p className="text-[12px] font-bold text-[var(--text-primary)]">{user?.name || (user?.isGuest ? 'Guest' : 'Account')}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">{user?.email || 'Not signed in'}</p>
          </div>
          
          {[
            { label: 'Settings', icon: Settings, onClick: onSettingsClick },
            { label: 'Log Out', icon: LogOut, destructive: true, onClick: handleLogout },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)]"
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
  const userInitial = user?.name ? user.name[0].toUpperCase() : (user?.isGuest ? 'G' : '?');

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen, toggleProfile]);

  const commonToolProps = {
    onMouseEnter: setHoveredId,
    onMouseLeave: () => setHoveredId(null),
    hoveredId,
  };

  return (
    <motion.div
      ref={toolbarRef}
      initial={{ y: 16, opacity: 0, scale: 0.97 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.7 }}
      className={`flex items-center rounded-2xl relative ${isLeftHand ? 'flex-row' : 'flex-row-reverse'}`}
      style={{
        gap: 'var(--tool-gap)',
        padding: 'calc(var(--tool-gap) * 1.5) calc(var(--tool-gap) * 2)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        boxShadow:
          '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
        userSelect: 'none',
      }}
    >
      <LayoutGroup id="main-toolbar">
      <TextTool {...commonToolProps} isHoveredExternally={hoveredId === 'text'} />
      <DrawTool {...commonToolProps} isHoveredExternally={hoveredId === 'draw'} />
      <NoteTool {...commonToolProps} isHoveredExternally={hoveredId === 'note'} />
      <ShapeTool {...commonToolProps} isHoveredExternally={hoveredId === 'shape'} />
      <VisualizerTool 
        {...commonToolProps} 
        id="visualizer"
        isHoveredExternally={hoveredId === 'visualizer'} 
      />
      
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
        
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
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
            className="relative w-[32px] h-[32px] rounded-full flex items-center justify-center font-bold text-[11px] overflow-visible"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#fff',
              boxShadow: isProfileOpen ? '0 0 0 2px var(--text-primary)' : '0 4px 12px rgba(79, 70, 229, 0.3)',
              border: '1px solid rgba(255,255,255,0.25)',
              cursor: 'pointer'
            }}
          >
            {/* Profile Avatar with Liquid Hover logic */}
            {isHovered && !isProfileOpen && (
              <motion.div
                layoutId="liquid-hover-pill"
                className="absolute inset-0 rounded-full z-[-1]"
                style={{ 
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  scale: 1.2
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
              />
            )}
            <span className="relative z-10">{userInitial}</span>
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