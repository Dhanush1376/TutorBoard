import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ArrowRight, ChevronDown, Sparkles, User, Lock, Mail, Code, Zap, Globe, Calculator, Check, Compass, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import VisaiLogo from '../components/layout/VisaiLogo';
import useTutorStore from '../store/tutorStore';
import LoginNavbar from '../components/layout/LoginNavbar';
import BorderGlow from '../components/ui/BorderGlow';
import AuthFormSkeleton from '../components/auth/AuthFormSkeleton';
const CinematicTransition = React.lazy(() => import('../components/auth/CinematicTransition'));
import API, { BASE_URL as API_URL } from '../services/api';
import ForgotPasswordDialog from '../components/auth/ForgotPasswordDialog';
import { oauthErrorMessage } from '../components/auth/authMessages';
// The galaxy panel pulls in three.js, so it loads after the form is usable.
const AuthShowcase = React.lazy(() => import('../components/auth/AuthShowcase'));

// Fast, silky staggered entry variants for login elements
const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    filter: 'blur(3px)',
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
};

const formItemVariants = {
  hidden: { 
    opacity: 0, 
    y: 16, 
    filter: 'blur(4px)',
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { 
      duration: 0.38, 
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const AuthLanding = () => {
  const navigate = useNavigate();
  const { login, signup, loginGuest, isAuthenticated, user, loading: authLoading, isAuthResolved } = useAuth();
  
  const location = useLocation();
  // "/login?mode=signup" opens on sign-up; plain "/login" opens on sign-in.
  const [isLogin, setIsLogin] = useState(() => new URLSearchParams(location.search).get('mode') !== 'signup');

  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode');
    setIsLogin(mode !== 'signup');
  }, [location.search]);
  const { showToast } = useTutorStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isFormLoading = loading || (authLoading && !isAuthResolved);
  const [isSuccess, setIsSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  // which sign-in methods the server offers right now (admin can switch them off)
  const [providers, setProviders] = useState({ password: true, google: true, github: true, registrationEnabled: true });
  const passwordFocused = focusedField === 'password';

  useEffect(() => {
    API.get('/api/auth/providers').then((r) => r?.data && setProviders((p) => ({ ...p, ...r.data }))).catch(() => {});
  }, []);

  // OAuth callbacks come back as /login?error=<code>
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // security emails link to /login?forgot=1 ("reset your password now")
    if (params.get('forgot') === '1') setForgotOpen(true);
    const code = params.get('error');
    if (code) {
      setError(oauthErrorMessage(code, params.get('provider')));
      params.delete('error');
      params.delete('provider');
      const rest = params.toString();
      window.history.replaceState({}, document.title, `${location.pathname}${rest ? `?${rest}` : ''}`);
    }
  }, [location.search, location.pathname]);

  // Sync browser autofill values into React state
  useEffect(() => {
    const syncAutofill = () => {
      const emailEl = document.querySelector('input[type="email"]');
      const passEl = document.querySelector('input[autoComplete="current-password"]');
      const nameEl = document.querySelector('input[autoComplete="name"]');
      if (emailEl?.value || passEl?.value || nameEl?.value) {
        setFormData(prev => ({
          ...prev,
          ...(emailEl?.value ? { email: emailEl.value } : {}),
          ...(passEl?.value ? { password: passEl.value } : {}),
          ...(nameEl?.value ? { name: nameEl.value } : {}),
        }));
      }
    };
    const t1 = setTimeout(syncAutofill, 50);
    const t2 = setTimeout(syncAutofill, 250);
    const t3 = setTimeout(syncAutofill, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Redirect if already authenticated — differentiated flow for returning vs new
  useEffect(() => {
    if (isAuthenticated && !user?.isGuest && !isSuccess && !loading) {
      // SEC-25: Check if we should show the cinematic transition (e.g. just logged in)
      const justLoggedIn = sessionStorage.getItem('tb-just-logged-in') === 'true';
      if (justLoggedIn) {
        setIsSuccess(true);
        sessionStorage.removeItem('tb-just-logged-in'); // Consume the flag
        return;
      }

      // RETURNING USER (Already logged in previously): Skip the cinematic transition for speed
      navigate('/session', { replace: true });
    }
  }, [isAuthenticated, user?.isGuest, isSuccess, loading, navigate]);

  const validatePassword = (pass) => {
    if (pass.length < 8) return 'Password must be at least 8 characters.';
    if (!/\d/.test(pass)) return 'Password must include at least one number.';
    if (!/[A-Z]/.test(pass)) return 'Password must include at least one uppercase letter.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Email and password are required.');
      return;
    }
    
    if (!isLogin) {
      if (!formData.name) {
        setError('Name is required to sign up.');
        return;
      }
      const passError = validatePassword(formData.password);
      if (passError) {
        setError(passError);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.name, formData.email, formData.password, formData.confirmPassword);
      }
      
      // Trigger cinematic transition instead of immediate navigate
      sessionStorage.setItem('tb-just-logged-in', 'true');
      
      // UX-08: Add a tiny delay to ensure the successful auth state is captured before 
      // the AnimatePresence exit phase begins.
      setTimeout(() => {
        setIsSuccess(true);
        setLoading(false);
      }, 50);
      try {
        sessionStorage.setItem('tb-welcome-played', 'true');
      } catch (e) { /* ignore */ }
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };


  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[var(--bg-primary)] font-sans overflow-hidden selection:bg-[var(--text-primary)] selection:text-[var(--bg-primary)]">
      <AnimatePresence>
        {forgotOpen && (
          <ForgotPasswordDialog
            initialEmail={formData.email}
            onClose={(result) => {
              setForgotOpen(false);
              if (result?.email) {
                setFormData((f) => ({ ...f, email: result.email, password: '' }));
                setIsLogin(true);
                showToast({ message: 'Password updated. Sign in with your new password.', type: 'success' });
              }
            }}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <React.Suspense fallback={<div className="fixed inset-0 bg-black" />}>
            <CinematicTransition
              key="cinematic"
              userName={user?.name || formData.name || (formData.email ? formData.email.split('@')[0] : 'Explorer')}
              isLogin={isLogin}
              onComplete={() => navigate('/session')}
            />
          </React.Suspense>
        ) : (
          <motion.div 
            key="auth-ui"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            transition={{ duration: 0.8 }}
            className="flex flex-col lg:flex-row w-full h-screen overflow-hidden flex-1"
          >
            {/* ── LEFT COLUMN: AUTH FORM ────────────────────────────────────────── */}
            <div className="w-full lg:w-1/4 lg:flex-none flex flex-col justify-between items-center px-4 sm:px-6 lg:px-4 py-2 lg:py-2.5 relative z-10 bg-[var(--bg-primary)] h-screen min-h-0 overflow-x-hidden overflow-y-auto thin-scrollbar">
              
              {/* Top Navbar Elements (Mobile & Desktop in left column) */}
              <div className="w-full relative z-[999] shrink-0 mb-0.5">
                <LoginNavbar compact={true} onMenuOpenChange={setIsNavMenuOpen} />
              </div>

              {/* Left Column Architectural Grid Pattern */}
              <div 
                className="absolute inset-0 pointer-events-none overflow-hidden" 
                aria-hidden="true"
              >
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, var(--border-color) 1px, transparent 1px),
                      linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)
                    `,
                    backgroundSize: '28px 28px',
                    backgroundPosition: 'center center',
                    opacity: 0.55,
                    maskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 60%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 50%, black 60%, transparent 100%)',
                  }}
                />
                <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-neutral-400/5 dark:bg-white/[0.02] blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-neutral-400/5 dark:bg-white/[0.02] blur-3xl pointer-events-none" />
              </div>

              <div className={`w-full max-w-[295px] lg:max-w-[310px] mx-auto relative z-10 my-auto py-1 transition-all duration-300 ${isNavMenuOpen ? 'blur-sm opacity-25 scale-[0.98] pointer-events-none' : 'blur-0 opacity-100 scale-100'}`}>
                <AnimatePresence mode="wait">
                  {isFormLoading ? (
                    <motion.div
                      key="form-skeleton-view"
                      initial={{ opacity: 0, scale: 0.98, filter: 'blur(3px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.98, filter: 'blur(3px)' }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full"
                    >
                      <AuthFormSkeleton isLogin={isLogin} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form-actual-view"
                      variants={formContainerVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="w-full flex flex-col"
                    >
          <motion.div variants={formItemVariants} className="mb-3 lg:mb-4 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isLogin ? 'login-header' : 'signup-header'}
                initial={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 
                  className="font-heading font-semibold text-[var(--text-primary)] tracking-tight leading-[1.1] text-[20px] lg:text-[22px]"
                  style={{
                    fontFamily: 'var(--font-heading, "Outfit", sans-serif)',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {isLogin ? 'Welcome back' : 'Create an account'}
                </h1>
                <p className="text-[var(--text-secondary)] text-[11px] lg:text-[11.5px] leading-[1.35] mt-1 font-normal">
                  {isLogin ? 'Sign in to continue to your workspace.' : 'Join TutorBoard to explore interactive visual learning.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className="mb-3 p-2 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-[6px] text-[10.5px] font-normal flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form 
            onSubmit={handleSubmit} 
            className="flex flex-col gap-3.5 pt-1.5 overflow-visible"
          >
            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="name-field"
                  variants={formItemVariants}
                  initial={{ opacity: 0, height: 0, scale: 0.96, y: -6 }}
                  animate={{ 
                    opacity: 1, 
                    height: 'auto', 
                    scale: 1, 
                    y: 0,
                    transitionEnd: { overflow: 'visible' }
                  }}
                  exit={{ opacity: 0, height: 0, scale: 0.96, y: -6, transitionEnd: { overflow: 'hidden' } }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="notch-group overflow-visible"
                  style={{ overflow: 'visible' }}
                >
                  <BorderGlow
                    isFocused={focusedField === 'name'}
                    borderRadius={9999}
                    glowRadius={10}
                    glowIntensity={0.35}
                    edgeSensitivity={20}
                    coneSpread={20}
                    speed={0.016}
                    colors={['#ffffff', '#fb923c', '#ea580c']}
                    glowColor="26 92% 58%"
                    className="w-full"
                  >
                    <div className="relative w-full h-11 flex items-center">
                      <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 transition-colors ${focusedField === 'name' ? 'text-orange-500 dark:text-orange-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                      <input
                        type="text"
                        placeholder=" "
                        autoComplete="name"
                        value={formData.name}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        onInput={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                        className="auth-input notch-input w-full rounded-full h-full pl-10 pr-4 outline-none text-[12.5px] font-normal"
                        disabled={loading}
                      />
                      <label
                        className={`notch-label ${(formData.name || focusedField === 'name') ? 'floated' : ''}`}
                      >
                        Full Name
                      </label>
                    </div>
                  </BorderGlow>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              layout 
              variants={formItemVariants}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="notch-group overflow-visible"
              style={{ overflow: 'visible' }}
            >
              <BorderGlow
                isFocused={focusedField === 'email'}
                borderRadius={9999}
                glowRadius={10}
                glowIntensity={0.35}
                edgeSensitivity={20}
                coneSpread={20}
                speed={0.016}
                colors={['#ffffff', '#fb923c', '#ea580c']}
                glowColor="26 92% 58%"
                className="w-full"
              >
                <div className="relative w-full h-11 flex items-center">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 transition-colors ${focusedField === 'email' ? 'text-orange-500 dark:text-orange-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  <input
                    type="email"
                    placeholder=" "
                    autoComplete="email"
                    value={formData.email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    onInput={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                    className="auth-input notch-input w-full rounded-full h-full pl-10 pr-4 outline-none text-[12.5px] font-normal"
                    disabled={loading}
                  />
                  <label
                    className={`notch-label ${(formData.email || focusedField === 'email') ? 'floated' : ''}`}
                  >
                    Email Address
                  </label>
                </div>
              </BorderGlow>
            </motion.div>

            <motion.div 
              layout 
              variants={formItemVariants}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="notch-group overflow-visible"
              style={{ overflow: 'visible' }}
            >
              <BorderGlow
                isFocused={focusedField === 'password'}
                borderRadius={9999}
                glowRadius={10}
                glowIntensity={0.35}
                edgeSensitivity={20}
                coneSpread={20}
                speed={0.016}
                colors={['#ffffff', '#fb923c', '#ea580c']}
                glowColor="26 92% 58%"
                className="w-full"
              >
                <div className="relative w-full h-11 flex items-center">
                  <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 transition-colors ${focusedField === 'password' ? 'text-orange-500 dark:text-orange-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                  <input
                    type="password"
                    placeholder=" "
                    id={isLogin ? "signin-password" : "signup-password"}
                    name={isLogin ? "password" : "new-password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    value={formData.password}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    onInput={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                    className="auth-input notch-input w-full rounded-full h-full pl-10 pr-4 outline-none text-[12.5px] font-normal"
                    disabled={loading}
                  />
                  <label
                    className={`notch-label ${(formData.password || focusedField === 'password') ? 'floated' : ''}`}
                  >
                    Password
                  </label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={() => setForgotOpen(true)}
                      className="absolute right-5 top-0 -translate-y-1/2 bg-[var(--bg-primary)] px-1.5 text-[9.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer z-10"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              </BorderGlow>

              {/* Password Requirements Pop-Up Tooltip Box (Positioned ABOVE input to prevent browser autofill collision) */}
              {(() => {
                const hasLength = (formData.password || '').length >= 8;
                const hasNumber = /\d/.test(formData.password || '');
                const hasSymbol = /[A-Z]/.test(formData.password || ''); // same rule as the server
                const passStrength = [hasLength, hasNumber, hasSymbol].filter(Boolean).length;
                return (
                  <AnimatePresence>
                    {!isLogin && passwordFocused && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute left-0 right-0 bottom-[calc(100%+12px)] z-50 p-3.5 rounded-2xl bg-[#ffffff] dark:bg-[#121210] border border-[#e5e5e0] dark:border-[#262624] shadow-[0_16px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-colors duration-200"
                      >
                        {/* Downward caret pointer */}
                        <div className="absolute -bottom-1.5 left-7 w-3 h-3 bg-[#ffffff] dark:bg-[#121210] border-b border-r border-[#e5e5e0] dark:border-[#262624] rotate-45 pointer-events-none transition-colors duration-200" />

                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
                            <span className="text-[11px] font-semibold text-[#1a1a18] dark:text-[#f3f3ee] tracking-tight">
                              Password requirements
                            </span>
                          </div>
                          <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-300 ${
                            passStrength === 3 ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-500/30' :
                            passStrength === 2 ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-500/30' :
                            passStrength === 1 ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/50 dark:border-rose-500/30' :
                            'text-[#6b6960] bg-[#f4f2ec] border-[#e2e0d8] dark:text-[#a09e95] dark:bg-[#1e1e1b] dark:border-[#33322d]'
                          }`}>
                            {passStrength === 3 ? 'Strong' : passStrength === 2 ? 'Medium' : passStrength === 1 ? 'Weak' : 'Required'}
                          </span>
                        </div>

                        {/* Segmented Strength Bar */}
                        <div className="flex gap-1.5 h-[3px] mb-3">
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            passStrength >= 1 
                              ? (passStrength === 1 ? 'bg-rose-500' : passStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') 
                              : 'bg-[#e5e5e0] dark:bg-[#262624]'
                          }`} />
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            passStrength >= 2 
                              ? (passStrength === 2 ? 'bg-amber-500' : 'bg-emerald-500') 
                              : 'bg-[#e5e5e0] dark:bg-[#262624]'
                          }`} />
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            passStrength >= 3 ? 'bg-emerald-500' : 'bg-[#e5e5e0] dark:bg-[#262624]'
                          }`} />
                        </div>

                        {/* Checklist */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                              hasLength 
                                ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]' 
                                : 'bg-[#f4f2ec] dark:bg-[#1e1e1b] border border-[#e2e0d8] dark:border-[#33322d] text-[#8c897f] dark:text-[#737168]'
                            }`}>
                              {hasLength ? <Check className="w-2.5 h-2.5 stroke-[2.5]" /> : <div className="w-1 h-1 rounded-full bg-[#8c897f] dark:bg-[#737168]" />}
                            </div>
                            <span className={`text-[11px] transition-colors duration-200 ${
                              hasLength ? 'text-[#1a1a18] dark:text-[#f3f3ee] font-medium' : 'text-[#6b6960] dark:text-[#a09e95] font-normal'
                            }`}>
                              8+ characters
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                              hasNumber 
                                ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]' 
                                : 'bg-[#f4f2ec] dark:bg-[#1e1e1b] border border-[#e2e0d8] dark:border-[#33322d] text-[#8c897f] dark:text-[#737168]'
                            }`}>
                              {hasNumber ? <Check className="w-2.5 h-2.5 stroke-[2.5]" /> : <div className="w-1 h-1 rounded-full bg-[#8c897f] dark:bg-[#737168]" />}
                            </div>
                            <span className={`text-[11px] transition-colors duration-200 ${
                              hasNumber ? 'text-[#1a1a18] dark:text-[#f3f3ee] font-medium' : 'text-[#6b6960] dark:text-[#a09e95] font-normal'
                            }`}>
                              At least one number (0–9)
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                              hasSymbol 
                                ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]' 
                                : 'bg-[#f4f2ec] dark:bg-[#1e1e1b] border border-[#e2e0d8] dark:border-[#33322d] text-[#8c897f] dark:text-[#737168]'
                            }`}>
                              {hasSymbol ? <Check className="w-2.5 h-2.5 stroke-[2.5]" /> : <div className="w-1 h-1 rounded-full bg-[#8c897f] dark:bg-[#737168]" />}
                            </div>
                            <span className={`text-[11px] transition-colors duration-200 ${
                              hasSymbol ? 'text-[#1a1a18] dark:text-[#f3f3ee] font-medium' : 'text-[#6b6960] dark:text-[#a09e95] font-normal'
                            }`}>
                              At least one uppercase letter
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                );
              })()}
            </motion.div>

            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="confirm-password-field"
                  initial={{ opacity: 0, height: 0, scale: 0.96, y: -6 }}
                  animate={{ 
                    opacity: 1, 
                    height: 'auto', 
                    scale: 1, 
                    y: 0,
                    transitionEnd: { overflow: 'visible' }
                  }}
                  exit={{ opacity: 0, height: 0, scale: 0.96, y: -6, transitionEnd: { overflow: 'hidden' } }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="notch-group overflow-visible"
                  style={{ overflow: 'visible' }}
                >
                  <BorderGlow
                    isFocused={focusedField === 'confirmPassword'}
                    borderRadius={9999}
                    glowRadius={10}
                    glowIntensity={0.35}
                    edgeSensitivity={20}
                    coneSpread={20}
                    speed={0.016}
                    colors={['#ffffff', '#fb923c', '#ea580c']}
                    glowColor="26 92% 58%"
                    className="w-full"
                  >
                    <div className="relative w-full h-11 flex items-center">
                      <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 transition-colors ${focusedField === 'confirmPassword' ? 'text-orange-500 dark:text-orange-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                      <input
                        type="password"
                        placeholder=" "
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        onInput={(e) => setFormData(prev => ({...prev, confirmPassword: e.target.value}))}
                        className="auth-input notch-input w-full rounded-full h-full pl-10 pr-4 outline-none text-[12.5px] font-normal"
                        disabled={loading}
                      />
                      <label
                        className={`notch-label ${(formData.confirmPassword || focusedField === 'confirmPassword') ? 'floated' : ''}`}
                      >
                        Confirm Password
                      </label>
                    </div>
                  </BorderGlow>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              layout 
              variants={formItemVariants}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="w-full mt-1.5"
            >
              <BorderGlow
                hoverGlow
                borderRadius={9999}
                glowRadius={12}
                glowIntensity={0.38}
                coneSpread={20}
                colors={['#ffffff', '#fb923c', '#ea580c']}
                glowColor="26 92% 58%"
                className="border-glow-btn w-full"
              >
                <button
                  type="submit"
                  disabled={isFormLoading}
                  className="w-full bg-[var(--text-primary)] text-[var(--bg-primary)] font-semibold text-[11.5px] rounded-full py-2.5 px-4 hover:opacity-95 active:scale-[0.98] transition-all shadow-md flex justify-center items-center gap-1.5 cursor-pointer disabled:opacity-50 border-0 h-10"
                  style={{ borderRadius: '9999px' }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isLogin ? 'btn-signin' : 'btn-signup'}
                      initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-1.5"
                    >
                      <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </motion.span>
                  </AnimatePresence>
                </button>
              </BorderGlow>
            </motion.div>
          </form>

          <motion.div 
            layout 
            variants={formItemVariants}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="flex items-center gap-2 my-3"
          >
            <div className="h-[1px] flex-1 bg-[var(--border-color)]"></div>
            <span className="text-[var(--text-tertiary)] text-[11px] font-medium">Or continue with</span>
            <div className="h-[1px] flex-1 bg-[var(--border-color)]"></div>
          </motion.div>

          <motion.div 
            layout 
            variants={formItemVariants}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={`grid gap-2.5 mb-3 ${providers.google && providers.github ? 'grid-cols-2' : 'grid-cols-1'}`}
            hidden={!providers.google && !providers.github}
          >
            {providers.google && (
            <BorderGlow
              hoverGlow
              borderRadius={9999}
              glowRadius={10}
              glowIntensity={0.32}
              coneSpread={20}
              colors={['#ffffff', '#fb923c', '#ea580c']}
              glowColor="26 92% 58%"
              className="border-glow-btn w-full"
            >
              <button 
                type="button" 
                onClick={() => {
                  setLoading(true);
                  window.location.href = `${API_URL}/api/auth/google`;
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-[11px] font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-all active:scale-[0.98] cursor-pointer h-9"
                style={{ borderRadius: '9999px' }}
              >
                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="w-3.5 h-3.5" alt="Google" />
                <span>Google</span>
              </button>
            </BorderGlow>
            )}
            {providers.github && (
            <BorderGlow
              hoverGlow
              borderRadius={9999}
              glowRadius={10}
              glowIntensity={0.32}
              coneSpread={20}
              colors={['#ffffff', '#fb923c', '#ea580c']}
              glowColor="26 92% 58%"
              className="border-glow-btn w-full"
            >
              <button 
                type="button" 
                onClick={() => {
                  setLoading(true);
                  window.location.href = `${API_URL}/api/auth/github`;
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-[11px] font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] transition-all active:scale-[0.98] cursor-pointer h-9"
                style={{ borderRadius: '9999px' }}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>GitHub</span>
              </button>
            </BorderGlow>
            )}
          </motion.div>

          <motion.div 
            layout 
            variants={formItemVariants}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="text-center mt-2 pt-0.5 flex flex-col items-center gap-2"
          >
            <div className="relative inline-flex items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.button
                  key={isLogin ? 'switch-to-signup' : 'switch-to-signin'}
                  initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setFocusedField(null);
                  }}
                  className="text-[11.5px] font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer py-1 px-3 rounded-full hover:bg-[var(--bg-secondary)]/70 active:scale-95 group inline-flex items-center gap-1.5"
                >
                  {isLogin ? (
                    <span>
                      Don't have an account?{' '}
                      <span className="font-semibold text-[var(--text-primary)] underline underline-offset-4 decoration-[var(--border-color)] group-hover:decoration-[var(--text-primary)] transition-colors">
                        Sign up
                      </span>
                    </span>
                  ) : (
                    <span>
                      Already have an account?{' '}
                      <span className="font-semibold text-[var(--text-primary)] underline underline-offset-4 decoration-[var(--border-color)] group-hover:decoration-[var(--text-primary)] transition-colors">
                        Sign in
                      </span>
                    </span>
                  )}
                </motion.button>
              </AnimatePresence>
            </div>

            {/* Guest Access Option */}
            <button
              type="button"
              onClick={() => {
                loginGuest();
                sessionStorage.setItem('tb-just-logged-in', 'true');
                setIsSuccess(true);
              }}
              className="group inline-flex items-center gap-2 py-1 px-3.5 rounded-full text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/80 border border-transparent hover:border-[var(--border-color)] transition-all duration-200 cursor-pointer active:scale-95"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
              <span>Continue as Guest</span>
              <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 text-[var(--text-secondary)]" />
            </button>
          </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

          {/* Mobile System Badge / Footer Anchor */}
          <motion.div 
            variants={formItemVariants}
            className="lg:hidden mt-4 text-center select-none pointer-events-none"
          >
            <span className="text-[11px] font-normal text-[var(--text-tertiary)] opacity-60">
              TutorBoard • AI Visual Learning & Canvas
            </span>
          </motion.div>
        </div>

      </div>

      {/* ── RIGHT COLUMN: SHOWCASE (the landing page's galaxy) ───────────── */}
      <div className="hidden lg:flex lg:w-3/4 lg:flex-1 relative overflow-hidden flex-col h-screen border-l border-[var(--border-color)] z-20">
        <ErrorBoundary fallback={null}>
          <React.Suspense fallback={null}>
            <AuthShowcase />
          </React.Suspense>
        </ErrorBoundary>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};

export default AuthLanding;
