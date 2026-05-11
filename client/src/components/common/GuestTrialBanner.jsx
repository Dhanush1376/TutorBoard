import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, LogIn, AlertTriangle, Zap } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../hooks/useAuth';
import { TRIAL_LIMITS } from '../../constants/trialConfig';

/**
 * GuestTrialBanner — A compact, premium banner that appears in the sidebar
 * for guest users, showing their remaining trial usage and an upgrade CTA.
 */
const GuestTrialBanner = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { guestTrialStatus, isHydrated } = useTutorStore();

  if (!isHydrated || authLoading || (user && !user.isGuest)) return null;

  const { messageCount, isLimitReached, warning } = guestTrialStatus;
  const remaining = Math.max(0, TRIAL_LIMITS.MAX_MESSAGES - messageCount);
  const progress = messageCount / TRIAL_LIMITS.MAX_MESSAGES;

  const handleSignUp = () => {
    // Clear guest session and navigate to auth
    logout(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 28, stiffness: 250, mass: 0.8 }}
      className="mx-2 mb-4 relative z-[100]"
    >
      <div
        className="glass-strong relative overflow-hidden group"
        style={{
          borderRadius: '16px',
          padding: '14px 14px',
          border: '1px solid var(--glass-border)',
          background: isLimitReached 
            ? 'rgba(239, 68, 68, 0.04)' 
            : 'var(--glass-bg)',
        }}
      >
        {/* Animated Background Mesh (Subtle) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
          <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,var(--text-primary)_0%,transparent_70%)]" />
        </div>

        {/* Shimmer Highlight */}
        <motion.div
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 5 }}
          className="absolute top-0 left-0 w-1/3 h-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(var(--bg-primary-rgb), 0.15), transparent)',
            transform: 'skewX(-20deg)',
          }}
        />

        {/* Header: Status + Usage */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-5 h-5 rounded-lg flex items-center justify-center transition-colors"
              style={{ 
                background: isLimitReached ? '#ef4444' : 'var(--text-primary)',
                color: 'var(--bg-primary)'
              }}
            >
              {isLimitReached ? <AlertTriangle size={10} strokeWidth={3} /> : <Zap size={10} strokeWidth={3} />}
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80"
              style={{ color: isLimitReached ? '#ef4444' : 'var(--text-primary)' }}
            >
              {isLimitReached ? 'Trial Ended' : 'Trial Mode'}
            </span>
          </div>

          <span className="text-[11px] font-mono font-medium opacity-50 tracking-tighter">
            {Math.min(messageCount, TRIAL_LIMITS.MAX_MESSAGES)}<span className="opacity-30 mx-0.5">/</span>{TRIAL_LIMITS.MAX_MESSAGES}
          </span>
        </div>

        {/* Messaging Area */}
        <div className="mb-3.5">
          <p className="text-[12.5px] leading-relaxed font-normal text-[var(--text-primary)] opacity-90 mb-1.5">
            {isLimitReached
              ? 'Your trial sessions are complete.'
              : warning
                ? `Only ${remaining} messages left.`
                : `${remaining} free messages left.`}
          </p>
          <p className="text-[11px] leading-snug font-normal text-[var(--text-secondary)] opacity-60">
            {isLimitReached
              ? 'Create a free account to continue your learning journey without limits.'
              : 'Sign up to unlock persistent history and high-capacity AI models.'}
          </p>
        </div>

        {/* Progress System */}
        <div className="relative h-[2px] w-full bg-[var(--border-color)] rounded-full mb-4 overflow-hidden opacity-40">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress * 100, 100)}%` }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="absolute top-0 left-0 h-full rounded-full"
            style={{ 
              background: isLimitReached ? '#ef4444' : 'var(--text-primary)',
            }}
          />
        </div>

        {/* Premium CTA Button */}
        <button
          onClick={handleSignUp}
          className="w-full relative flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all duration-500 overflow-hidden group/btn"
          style={{
            background: isLimitReached ? '#ef4444' : 'var(--text-primary)',
            color: 'var(--bg-primary)',
            boxShadow: isLimitReached 
              ? '0 8px 24px rgba(239,68,68,0.25)' 
              : '0 12px 32px rgba(0,0,0,0.15)',
          }}
        >
          {/* Internal Button Hover Shimmer */}
          <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-700">
            <div className="absolute top-0 left-0 w-full h-full bg-white/10 blur-xl" />
          </div>

          <span className="relative z-10 flex items-center gap-2.5">
            {isLimitReached ? (
              <Sparkles size={14} strokeWidth={2.5} className="group-hover/btn:rotate-12 transition-transform" />
            ) : (
              <LogIn size={14} strokeWidth={2.5} className="group-hover/btn:-translate-x-0.5 transition-transform" />
            )}
            <span className="text-[12.5px] font-bold tracking-tight">
              {isLimitReached ? 'Unlock Full Access' : 'Sign Up Free'}
            </span>
          </span>
        </button>

        {/* Small "Already a member?" link for completeness */}
        {!isLimitReached && (
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => logout(true)} 
              className="text-[9px] font-medium uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-40 hover:opacity-100"
            >
              Sign In to existing account
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GuestTrialBanner;
