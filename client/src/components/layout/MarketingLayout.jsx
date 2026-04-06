import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { ArrowRight, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../common/VisaiLogo';

const MarketingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, loginGuest } = useAuth();

  const links = [
    { path: '/how-it-works', label: 'How it works' },
    { path: '/features', label: 'Features' },
    { path: '/solutions', label: 'Solutions' },
    { path: '/about', label: 'About' },
  ];

  return (
    <div className="h-screen w-full bg-[var(--bg-primary)] font-sans overflow-x-hidden overflow-y-auto selection:bg-[var(--text-primary)] selection:text-[var(--bg-primary)] relative scroll-smooth">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] right-[10%] w-[50vh] h-[50vh] bg-purple-200/5 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[20%] left-[10%] w-[60vh] h-[60vh] bg-orange-100/5 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.01]"></div>
      </div>

      {/* Navigation: Floating Glass Pill */}
      <div className="fixed top-8 left-0 right-0 z-50 flex justify-center px-6">
        <nav 
          className="flex items-center justify-between w-full max-w-5xl px-3 py-2.5 rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-primary)]/70 backdrop-blur-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] relative"
        >
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity pl-3">
            <VisaiLogo size="md" className="text-[var(--text-primary)]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)]">
              TutorBoard
            </span>
          </Link>

          {/* Links Section: Centered */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1 bg-[var(--bg-tertiary)]/30 p-1.5 rounded-2xl border border-[var(--border-subtle)]">
            {links.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link 
                  key={link.path}
                  to={link.path} 
                  className={`relative px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                    isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute inset-0 bg-[var(--bg-primary)] shadow-sm rounded-xl z-0"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>
          
          {/* Auth Section */}
          <div className="flex items-center gap-2 pr-1">
            <AnimatePresence mode="wait">
              {isAuthenticated ? (
                <motion.div 
                  key="authenticated-nav"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3"
                >
                  <button 
                    onClick={() => navigate('/dashboard')}
                    className="bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 rounded-2xl text-[11px] font-extrabold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                  >
                    Dashboard <ArrowRight size={14} />
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
                  className="bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 rounded-2xl text-[11px] font-extrabold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                >
                  Join Board <ArrowRight size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 pt-28 pb-16 px-6 sm:px-12 lg:px-24 max-w-7xl mx-auto flex flex-col min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border-color)] py-8 px-6 sm:px-12 lg:px-24 text-center mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
          <div>© {new Date().getFullYear()} TutorBoard Inc.</div>
          <div className="flex gap-6">
            <Link to="/how-it-works" className="hover:text-[var(--text-primary)] transition-colors">How It Works</Link>
            <Link to="/features" className="hover:text-[var(--text-primary)] transition-colors">Features</Link>
            <Link to="/solutions" className="hover:text-[var(--text-primary)] transition-colors">Solutions</Link>
            <Link to="/about" className="hover:text-[var(--text-primary)] transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
