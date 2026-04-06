import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Sparkles, User, Lock, Mail, Code, Zap, Globe, Calculator } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import VisaiLogo from '../components/common/VisaiLogo';

const AuthLanding = () => {
  const navigate = useNavigate();
  const { login, signup, loginGuest, isAuthenticated, user } = useAuth();
  
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Advanced Demo State
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [demoPhase, setDemoPhase] = useState('ask'); // 'ask', 'think', 'view'

  const topics = [
    {
      subject: "Computer Science",
      question: "How does a BST work?",
      icon: <Code className="w-5 h-5" />,
      color: "var(--text-primary)",
      visualization: "bst"
    },
    {
      subject: "Biology",
      question: "Show me the structure of a Cell.",
      icon: <Zap className="w-5 h-5 opacity-70" />,
      color: "var(--text-secondary)",
      visualization: "cell"
    },
    {
      subject: "Physics",
      question: "Why do planets stay in orbit?",
      icon: <Globe className="w-5 h-5 opacity-70" />,
      color: "var(--text-secondary)",
      visualization: "orbit"
    },
    {
      subject: "Mathematics",
      question: "How to find the area of a circle?",
      icon: <Calculator className="w-5 h-5 opacity-70" />,
      color: "var(--text-secondary)",
      visualization: "math"
    }
  ];

  useEffect(() => {
    let isMounted = true;
    const runSequence = async () => {
      while (isMounted) {
        setDemoPhase('ask');
        await new Promise(r => setTimeout(r, 2500));
        if (!isMounted) break;
        
        setDemoPhase('think');
        await new Promise(r => setTimeout(r, 1500));
        if (!isMounted) break;
        
        setDemoPhase('view');
        await new Promise(r => setTimeout(r, 5000));
        if (!isMounted) break;
        
        setActiveTopicIndex((prev) => (prev + 1) % topics.length);
      }
    };
    runSequence();
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Email and password are required.');
      return;
    }
    if (!isLogin && !formData.name) {
      setError('Name is required to sign up.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await signup(formData.name, formData.email, formData.password, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  const currentTopic = topics[activeTopicIndex];

  return (
    <div className="lg:h-screen w-full flex flex-col lg:flex-row bg-[var(--bg-primary)] font-sans overflow-hidden selection:bg-[var(--text-primary)] selection:text-[var(--bg-primary)]">
      
      {/* ── LEFT COLUMN: AUTH FORM ────────────────────────────────────────── */}
      <div className="lg:w-[45%] xl:w-[40%] flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative z-10 bg-[var(--bg-primary)]">
        


        <div className="max-w-[400px] w-full mx-auto lg:mx-0">
          <div className="mb-6">
            <h1 className="text-[40px] leading-[1.1] font-serif mb-2 text-[var(--text-primary)] tracking-tight">
              {isLogin ? 'Sign in to account' : 'Create an account'}
            </h1>
            <p className="text-[var(--text-secondary)] text-[14px] font-medium opacity-80">
              {isLogin ? 'Welcome back, please enter your details.' : 'Enter your details to get started.'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[13px] font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-1.5 overflow-hidden"
                >
                  <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)] ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors" />
                    <input
                      type="text"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-[var(--bg-secondary)] border border-transparent focus:border-[var(--border-color)] text-[var(--text-primary)] rounded-xl py-3 pl-11 pr-4 outline-none placeholder:text-[var(--text-tertiary)] transition-all text-[13px] font-medium"
                      disabled={loading}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)] ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-[var(--bg-secondary)] border border-transparent focus:border-[var(--border-color)] text-[var(--text-primary)] rounded-xl py-3 pl-11 pr-4 outline-none placeholder:text-[var(--text-tertiary)] transition-all text-[13px] font-medium"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Password</label>
                {isLogin && (
                  <button type="button" className="text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-[var(--bg-secondary)] border border-transparent focus:border-[var(--border-color)] text-[var(--text-primary)] rounded-xl py-3 pl-11 pr-4 outline-none placeholder:text-[var(--text-tertiary)] transition-all text-[13px] font-medium"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)] text-[var(--bg-primary)] rounded-xl py-3.5 px-4 font-bold text-[13px] hover:opacity-95 shadow-xl shadow-[var(--border-color)] active:scale-[0.98] transition-all mt-2 flex justify-center items-center gap-2 group border border-white/5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? 'Sign In to TutorBoard' : 'Create Account'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-4 my-7">
            <div className="h-[1px] flex-1 bg-[var(--border-color)] opacity-40"></div>
            <span className="text-[var(--text-tertiary)] text-[8px] font-bold tracking-[0.2em] uppercase">Or continue with</span>
            <div className="h-[1px] flex-1 bg-[var(--border-color)] opacity-40"></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              type="button" 
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/google`}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-[12px] font-bold text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-all active:scale-95 shadow-sm"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="w-4 h-4" alt="Google" />
              Google
            </button>
            <button 
              type="button" 
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/github`}
              className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#0d1117] border border-white/10 hover:bg-[#161b22] hover:border-white/20 transition-all active:scale-95 shadow-lg"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </button>
          </div>

          <div className="text-center flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-[13px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
            <div className="h-[1px] w-8 bg-[var(--border-color)] opacity-20 mx-auto"></div>
            <button
              type="button"
              onClick={() => {
                loginGuest();
                navigate('/dashboard');
              }}
              className="text-[12px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5 italic"
            >
              Skip and try as guest <Sparkles className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* ── RIGHT COLUMN: SHOWCASE ────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-primary)] to-[var(--bg-tertiary)] relative overflow-hidden flex-col h-screen border-l border-[var(--border-color)]">

        {/* Glow Effects */}
        <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] bg-purple-200/10 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[10%] left-[5%] w-[450px] h-[450px] bg-orange-100/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Navbar */}
        <nav className="flex items-center justify-between w-full px-12 py-8 relative z-20 shrink-0">
          <div className="flex items-center">
            <VisaiLogo size="sm" className="text-[var(--text-primary)]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-primary)] ml-[-8px]">
              TutorBoard
            </span>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-7 text-[12px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
               <button className="hover:text-[var(--text-primary)] transition-colors">How it works</button>
               <button className="hover:text-[var(--text-primary)] transition-colors">Features</button>
               <button className="hover:text-[var(--text-primary)] transition-colors">Solutions</button>
               <button className="hover:text-[var(--text-primary)] transition-colors">About</button>
            </div>
            
            <AnimatePresence mode="wait">
              {isAuthenticated ? (
                <motion.div 
                  key="authenticated-nav"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-6"
                >
                  {!user?.isGuest && (
                    <button className="text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5">
                      <User size={14} /> Profile
                    </button>
                  )}
                  <button 
                    onClick={() => navigate('/dashboard')}
                    className="text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5"
                  >
                    Dashboard <ArrowRight className="w-3 h-3 opacity-50" />
                  </button>
                </motion.div>
              ) : (
                <motion.button 
                  key="guest-nav"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => {
                    loginGuest();
                    navigate('/dashboard');
                  }}
                  className="text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5"
                >
                  Try TutorBoard <ArrowRight className="w-3 h-3 opacity-50" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Showcase Container */}
        <div className="flex-1 flex items-center justify-center p-8 lg:p-12 relative z-10 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTopicIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[40px] p-8 lg:p-10 max-w-[540px] w-full shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] relative flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center shadow-sm">
                   {currentTopic.icon}
                </div>
                <div className="px-3.5 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {currentTopic.subject}
                </div>
              </div>

              <h2 className="text-[34px] lg:text-[38px] leading-[1.05] font-serif mb-5 text-[var(--text-primary)] tracking-tight shrink-0">
                {currentTopic.visualization === 'bst' && "Master concepts faster with interactive models."}
                {currentTopic.visualization === 'cell' && "Explore the building blocks of life."}
                {currentTopic.visualization === 'orbit' && "Understand the laws of the universe."}
                {currentTopic.visualization === 'math' && "Visualize calculations with geometric clarity."}
              </h2>
              
              <p className="text-[var(--text-secondary)] text-[15px] leading-[1.5] mb-8 font-medium max-w-[95%] shrink-0 opacity-80">
                {currentTopic.visualization === 'bst' && "TutorBoard is your personal learning canvas. Join a community of learners pushing boundaries."}
                {currentTopic.visualization === 'cell' && "Internal structures aren't just diagrams anymore. Experience them in 3D-like clarity."}
                {currentTopic.visualization === 'orbit' && "From planetary orbits to atomic systems, visualize the invisible patterns of reality."}
                {currentTopic.visualization === 'math' && "Abstract formulas become concrete visual relationships. Learn math by seeing it happen."}
              </p>

              {/* Animation Arena */}
              <div className="flex-1 min-h-0 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[28px] overflow-hidden flex flex-col relative">
                  <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
                  
                  <div className="flex-1 p-6 flex flex-col justify-center gap-4 relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {demoPhase === 'ask' && (
                        <motion.div
                          key="q"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="self-end bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-2.5 rounded-2xl rounded-tr-none text-[13px] font-medium shadow-sm max-w-[80%]"
                        >
                          {currentTopic.question}
                        </motion.div>
                      )}

                      {demoPhase === 'think' && (
                        <motion.div
                          key="t"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="self-start flex gap-3 items-center"
                        >
                          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--bg-primary)] border border-[var(--border-color)]">
                             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                                <Sparkles className="w-3 h-3 text-[var(--text-primary)]" />
                             </motion.div>
                          </div>
                          <span className="text-[12px] font-bold text-[var(--text-secondary)] tracking-wide italic">Generating visual...</span>
                        </motion.div>
                      )}

                      {demoPhase === 'view' && (
                        <motion.div
                          key="v"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center gap-4 w-full h-full justify-center"
                        >
                           {/* BST VISUALIZATION */}
                           {currentTopic.visualization === 'bst' && (
                             <div className="flex flex-col items-center gap-3">
                                <div className="w-9 h-9 rounded-full border-2 border-[var(--text-primary)]/20 flex items-center justify-center font-bold text-[var(--text-primary)] bg-[var(--bg-primary)] text-[13px] shadow-sm">8</div>
                                <div className="flex justify-between w-28 px-4 opacity-10">
                                   <div className="h-6 w-[1.5px] bg-[var(--text-primary)] rotate-[35deg]" />
                                   <div className="h-6 w-[1.5px] bg-[var(--text-primary)] -rotate-[35deg]" />
                                </div>
                                <div className="flex justify-between w-32 px-1">
                                   <div className="w-9 h-9 rounded-full border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-primary)] text-[12px]">3</div>
                                   <div className="w-9 h-9 rounded-full border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-primary)] text-[12px]">10</div>
                                </div>
                             </div>
                           )}

                           {/* CELL VISUALIZATION */}
                           {currentTopic.visualization === 'cell' && (
                             <div className="relative w-32 h-32 flex items-center justify-center">
                                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute inset-0 bg-[var(--text-primary)]/5 border-2 border-[var(--text-primary)]/10 rounded-full shadow-inner" />
                                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-12 h-12 bg-[var(--text-primary)]/20 border border-[var(--text-primary)]/30 rounded-full flex items-center justify-center">
                                  <div className="w-4 h-4 bg-[var(--text-primary)]/40 rounded-full" />
                                </motion.div>
                                <motion.div animate={{ x: [0, 40, 0, -40, 0], y: [0, -40, -80, -40, 0] }} transition={{ repeat: Infinity, duration: 8 }} className="absolute w-4 h-2 bg-[var(--text-primary)]/20 rounded-full flex items-center justify-center text-[6px]">
                                   <div className="w-full h-[1px] bg-[var(--text-primary)]/30 rotate-45" />
                                </motion.div>
                             </div>
                           )}

                           {/* ORBIT VISUALIZATION */}
                           {currentTopic.visualization === 'orbit' && (
                             <div className="relative w-40 h-40 flex items-center justify-center">
                                <div className="w-12 h-12 bg-[var(--text-primary)]/10 border border-[var(--border-color)] rounded-full shadow-[0_0_20px_rgba(0,0,0,0.02)]" />
                                <motion.div 
                                  animate={{ rotate: 360 }} 
                                  transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                                  className="absolute w-full h-full border border-[var(--text-primary)]/5 rounded-full"
                                >
                                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-[var(--text-primary)]/80 rounded-full shadow-md" />
                                </motion.div>
                             </div>
                           )}

                           {/* MATH VISUALIZATION */}
                           {currentTopic.visualization === 'math' && (
                             <div className="flex flex-col items-center gap-4">
                                <div className="relative w-28 h-28 border-2 border-[var(--text-primary)]/20 rounded-full flex items-center justify-center bg-[var(--text-primary)]/5">
                                   <motion.div initial={{ width: 0 }} animate={{ width: 56 }} transition={{ duration: 1, delay: 0.5 }} className="h-[2px] bg-[var(--text-primary)]/40 absolute left-1/2 origin-left flex items-center justify-center">
                                      <span className="text-[10px] bg-[var(--bg-primary)] px-1 border border-[var(--border-color)] rounded relative -top-3 text-[var(--text-secondary)]">r</span>
                                   </motion.div>
                                   <div className="w-1 h-1 rounded-full bg-[var(--text-primary)]/60" />
                                </div>
                                <div className="font-serif italic text-[var(--text-primary)] text-[20px]">
                                  A = <span className="text-[var(--text-primary)] opacity-70">π</span> r<sup className="text-[14px]">2</sup>
                                </div>
                             </div>
                           )}

                           <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-3 py-1 rounded-full border border-[var(--border-color)] mt-2">
                             Visual Understanding
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-primary)] opacity-40 flex items-center justify-between shrink-0">
                    <div className="flex gap-1.5 grayscale">
                      <div className="w-2 h-2 rounded-full bg-[var(--text-primary)] opacity-20" />
                      <div className="w-2 h-2 rounded-full bg-[var(--text-primary)] opacity-20" />
                      <div className="w-2 h-2 rounded-full bg-[var(--text-primary)] opacity-20" />
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse" />
                       <span className="text-[9px] font-bold uppercase tracking-tighter text-[var(--text-tertiary)]">Powered by TutorBoard AI</span>
                    </div>
                  </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-8 mt-auto text-[var(--text-primary)] opacity-20 text-[9px] uppercase font-bold tracking-[0.4em] shrink-0 text-center">
          Across every subject · Experience the Future
        </div>
      </div>
    </div>
  );
};

export default AuthLanding;
