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
import useWindowSize from '../../hooks/useWindowSize';

// Tool Components
import TextTool from './tools/TextTool';
import DrawTool from './tools/DrawTool';
import NoteTool from './tools/NoteTool';
import ShapeTool from './tools/ShapeTool';
import CodeTool from './tools/CodeTool';

import ShareAction from './actions/ShareAction';
import DeleteAction from './actions/DeleteAction';

const ToolbarDivider = () => (
  <div 
    className="w-[1px] h-[16px] opacity-10 mx-0.5" 
    style={{ background: 'var(--text-tertiary)' }} 
  />
);

const ProfileDropdown = ({ isLeftHand, user, onSettingsClick, handleLogout }) => {
  const [offset, setOffset] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const dropdownRef = useRef(null);
  const { isMobile } = useWindowSize();

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
        className="p-1.5 rounded-2xl relative shadow-2xl liquid-glass"
        style={{
          borderRadius: '20px',
        }}
      >
        <div
          className={`absolute -top-1.5 w-3 h-3 rotate-45 ${isLeftHand ? 'left-4' : 'right-4'} liquid-glass`}
          style={{
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--glass-border)',
            borderTop: '1px solid var(--glass-border)',
            borderRight: 'none',
            borderBottom: 'none',
            zIndex: -1,
            transform: `translateX(${-offset}px) rotate(45deg)` // Counter-shift the caret
          }}
        />

        <div className="rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-color)] mb-1">
            <p className="text-[12px] font-normal text-[var(--text-primary)]">{user?.name || 'Account'}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">{user?.email || 'Not signed in'}</p>
          </div>
          
          {[
            { label: 'Settings', icon: Settings, onClick: onSettingsClick },
            { label: 'Log Out', icon: LogOut, destructive: true, onClick: handleLogout },
          ].map((item, i) => (
            <div key={i} className="relative">
              <button
                onClick={item.onClick}
                onMouseEnter={() => setHoveredId(`profile-${item.label}`)}
                onMouseLeave={() => setHoveredId(null)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all relative z-10 outline-none"
                style={{ color: item.destructive ? 'rgb(239,68,68)' : 'var(--text-secondary)' }}
              >
                <item.icon size={14} strokeWidth={2} />
                {item.label}
              </button>
              {hoveredId === `profile-${item.label}` && (
                <motion.div
                  layoutId="profile-hover-pill"
                  className="absolute inset-0 bg-[var(--bg-tertiary)]/50 rounded-xl z-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </div>
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
  const { isMobile } = useWindowSize();
  
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

  const [imgError, setImgError] = useState(false);

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
      onMouseLeave={() => setIsHovered(false)}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
      className={`flex items-center rounded-[28px] relative transition-all duration-500 liquid-glass ${isInteracting ? 'scale-[0.98]' : ''} ${isMobile ? 'gap-0 max-w-[calc(100vw-80px)]' : 'gap-0.5'}`}
      style={{
        padding: isMobile ? '5px 6px' : '7px 8px',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <LayoutGroup id="main-toolbar">
        {/* All tools in a single seamless group */}
        <div className={`flex items-center gap-0.5 ${isMobile ? 'overflow-x-auto no-scrollbar max-w-[calc(100%-44px)]' : ''}`}>
          <TextTool {...commonToolProps} isHoveredExternally={hoveredId === 'text'} />
          <DrawTool {...commonToolProps} isHoveredExternally={hoveredId === 'draw'} />
          <NoteTool {...commonToolProps} isHoveredExternally={hoveredId === 'note'} />
          <ShapeTool {...commonToolProps} isHoveredExternally={hoveredId === 'shape'} />
          
          <CodeTool 
            {...commonToolProps} 
            id="code"
            isHoveredExternally={hoveredId === 'code'} 
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
        </div>
        
        <div className="relative ml-1 group/profile shrink-0">
          {/* Seamless Liquid Hover Pill - Integrated with the main toolset */}
          <AnimatePresence>
            {(hoveredId === 'profile' && !isProfileOpen) && (
              <motion.div
                layoutId="liquid-hover-pill"
                className="absolute inset-[1.5px] rounded-[14px] z-0"
                style={{
                  background: 'var(--bg-tertiary)cc',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 0 8px rgba(255,255,255,0.03)',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
              />
            )}
          </AnimatePresence>

          <motion.button
            whileHover={!isProfileOpen ? { scale: 1.02, y: -0.5 } : {}}
            whileTap={{ scale: 0.94 }}
            onClick={toggleProfile}
            onMouseEnter={() => {
              if (!isProfileOpen) setHoveredId('profile');
            }}
            onMouseLeave={() => {
              setHoveredId(null);
            }}
            className="relative w-[32px] h-[32px] md:w-[40px] md:h-[40px] rounded-[12px] md:rounded-[14px] flex items-center justify-center transition-all overflow-hidden cursor-pointer z-10"
            style={{
              background: isProfileOpen ? 'var(--text-primary)' : 'var(--bg-tertiary)44',
              border: '1px solid var(--border-color)',
              boxShadow: isProfileOpen ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            {user?.avatar && !imgError ? (
              <img 
                src={user.avatar} 
                alt={user.name} 
                className={`w-full h-full object-cover transition-all duration-500 ${isProfileOpen ? 'opacity-20 scale-125 blur-md' : (hoveredId === 'profile' ? 'opacity-60 scale-110 blur-[2px]' : 'opacity-100')}`}
                onError={() => setImgError(true)}
              />
            ) : (
              <User 
                size={isMobile ? 14 : 18} 
                strokeWidth={2.5}
                className="relative z-10 transition-colors"
                style={{
                  color: isProfileOpen ? 'var(--bg-primary)' : (hoveredId === 'profile' ? 'var(--text-primary)' : 'var(--text-tertiary)')
                }}
              />
            )}
            
            {isProfileOpen && user?.avatar && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <User size={isMobile ? 13 : 16} strokeWidth={3} style={{ color: 'var(--bg-primary)' }} />
              </div>
            )}
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
