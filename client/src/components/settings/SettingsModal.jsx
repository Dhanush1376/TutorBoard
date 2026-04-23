import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { 
  ChevronRight, X, Minus 
} from 'lucide-react';

import VisaiLogo from '../layout/VisaiLogo';
import { 
  SECTIONS, useSettingsSync, SectionWrapper 
} from './SettingsShared';

// Domain Components
import GeneralSection from './GeneralSection';
import AccountSection, { PrivacySection } from './AccountSection';
import AppearanceSection from './AppearanceSection';
import AIConfigSection from './AIConfigSection';
import AboutSection from './AboutSection';

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, token, loading, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('general');
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [toast, setToast] = useState(null);
  const contentRef = useRef(null);
  const syncSettings = useSettingsSync();

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeSection]);

  const renderSection = () => {
    const sectionMap = {
      general: <GeneralSection user={user} syncSettings={syncSettings} showToast={showToast} />,
      account: <AccountSection user={user} logout={logout} syncSettings={syncSettings} />,
      appearance: <AppearanceSection syncSettings={syncSettings} />,
      ai: <AIConfigSection showToast={showToast} />,
      privacy: <PrivacySection syncSettings={syncSettings} token={token} showToast={showToast} />,
      about: <AboutSection />,
    };

    return sectionMap[activeSection] || sectionMap.general;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl cursor-pointer"
            onClick={onClose}
          />
          
          <motion.div
            layout
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={isMaximized ? { 
              width: '100vw', height: '100vh', borderRadius: '0px', y: 0, scale: 1, opacity: 1 
            } : { 
              width: 'min(1000px, 95vw)', height: 'min(800px, 90vh)', borderRadius: '24px', y: 0, scale: 1, opacity: 1 
            }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative z-10 shadow-2xl flex flex-col overflow-hidden"
            style={{
              background: 'var(--bg-primary)', 
              color: 'var(--text-primary)',
              fontFamily: '"Geist", sans-serif', 
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Top Bar */}
            <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', zIndex: 10, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div onMouseEnter={() => setIsTrafficHovered(true)} onMouseLeave={() => setIsTrafficHovered(false)} style={{ display: 'flex', gap: 6 }}>
                  {[{ color: '#ff5f57', action: onClose, icon: <X size={7} /> }, { color: '#febc2e', action: () => {}, icon: <ChevronRight size={8} /> }, { color: '#28c840', action: () => setIsMaximized(!isMaximized), icon: <Minus size={8} /> }].map((btn, i) => (
                    <button key={i} onClick={btn.action} style={{ width: 12, height: 12, borderRadius: '50%', background: btn.color, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.4)' }}>{isTrafficHovered && btn.icon}</button>
                  ))}
                </div>
                <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <VisaiLogo size="xxs" />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>Settings — TutorBoard</span>
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div style={{ height: 38, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: 2, overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
              {SECTIONS.filter(tab => !user?.isGuest || ['appearance', 'about'].includes(tab.id)).map(tab => {
                const isTabActive = activeSection === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{ padding: '0 16px', background: isTabActive ? 'var(--bg-primary)' : 'transparent', border: 'none', borderTop: isTabActive ? '2px solid var(--accent-primary)' : '2px solid transparent', color: isTabActive ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <tab.icon style={{ width: '12px', height: '12px', opacity: isTabActive ? 1 : 0.6 }} />{tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
              <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px 160px 24px' }} className="no-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <SectionWrapper isGuest={user?.isGuest} isRestricted={!['appearance', 'about'].includes(activeSection)} onUnlock={onClose}>
                      {renderSection()}
                    </SectionWrapper>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            
            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-white"
                  style={{ background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6' }}>
                  <span className="text-xs font-normal">{toast.message}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
