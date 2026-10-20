import React from 'react';
import './AuthFormSkeleton.css';

/**
 * AuthFormSkeleton.jsx
 * 
 * Ultra-detailed, 1:1 geometric skeleton for TutorBoard authentication form.
 * Matches exact padding, pill radius, icons, typography placeholders,
 * notch labels, submit button, and OAuth dividers in both Light and Dark modes.
 */
const AuthFormSkeleton = ({ isLogin = false }) => {
  return (
    <div
      className="w-full flex flex-col pointer-events-none select-none transition-opacity duration-200" 
      aria-busy="true"
      aria-live="polite"
    >
      {/* 1. Header Skeleton */}
      <div className="mb-3 lg:mb-4">
        {/* Title placeholder */}
        <div 
          className="h-6 rounded-lg bg-[var(--text-primary)]/[0.12] auth-skeleton-shimmer"
          style={{ width: isLogin ? '150px' : '185px' }}
        />
        {/* Subtitle placeholder */}
        <div className="h-3 w-full rounded-md bg-[var(--text-primary)]/[0.07] mt-2.5 auth-skeleton-shimmer" />
        <div className="h-3 w-[72%] rounded-md bg-[var(--text-primary)]/[0.07] mt-1.5 auth-skeleton-shimmer" />
      </div>

      {/* 2. Form Fields Skeleton */}
      <div className="flex flex-col gap-3.5 pt-1.5">
        {/* Name Field (Sign Up Only) */}
        {!isLogin && (
          <div className="w-full h-11 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 auth-skeleton-shimmer flex items-center px-3.5 gap-2.5 shadow-xs">
            <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]/[0.14] shrink-0" />
            <div className="h-3 w-20 rounded-full bg-[var(--text-primary)]/[0.09]" />
          </div>
        )}

        {/* Email Field */}
        <div className="w-full h-11 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 auth-skeleton-shimmer flex items-center px-3.5 gap-2.5 shadow-xs">
          <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]/[0.14] shrink-0" />
          <div className="h-3 w-28 rounded-full bg-[var(--text-primary)]/[0.09]" />
        </div>

        {/* Password Field */}
        <div className="w-full h-11 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 auth-skeleton-shimmer flex items-center px-3.5 gap-2.5 shadow-xs">
          <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]/[0.14] shrink-0" />
          <div className="h-3 w-22 rounded-full bg-[var(--text-primary)]/[0.09]" />
          {/* Eye Icon Placeholder */}
          <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]/[0.08] ml-auto shrink-0" />
        </div>

        {/* Confirm Password Field (Sign Up Only) */}
        {!isLogin && (
          <div className="w-full h-11 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 auth-skeleton-shimmer flex items-center px-3.5 gap-2.5 shadow-xs">
            <div className="w-4 h-4 rounded-full bg-[var(--text-primary)]/[0.14] shrink-0" />
            <div className="h-3 w-32 rounded-full bg-[var(--text-primary)]/[0.09]" />
          </div>
        )}

        {/* 3. Submit Button Skeleton */}
        <div className="w-full mt-1.5">
          <div className="w-full h-10 rounded-full bg-[var(--text-primary)]/[0.15] border border-[var(--text-primary)]/10 auth-skeleton-shimmer flex items-center justify-center gap-2 shadow-sm">
            <div className="h-3.5 w-24 rounded-full bg-[var(--text-primary)]/[0.25]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[var(--text-primary)]/[0.25]" />
          </div>
        </div>
      </div>

      {/* 4. Divider Skeleton */}
      <div className="flex items-center gap-2 my-3">
        <div className="h-[1px] flex-1 bg-[var(--border-color)]" />
        <div className="h-2 w-24 rounded-full bg-[var(--text-primary)]/[0.08] auth-skeleton-shimmer" />
        <div className="h-[1px] flex-1 bg-[var(--border-color)]" />
      </div>

      {/* 5. OAuth Buttons Skeleton */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {/* Google Button Skeleton */}
        <div className="w-full h-9 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 auth-skeleton-shimmer flex items-center justify-center gap-2 px-3 shadow-xs">
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--text-primary)]/[0.14] shrink-0" />
          <div className="h-3 w-12 rounded-full bg-[var(--text-primary)]/[0.09]" />
        </div>
        {/* GitHub Button Skeleton */}
        <div className="w-full h-9 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 auth-skeleton-shimmer flex items-center justify-center gap-2 px-3 shadow-xs">
          <div className="w-3.5 h-3.5 rounded-full bg-[var(--text-primary)]/[0.14] shrink-0" />
          <div className="h-3 w-12 rounded-full bg-[var(--text-primary)]/[0.09]" />
        </div>
      </div>

      {/* 6. Bottom Switch Link Skeleton */}
      <div className="text-center mt-2 pt-0.5">
        <div className="h-3.5 w-44 mx-auto rounded-full bg-[var(--text-primary)]/[0.08] auth-skeleton-shimmer" />
      </div>
    </div>
  );
};

export default AuthFormSkeleton;
