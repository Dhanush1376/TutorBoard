import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  User, Shield, Palette, Key, Eye, Info,
  ChevronRight, Check, X, Minus
} from 'lucide-react';
import VisaiLogo from '../components/layout/VisaiLogo';

// Components
import { SectionWrapper } from '../components/settings/SettingsLayout';
import GeneralSection from '../components/settings/GeneralSection';
import AccountSection from '../components/settings/AccountSection';
import AppearanceSection from '../components/settings/AppearanceSection';
import ApiKeysSection from '../components/settings/ApiKeysSection';
import PrivacySection from '../components/settings/PrivacySection';
import AboutSection from '../components/settings/AboutSection';

// Hooks
import { useSettingsSync } from '../hooks/useSettingsSync';

const SECTIONS = [
  { id: 'general', label: 'General', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'API Configuration', icon: Key },
  { id: 'privacy', label: 'Privacy', icon: Eye },
  { id: 'about', label: 'About', icon: Info },
];

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('general');
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }
  const contentRef = useRef(null);
  const syncSettings = useSettingsSync();

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Scroll to top when section changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeSection]);

  const renderSection = () => {
    const sectionMap = {
      general: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <GeneralSection user={user} syncSettings={syncSettings} showToast={showToast} />
        </SectionWrapper>
      ),
      account: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <AccountSection user={user} logout={logout} />
        </SectionWrapper>
      ),
      appearance: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={false}>
          <AppearanceSection syncSettings={syncSettings} />
        </SectionWrapper>
      ),
      ai: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <ApiKeysSection showToast={showToast} />
        </SectionWrapper>
      ),
      privacy: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <PrivacySection syncSettings={syncSettings} />
        </SectionWrapper>
      ),
      about: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={false}>
          <AboutSection />
        </SectionWrapper>
      ),
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
      width: '100vw', height: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Aesthetic Background Blobs */}
      <motion.div 
        animate={{ x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', top: '-10%', left: '10%', width: '40vw', height: '40vw',
          background: 'radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0
        }} 
      />
      
      <motion.div
        layout
        animate={
          isMaximized ? { width: '100vw', height: '100vh', borderRadius: '0px' } : { width: 'min(1000px, 95vw)', height: 'min(800px, 90vh)', borderRadius: '16px' }
        }
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          background: 'var(--bg-primary)', color: 'var(--text-primary)',
          display: 'flex', flexDirection: 'column',
          fontFamily: '"Geist", sans-serif',
          overflow: 'hidden', border: '1px solid var(--border-color)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(30px)', zIndex: 1,
        }}
      >
        {/* Top Bar */}
        <div style={{
          height: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <div
              onMouseEnter={() => setIsTrafficHovered(true)}
              onMouseLeave={() => setIsTrafficHovered(false)}
              style={{ display: 'flex', gap: 6 }}
            >
              {[
                { color: '#ff5f57', action: () => navigate('/dashboard'), icon: <X size={7} /> },
                { color: '#febc2e', action: () => {}, icon: <ChevronRight size={8} /> },
                { color: '#28c840', action: () => setIsMaximized(!isMaximized), icon: isMaximized ? <Minus size={8} /> : <X size={7} style={{ transform: 'rotate(45deg)' }} /> },
              ].map((btn, i) => (
                <button
                  key={i} onClick={btn.action}
                  style={{
                    width: 12, height: 12, borderRadius: '50%', background: btn.color, border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(0,0,0,0.4)', padding: 0, transition: 'all 0.15s',
                  }}
                >
                  {isTrafficHovered && btn.icon}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <VisaiLogo size="xxs" />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Settings — TutorBoard</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{
          height: 38, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'stretch', paddingLeft: 8, gap: 2, overflowX: 'auto',
        }}>
          {SECTIONS.map(tab => (
            <button
              key={tab.id} onClick={() => setActiveSection(tab.id)}
              style={{
                padding: '0 16px', background: activeSection === tab.id ? 'var(--bg-primary)' : 'transparent',
                border: 'none', borderTop: activeSection === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: activeSection === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1, whiteSpace: 'nowrap',
              }}
            >
              <tab.icon style={{ width: '12px', height: '12px', opacity: activeSection === tab.id ? 1 : 0.6 }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              style={{
                position: 'absolute', top: '96px', left: '50%', zIndex: 100, padding: '10px 20px', borderRadius: '12px',
                background: toast.type === 'error' ? '#ef4444' : (toast.type === 'success' ? '#10b981' : '#3b82f6'),
                color: '#fff', fontSize: '13px', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {toast.type === 'success' && <Check size={14} />}
              {toast.type === 'error' && <X size={14} />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ maxWidth: '800px', margin: '0 auto' }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;
