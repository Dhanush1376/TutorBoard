import React from 'react';

/**
 * ToolbarDivider
 * A slim, subtle vertical separator for grouping tool families.
 */
const ToolbarDivider = () => {
  return (
    <div 
      className="w-[1.5px] h-5 bg-[var(--border-color)] opacity-40 mx-1 flex-shrink-0 self-center" 
      aria-hidden="true" 
    />
  );
};

export default ToolbarDivider;
