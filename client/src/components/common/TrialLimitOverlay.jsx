import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LogIn, BookOpen, Shield } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../context/AuthContext';

/**
 * TrialLimitOverlay — A full-screen glassmorphic overlay that appears
 * when a guest user exhausts their trial message limit.
 * Cannot be dismissed — user must sign up or sign in.
 */
const TrialLimitOverlay = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { guestTrialStatus } = useTutorStore();

  const isGuest = user?.isGuest;
  const isLimitReached = guestTrialStatus.isLimitReached;

  // Only render for guests who hit their limit
  if (!isGuest || !isLimitReached) return null;

  const handleSignUp = () => {
    sessionStorage.removeItem('tb-is-guest');
    // Hard redirect to ensure auth state resets cleanly
    window.location.href = '/login?mode=signup';
  };

  const handleSignIn = () => {
    sessionStorage.removeItem('tb-is-guest');
    window.location.href = '/login?mode=login';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        {/* Backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-primary)',
            borderRadius: '32px',
            padding: '48px 40px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <motion.div
            animate={{ 
              y: [0, -8, 0],
              rotate: [0, 2, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.08) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 28px',
            }}
          >
            <BookOpen size={28} strokeWidth={1.8} style={{ color: '#8b5cf6' }} />
          </motion.div>

          {/* Title */}
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px',
              letterSpacing: '-0.03em',
              fontFamily: '"Inter", sans-serif',
              lineHeight: 1.3,
            }}
          >
            Your trial session has ended
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-tertiary)',
              marginBottom: '32px',
              lineHeight: 1.6,
              fontFamily: '"Inter", sans-serif',
              fontWeight: 500,
            }}
          >
            Create a free account to unlock unlimited AI lessons, visual learning sessions, 
            and cloud-synced progress.
          </p>

          {/* Benefits list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '32px',
              textAlign: 'left',
            }}
          >
            {[
              { icon: Sparkles, text: 'Unlimited AI interactions' },
              { icon: BookOpen, text: 'All teaching modes unlocked' },
              { icon: Shield, text: 'Cloud-synced learning progress' },
            ].map(({ icon: Icon, text }, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(139,92,246,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} strokeWidth={2.5} style={{ color: '#8b5cf6' }} />
                </div>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    fontFamily: '"Inter", sans-serif',
                  }}
                >
                  {text}
                </span>
              </motion.div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleSignUp}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '16px',
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: '"Inter", sans-serif',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Sparkles size={16} strokeWidth={2.5} />
              Create Free Account
            </button>

            <button
              onClick={handleSignIn}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: '"Inter", sans-serif',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <LogIn size={16} strokeWidth={2} />
              Already have an account? Sign In
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TrialLimitOverlay;
