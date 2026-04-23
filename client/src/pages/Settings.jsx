import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ChevronRight, Check, X, Minus, Info 
} from 'lucide-react';

import VisaiLogo from '../components/layout/VisaiLogo';
import { 
  SECTIONS, useSettingsSync, SectionWrapper 
} from '../components/settings/SettingsShared';

// Domain Components
import GeneralSection from '../components/settings/GeneralSection';
import AccountSection, { PrivacySection } from '../components/settings/AccountSection';
import AppearanceSection from '../components/settings/AppearanceSection';
import AIConfigSection from '../components/settings/AIConfigSection';
import AboutSection from '../components/settings/AboutSection';

const Settings = () => {
  const navigate = useNavigate();
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

  if (loading && !user) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: '40px', height: '40px', border: '3px solid var(--text-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Aesthetic Background */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, #007AFF 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '45vw', height: '45vw', background: 'radial-gradient(circle, #FFBC2E 0%, transparent 70%)', filter: 'blur(120px)' }} />
      </div>

      <motion.div
        layout initial={false}
        animate={isMaximized ? { width: '100vw', height: '100vh', borderRadius: '0px' } : { width: 'min(1000px, 95vw)', height: 'min(800px, 90vh)', borderRadius: '16px' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column',
          fontFamily: '"Geist", sans-serif', overflow: 'hidden', border: '1px solid var(--border-color)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.15)', backdropFilter: 'blur(30px)', zIndex: 1,
        }}
      >
        {/* Top Bar */}
        <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <div onMouseEnter={() => setIsTrafficHovered(true)} onMouseLeave={() => setIsTrafficHovered(false)} style={{ display: 'flex', gap: 6 }}>
              {[{ color: '#ff5f57', action: () => navigate('/dashboard'), icon: <X size={7} /> }, { color: '#febc2e', action: () => {}, icon: <ChevronRight size={8} /> }, { color: '#28c840', action: () => setIsMaximized(!isMaximized), icon: <Minus size={8} /> }].map((btn, i) => (
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
        <div style={{ height: 38, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', paddingLeft: 8, gap: 2, overflowX: 'auto' }}>
          {SECTIONS.filter(tab => !user?.isGuest || ['appearance', 'about'].includes(tab.id)).map(tab => {
            const isTabActive = activeSection === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{ padding: '0 16px', background: isTabActive ? 'var(--bg-primary)' : 'transparent', border: 'none', borderTop: isTabActive ? '2px solid var(--accent-primary)' : '2px solid transparent', color: isTabActive ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <tab.icon style={{ width: '12px', height: '12px', opacity: isTabActive ? 1 : 0.6 }} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
              style={{ position: 'absolute', top: '96px', left: '50%', zIndex: 100, padding: '10px 20px', borderRadius: '12px', background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px 160px 24px' }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }} style={{ maxWidth: '800px', margin: '0 auto', height: '100%' }}>
                <SectionWrapper isGuest={user?.isGuest} isRestricted={!['appearance', 'about'].includes(activeSection)} onUnlock={() => { logout(); navigate('/'); }}>
                  {renderSection()}
                </SectionWrapper>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
