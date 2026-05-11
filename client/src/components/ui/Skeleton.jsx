/**
 * Skeleton.jsx — TutorBoard Loading Skeleton
 * 
 * Shimmer loading placeholder that consumes design tokens.
 * Replaces inline skeleton styles.
 */
import React from 'react';

const Skeleton = ({
  width,
  height = '1rem',
  rounded = 'md',
  className = '',
  lines = 1,
  ...props
}) => {
  const radiusMap = {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full',
  };

  const r = radiusMap[rounded] || radiusMap.md;

  if (lines > 1) {
    return (
      <div className={`flex flex-col gap-2 ${className}`} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton ${r}`}
            style={{
              width: i === lines - 1 ? '70%' : width || '100%',
              height,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`skeleton ${r} ${className}`}
      style={{ width: width || '100%', height }}
      aria-hidden="true"
      {...props}
    />
  );
};

export default Skeleton;
