import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, User, Sparkles, Zap, Layout, Info, ChevronRight, Globe, ExternalLink, Code } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../common/VisaiLogo';

const LoginNavbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { isAuthenticated, user, loginGuest } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const links = [
        { 
            label: 'How it works', 
            path: '/how-it-works', 
            icon: <Zap size={20} />,
            color: 'text-orange-400',
            desc: 'The magic behind visual learning' 
        },
        { 
            label: 'Features', 
            path: '/features', 
            icon: <Sparkles size={20} />,
            color: 'text-purple-400',
            desc: 'Powerful tools for every subject' 
        },
        { 
            label: 'Solutions', 
            path: '/solutions', 
            icon: <Layout size={20} />,
            color: 'text-blue-400',
            desc: 'Tailored for students & teachers' 
        },
        { 
            label: 'About', 
            path: '/about', 
            icon: <Info size={20} />,
            color: 'text-emerald-400',
            desc: 'Our mission and the team' 
        },
    ];

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <>
        <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-[var(--border-color)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-20 py-4 flex items-center justify-between font-sans">
                {/* Logo Area */}
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="relative">
                        <VisaiLogo size="sm" className="text-[var(--text-primary)] transition-transform duration-500 group-hover:rotate-[360deg]" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--text-primary)] rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-[12px] font-extrabold uppercase tracking-[0.3em] text-[var(--text-primary)]">
                        TutorBoard
                    </span>
                </Link>

                {/* Desktop Navigation Links */}
                <div className="hidden lg:flex items-center gap-10">
                    <div className="flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {links.map((link) => (
                            <Link 
                                key={link.path} 
                                to={link.path} 
                                className="hover:text-[var(--text-primary)] transition-all duration-300 relative py-1 group"
                            >
                                {link.label}
                                <span className="absolute -bottom-1 left-0 w-0 h-[1.5px] bg-[var(--text-primary)] transition-all duration-300 group-hover:w-full" />
                            </Link>
                        ))}
                    </div>

                    <div className="h-4 w-[1px] bg-[var(--border-color)] opacity-50" />

                    <AnimatePresence mode="wait">
                        {isAuthenticated ? (
                            <motion.button
                                key="dashboard-btn"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                onClick={() => navigate('/dashboard')}
                                className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-[0.1em] hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--text-primary)]/10 border border-white/5"
                            >
                                Dashboard <ArrowRight size={14} strokeWidth={3} />
                            </motion.button>
                        ) : (
                            <motion.button
                                key="try-btn"
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                onClick={() => {
                                    loginGuest();
                                    navigate('/dashboard');
                                }}
                                className="flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-[0.1em] hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--text-primary)]/10 border border-white/5"
                            >
                                Try TutorBoard <ArrowRight size={14} strokeWidth={3} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mobile Menu Icon Toggle */}
                <div className="lg:hidden flex items-center gap-4">
                    <button 
                        onClick={toggleMenu}
                        className="p-2 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-2xl transition-all active:scale-90 relative z-[110]"
                    >
                        <AnimatePresence mode="wait">
                            {isMenuOpen ? (
                                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                                    <X size={22} strokeWidth={2.5} />
                                </motion.div>
                            ) : (
                                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                                    <Menu size={22} strokeWidth={2.5} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </div>
        </nav>

        {/* Mobile Sidenav Overlay & Panel - OUTSIDE of nav to avoid backdrop-filter trapping */}
        <AnimatePresence>
            {isMenuOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleMenu}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] lg:hidden"
                    />
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                        className="fixed top-0 right-0 h-full w-[85%] max-w-[360px] bg-[var(--bg-primary)] border-l border-[var(--border-color)] z-[110] lg:hidden flex flex-col shadow-2xl overflow-hidden"
                    >
                        {/* Sidenav Header */}
                        <div className="p-8 pb-6 border-b border-[var(--border-color)] bg-gradient-to-b from-[var(--bg-secondary)] to-transparent pt-12 relative">
                            {/* Close button inside aside */}
                            <button 
                                onClick={toggleMenu} 
                                className="absolute top-4 right-4 p-2 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-xl transition-all active:scale-95 z-[120]"
                            >
                                <X size={20} strokeWidth={2} />
                            </button>

                            <Link to="/" onClick={toggleMenu} className="flex items-center gap-3 mb-6 group cursor-pointer inline-flex">
                                <div className="relative">
                                    <VisaiLogo size="sm" className="text-[var(--text-primary)] transition-transform duration-500 group-hover:rotate-[360deg]" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--text-primary)] rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors">TutorBoard</span>
                                    <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Visual Learning System</span>
                                </div>
                            </Link>

                            <div className="h-[1px] w-full bg-gradient-to-r from-[var(--border-color)] to-transparent" />
                        </div>

                        {/* Sidenav Content - Links */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            {links.map((link, i) => {
                                const isActive = location.pathname === link.path;
                                return (
                                    <motion.div
                                        key={link.path}
                                        initial={{ opacity: 0, x: 40 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                    >
                                        <Link 
                                            to={link.path} 
                                            onClick={toggleMenu}
                                            className={`group flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 border ${
                                                isActive 
                                                ? 'bg-[var(--bg-secondary)] border-[var(--text-primary)]/20 shadow-sm' 
                                                : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)] hover:border-[var(--border-color)]'
                                            }`}
                                        >
                                            <div className={`mt-1 p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-sm transition-transform duration-300 group-hover:scale-110 ${link.color}`}>
                                                {link.icon}
                                            </div>
                                            <div className="flex flex-col flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[15px] font-bold tracking-tight ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                                                        {link.label}
                                                    </span>
                                                    <ChevronRight size={14} className={`transition-all duration-300 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'} text-[var(--text-tertiary)]`} />
                                                </div>
                                                <span className="text-[11px] text-[var(--text-tertiary)] font-medium leading-tight mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    {link.desc}
                                                </span>
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Sidenav Footer */}
                        <div className="p-6 mt-auto border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="relative p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden group shadow-sm mb-6"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                    <Sparkles size={64} className="text-[var(--text-primary)]" />
                                </div>
                                <div className="relative z-10 flex flex-col gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)]">Take the leap</span>
                                        <span className="text-[14px] font-serif tracking-tight text-[var(--text-secondary)] mt-1">Start your visual journey today.</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigate('/');
                                            toggleMenu();
                                        }}
                                        className="w-full flex items-center justify-center gap-2 bg-[var(--text-primary)] text-[var(--bg-primary)] py-3 rounded-xl text-[11px] font-extrabold uppercase tracking-[0.2em] shadow-lg shadow-[var(--text-primary)]/10 hover:opacity-90 active:scale-95 transition-all"
                                    >
                                        Get Started <ArrowRight size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            </motion.div>

                            <div className="flex items-center justify-between px-2 opacity-40">
                                <div className="flex gap-4">
                                    <Globe size={14} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer" />
                                    <Code size={14} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer" />
                                    <Sparkles size={14} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer" />
                                </div>
                                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] flex items-center gap-1">
                                    v1.0.4 <ExternalLink size={8} />
                                </span>
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
        </>
    );
};

export default LoginNavbar;
