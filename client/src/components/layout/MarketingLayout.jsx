import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, MotionConfig, useScroll, useSpring } from 'framer-motion';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import BrandLockup from './BrandLockup';
import LoginNavbar from './LoginNavbar';
import ThemeToggle from '../ui/ThemeToggle';
import {
  Container,
  ScrollContainerContext,
  SectionContext,
  SlideArrow,
  useSections,
  useStartLearning,
} from '../../pages/Marketing/kit';

const LINKS = [
  { path: '/how-it-works', id: 'how-it-works', label: 'How it works' },
  { path: '/features', id: 'features', label: 'Features' },
  { path: '/solutions', id: 'solutions', label: 'Solutions' },
  { path: '/about', id: 'about', label: 'About' },
];

// Every marketing route is the same one-page landing, scrolled to its section.
const SECTION_FOR_PATH = { '/': null, ...Object.fromEntries(LINKS.map((l) => [l.path, l.id])) };

/** Links that scroll even when the URL already matches. */
function useSectionLink() {
  const location = useLocation();
  const { scrollToSection } = useSections();
  return (path, id) => (e) => {
    if (location.pathname === path) {
      e.preventDefault();
      scrollToSection(id);
    }
  };
}

function DesktopNav() {
  const { isAuthenticated } = useAuth();
  const { active: current } = useSections();
  const onLink = useSectionLink();

  return (
    <header className="fixed inset-x-0 top-0 z-50 hidden lg:block">
      {/* A soft scrim, so stars and subjects fade out before they reach the bar. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[var(--bg-primary)] via-[rgba(var(--bg-primary-rgb),0.7)] to-transparent" />
      <div className="relative mx-auto grid h-[76px] max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center px-8">
        <Link to="/" onClick={onLink('/', null)} className="flex items-center justify-self-start transition-opacity hover:opacity-70">
          <BrandLockup />
        </Link>

        <nav
          aria-label="Sections"
          className="flex items-center gap-0.5 rounded-full border border-[var(--mk-line-strong)] bg-[rgba(var(--bg-primary-rgb),0.62)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_40px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl backdrop-saturate-150"
        >
          {LINKS.map((link) => {
            const active = current === link.id;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={onLink(link.path, link.id)}
                aria-current={active ? 'true' : undefined}
                className={`relative flex h-9 items-center gap-2 rounded-full px-4 text-[13px] tracking-[-0.01em] transition-colors duration-300 ${
                  active ? 'text-[var(--text-primary)]!' : 'text-[var(--text-secondary)]! hover:text-[var(--text-primary)]!'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mk-nav-active"
                    className="absolute inset-0 rounded-full border border-[var(--mk-line)] bg-[var(--mk-ink-soft)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                  />
                )}
                <span
                  className={`relative h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                    active ? 'scale-100 bg-[var(--mk-accent)]' : 'scale-0 bg-transparent'
                  }`}
                />
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          {!isAuthenticated && (
            <Link
              to="/login"
              className="px-2.5 text-[13px] tracking-[-0.01em] text-[var(--text-secondary)]! transition-colors duration-300 hover:text-[var(--text-primary)]!"
            >
              Sign in
            </Link>
          )}
          <ThemeToggle />
          <Link
            to="/login"
            style={{
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
            }}
            className="group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full pl-5 pr-4 text-[13px] font-medium tracking-[-0.01em] transition-[opacity,transform] duration-300 hover:opacity-90 active:scale-[0.97]"
          >
            <span>{isAuthenticated ? 'Open app' : 'Start free'}</span>
            <SlideArrow size={13} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <div className="text-[11px] sm:text-[12px] font-medium text-[var(--text-tertiary)]">{title}</div>
      <ul className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2.5">{children}</ul>
    </div>
  );
}

const footerLink =
  'cursor-pointer text-[12.5px] sm:text-[14px] tracking-[-0.01em] text-[var(--text-secondary)]! transition-colors duration-300 hover:text-[var(--text-primary)]!';

function Footer() {
  const start = useStartLearning();
  return (
    <footer className="relative border-t border-[var(--mk-line)]">
      <Container className="grid gap-12 py-14 md:grid-cols-12 lg:py-20">
        <div className="md:col-span-5">
          <Link to="/" className="inline-flex items-center transition-opacity hover:opacity-70">
            <BrandLockup />
          </Link>
          <p className="mt-4 max-w-[32ch] text-[14px] leading-[1.6] text-[var(--text-secondary)]">
            The AI tutor that draws. Ask anything and watch it become a lesson.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-8 md:col-span-7">
          <FooterColumn title="Product">
            {LINKS.slice(0, 3).map((l) => (
              <li key={l.path}>
                <Link to={l.path} className={footerLink}>
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Company">
            <li>
              <Link to="/about" className={footerLink}>
                About
              </Link>
            </li>
          </FooterColumn>
          <FooterColumn title="Start">
            <li>
              <button type="button" onClick={start} className={footerLink}>
                Guest mode
              </button>
            </li>
            <li>
              <Link to="/login" className={footerLink}>
                Sign in
              </Link>
            </li>
          </FooterColumn>
        </div>
      </Container>
      {/* Giant Solid Brand Typography, aligned entirely to the left */}
      <div className="w-full overflow-hidden pb-8 pt-4 sm:pb-12 sm:pt-6">
        <Container className="text-left">
          <div className="group flex flex-col items-start text-left cursor-default select-none opacity-20 hover:opacity-100 transition-all duration-500 ease-out">
            <span 
              className="text-left font-bold text-[clamp(5.6rem,20vw,12rem)] tracking-[-0.05em] leading-[0.86] text-[var(--text-primary)] font-heading select-none capitalize -ml-[0.175em]"
            >
              Tutor
            </span>
            <span 
              className="text-left font-bold text-[clamp(5.6rem,20vw,12rem)] tracking-[-0.05em] leading-[0.86] text-[var(--text-primary)] font-heading select-none lowercase"
            >
              board
            </span>
          </div>
        </Container>
      </div>

      {/* Copyright row in a single clean line */}
      <Container className="flex items-center justify-between border-t border-[var(--mk-line)] py-5 text-[11.5px] sm:text-[12px] font-normal text-[var(--text-tertiary)]">
        <span>© {new Date().getFullYear()} TutorBoard</span>
        <span>All rights reserved</span>
      </Container>
    </footer>
  );
}

const MarketingLayout = () => {
  const location = useLocation();
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(null);
  const firstVisit = useRef(true);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });

  const scrollToSection = useCallback((id, smooth = true) => {
    const sc = scrollRef.current;
    if (!sc) return false;
    const behavior = smooth ? 'smooth' : 'auto';
    if (!id) {
      sc.scrollTo({ top: 0, behavior });
      return true;
    }
    const el = document.getElementById(id);
    if (!el) return false;
    sc.scrollTo({ top: el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop, behavior });
    return true;
  }, []);

  // The URL names a section; take the reader there (instantly on arrival, smoothly after).
  useEffect(() => {
    const id = SECTION_FOR_PATH[location.pathname] ?? null;
    const smooth = !firstVisit.current;
    firstVisit.current = false;
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      if (scrollToSection(id, smooth) || tries > 180) return;
      tries += 1;
      raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [location.pathname, scrollToSection]);

  const sections = useMemo(() => ({ active, setActive, scrollToSection }), [active, scrollToSection]);

  return (
    <ScrollContainerContext.Provider value={scrollRef}>
      <SectionContext.Provider value={sections}>
        <MotionConfig reducedMotion="user">
          <div
            ref={scrollRef}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 12)}
            className="relative h-screen w-full overflow-y-auto overflow-x-hidden bg-[var(--bg-primary)] font-sans text-[var(--text-primary)] selection:bg-[var(--text-primary)] selection:text-[var(--bg-primary)]"
          >
            <motion.div
              aria-hidden="true"
              className="fixed inset-x-0 top-0 z-[10000] h-[2px] origin-left bg-[var(--mk-accent)]"
              style={{ scaleX: progress }}
            />

            {/* Mobile and tablet navigation */}
            <div className="relative z-[9999] lg:hidden">
              <div
                aria-hidden="true"
                className={`fixed inset-x-0 top-0 z-[101] h-14 border-b border-[var(--mk-line)] bg-[rgba(var(--bg-primary-rgb),0.78)] backdrop-blur-xl transition-opacity duration-500 ${
                  scrolled ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <LoginNavbar />
            </div>

            <DesktopNav />

            <div className="relative">
              <Outlet />
            </div>

            <Footer />
          </div>
        </MotionConfig>
      </SectionContext.Provider>
    </ScrollContainerContext.Provider>
  );
};

export default MarketingLayout;
