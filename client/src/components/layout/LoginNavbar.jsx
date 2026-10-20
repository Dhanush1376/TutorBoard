import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, User, Sparkles, Zap, Layout, Info, ChevronRight, Globe, ExternalLink, Code } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import BrandLockup from './BrandLockup';
import ThemeToggle from '../ui/ThemeToggle';

const LoginNavbar = ({ compact = false, onMenuOpenChange }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { isAuthenticated, user, loginGuest } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Reset menu on route change
    React.useEffect(() => {
        setIsMenuOpen(false);
        onMenuOpenChange?.(false);
    }, [location.pathname]);

    // Lock body scroll when mobile menu is open (only in non-compact full screen mode)
    React.useEffect(() => {
        if (isMenuOpen && !compact) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isMenuOpen, compact]);

    const links = [
        { label: 'How it works', path: '/how-it-works' },
        { label: 'Features', path: '/features' },
        { label: 'Solutions', path: '/solutions' },
        { label: 'About', path: '/about' },
    ];

    const mobileDrawerItems = [
        ...links,
        ...(!isAuthenticated && location.pathname !== '/login'
            ? [{ label: 'Get started', path: '/login', isButton: true }]
            : []),
    ];

    const toggleMenu = () => {
        setIsMenuOpen(prev => {
            const next = !prev;
            onMenuOpenChange?.(next);
            return next;
        });
    };

    return (
        <>
        <nav className={`${compact ? 'relative w-full h-10 lg:h-11 bg-transparent' : 'fixed top-0 left-0 right-0 h-14 bg-transparent'} z-[102] border-none transition-colors pointer-events-auto`}>
            <div className={`${compact ? 'w-full px-1.5' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-10'} h-full flex items-center justify-between font-sans`}>
                {/* Logo Area */}
                <Link to="/" className="flex items-center cursor-pointer select-none transition-opacity hover:opacity-70">
                    <BrandLockup />
                </Link>

                {/* Desktop Navigation Links (Only in full navbar mode) */}
                {!compact && (
                <div className="hidden lg:flex items-center gap-10">
                    <div className="flex items-center gap-8 text-[11px] font-normal uppercase tracking-widest text-[var(--text-secondary)]">
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

                    <ThemeToggle />

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
                                Try Free — 10 Messages <ArrowRight size={14} strokeWidth={3} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
                )}

                {/* Navigation Controls */}
                <div className={`${compact ? 'flex' : 'lg:hidden flex'} items-center gap-2.5`}>
                    {/* Celestial Theme Toggle Button */}
                    <ThemeToggle />

                    {/* Tactile Circular Menu Button */}
                    <button 
                        type="button"
                        onClick={toggleMenu}
                        aria-label="Toggle navigation menu"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-xs cursor-pointer relative z-[110] ${
                            isMenuOpen 
                                ? 'bg-black/10 dark:bg-white/10 text-[var(--text-primary)] dark:text-white border border-black/15 dark:border-white/20' 
                                : 'bg-transparent hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)]'
                        }`}
                    >
                        <AnimatePresence mode="wait">
                            {isMenuOpen ? (
                                <motion.div 
                                    key="close" 
                                    initial={{ rotate: -90, opacity: 0, scale: 0.8 }} 
                                    animate={{ rotate: 0, opacity: 1, scale: 1 }} 
                                    exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <X size={15} strokeWidth={2.2} />
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="menu" 
                                    initial={{ rotate: 90, opacity: 0, scale: 0.8 }} 
                                    animate={{ rotate: 0, opacity: 1, scale: 1 }} 
                                    exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex flex-col items-end justify-center gap-[4px] w-3.5"
                                >
                                    <span className="w-3.5 h-[1.75px] bg-current rounded-full" />
                                    <span className="w-2.5 h-[1.75px] bg-current rounded-full" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </div>
        </nav>

        {/* Minimalist Animate-Down Popover Menu */}
        <AnimatePresence>
            {isMenuOpen && (
                <>
                    {/* Transparent Click-Outside Overlay for entire screen */}
                    <div
                        onClick={toggleMenu}
                        className="fixed inset-0 z-[100] cursor-default"
                        aria-hidden="true"
                    />

                    {/* Subtle Transparent Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        onClick={toggleMenu}
                        className={`${compact ? 'fixed top-0 left-0 w-full lg:w-1/4 h-screen z-[101]' : 'fixed inset-0 z-[101] lg:hidden'} cursor-default bg-[var(--bg-primary)]/35 dark:bg-black/45 backdrop-blur-sm`}
                        aria-hidden="true"
                    />

                    {/* Floating Menu - All Right-Aligned, Container Removed */}
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        style={{ transformOrigin: 'top right' }}
                        className={`${compact ? 'absolute top-[46px] right-2 z-[105]' : 'fixed top-[58px] right-6 z-[105] lg:hidden'} py-1 px-1 flex flex-col items-end pointer-events-auto select-none`}
                    >
                        {/* Minimalist Numeric Index Navigation - Right Aligned */}
                        <div className="flex flex-col items-end gap-3.5 py-1">
                            {mobileDrawerItems.map((item, i) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <motion.div
                                        key={item.label}
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.18, delay: i * 0.025 }}
                                        className="flex justify-end w-full"
                                    >
                                        {item.isButton ? (
                                            <Link 
                                                to={item.path} 
                                                onClick={toggleMenu}
                                                style={{
                                                    backgroundColor: 'var(--text-primary)',
                                                    color: 'var(--bg-primary)',
                                                }}
                                                className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-full text-[13px] font-semibold tracking-tight hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer select-none"
                                            >
                                                {item.label}
                                            </Link>
                                        ) : item.onClick ? (
                                            <button 
                                                onClick={item.onClick}
                                                className="group flex items-center justify-end gap-2.5 py-1 text-right cursor-pointer select-none"
                                            >
                                                <span className="text-[14px] font-normal tracking-tight text-[var(--text-primary)] dark:text-neutral-200 group-hover:text-purple-600 dark:group-hover:text-white transition-colors">
                                                    {item.label}
                                                </span>
                                                <span className="h-[1.5px] rounded-full transition-all duration-300 w-4 bg-[var(--border-color)] dark:bg-neutral-700 group-hover:w-6 group-hover:bg-purple-500" />
                                            </button>
                                        ) : (
                                            <Link 
                                                to={item.path} 
                                                onClick={toggleMenu}
                                                className="group flex items-center justify-end gap-2.5 py-1 text-right cursor-pointer select-none"
                                            >
                                                <span className={`text-[14px] tracking-tight transition-colors ${
                                                    isActive 
                                                        ? 'text-purple-600 dark:text-purple-300 font-medium' 
                                                        : 'font-normal text-[var(--text-primary)] dark:text-neutral-200 group-hover:text-purple-600 dark:group-hover:text-white'
                                                }`}>
                                                    {item.label}
                                                </span>
                                                <span className={`h-[1.5px] rounded-full transition-all duration-300 ${
                                                    isActive 
                                                        ? 'w-6 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.7)]' 
                                                        : 'w-4 bg-[var(--border-color)] dark:bg-neutral-700 group-hover:w-6 group-hover:bg-purple-500'
                                                }`} />
                                            </Link>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Minimalist Bottom Whisper - Right Aligned */}
                        <div className="pt-2 mt-1 border-t border-[var(--border-color)]/30 dark:border-white/[0.06] flex items-center justify-end gap-2 text-[11px] font-normal text-[var(--text-tertiary)] dark:text-neutral-500/70 select-none pointer-events-none">
                            <span>TutorBoard</span>
                            <span>v1.0.4</span>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
        </>
    );
};

export default LoginNavbar;
