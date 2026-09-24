import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AuthLanding from '../AuthLanding';
import { useAuth } from '../../hooks/useAuth';

// Mock Framer Motion to skip animations
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock routing
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock hooks
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../store/tutorStore', () => ({
  default: () => ({ showToast: vi.fn() }),
}));

// Mock Child Components
vi.mock('../../components/layout/VisaiLogo', () => ({ default: () => <div data-testid="logo" /> }));
vi.mock('../../components/layout/LoginNavbar', () => ({ default: () => <div data-testid="nav" /> }));
vi.mock('../../components/auth/CinematicTransition', () => ({ default: () => <div data-testid="cinematic" /> }));

describe('AuthLanding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('Case 1: Redirects registered authenticated user to /session', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { isGuest: false } });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthLanding />
      </MemoryRouter>
    );
    expect(mockNavigate).toHaveBeenCalledWith('/session', { replace: true });
  });

  it('Case 2: Keeps signup form mounted and usable for guest users visiting /login?mode=signup', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { isGuest: true } });
    render(
      <MemoryRouter initialEntries={['/login?mode=signup']}>
        <AuthLanding />
      </MemoryRouter>
    );
    // Should NOT redirect
    expect(mockNavigate).not.toHaveBeenCalled();
    // The form should be visible
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
  });

  it('Case 3: Keeps auth UI accessible for guest user visiting conversion/login route', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { isGuest: true } });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthLanding />
      </MemoryRouter>
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
  });

  it('Case 4: Redirects guest who successfully becomes registered', () => {
    // Initial render as guest
    useAuth.mockReturnValue({ isAuthenticated: true, user: { isGuest: true } });
    const { rerender } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthLanding />
      </MemoryRouter>
    );
    expect(mockNavigate).not.toHaveBeenCalled();

    // Re-render as registered user
    useAuth.mockReturnValue({ isAuthenticated: true, user: { isGuest: false } });
    rerender(
      <MemoryRouter initialEntries={['/login']}>
        <AuthLanding />
      </MemoryRouter>
    );
    expect(mockNavigate).toHaveBeenCalledWith('/session', { replace: true });
  });
});
