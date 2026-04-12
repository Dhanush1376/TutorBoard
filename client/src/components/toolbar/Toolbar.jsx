import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Trash2,
  Image as ImageIcon,
  Settings,
  LogOut,
} from 'lucide-react';

import ToolButtonBase from './components/ToolButtonBase';
import ActionButtonBase from './components/ActionButtonBase';
import ToolbarDivider from './ToolbarDivider';
import useTutorStore from '../../store/tutorStore';

// Tool Components
import HandTool from './tools/HandTool';
import TextTool from './tools/TextTool';
import DrawTool from './tools/DrawTool';
import NoteTool from './tools/NoteTool';
import ShapeTool from './tools/ShapeTool';
import GridTool from './tools/GridTool';
import ImageTool from './tools/ImageTool';

import ShareAction from './actions/ShareAction';
import DeleteAction from './actions/DeleteAction';

const Toolbar = ({ onSettingsClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState(null);
  const toolbarRef = useRef(null);
  
  const { 
    isProfileOpen, toggleProfile, endSession
  } = useTutorStore();

  const handleLogout = () => {
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
      className="flex items-center gap-1 px-2 py-1.5 rounded-2xl relative"
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        boxShadow:
          '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        userSelect: 'none',
      }}
    >
      <HandTool {...commonToolProps} isHoveredExternally={hoveredId === 'hand'} />
      <TextTool {...commonToolProps} isHoveredExternally={hoveredId === 'text'} />
      <DrawTool {...commonToolProps} isHoveredExternally={hoveredId === 'draw'} />
      <NoteTool {...commonToolProps} isHoveredExternally={hoveredId === 'note'} />
      
      <ImageTool {...commonToolProps} isHoveredExternally={hoveredId === 'image'} />

      <ShapeTool {...commonToolProps} isHoveredExternally={hoveredId === 'shape'} />

      <GridTool {...commonToolProps} isHoveredExternally={hoveredId === 'layout'} />

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
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#fff',
              boxShadow: isProfileOpen ? '0 0 0 2px var(--text-primary)' : 'none',
              border: '1px solid rgba(255,255,255,0.2)',
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
            G
          </motion.button>
          
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-full right-0 mt-4 z-[9999] min-w-[200px]"
              >
                <div 
                  className="p-1.5 rounded-2xl overflow-hidden"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
                    backdropFilter: 'blur(20px) saturate(1.8)',
                  }}
                >
                  <div className="px-4 py-3 border-b border-[var(--border-color)] mb-1">
                    <p className="text-[12px] font-bold text-[var(--text-primary)]">Guest</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">guest@tutorboard.ai</p>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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