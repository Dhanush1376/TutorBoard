import React from "react";

/**
 * CinematicFilters — Shared SVG filters for glow, shadows, and lift effects.
 */
export const CinematicFilters = () => (
  <defs>
    <filter id="tb-neon-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feFlood floodColor="white" floodOpacity="0.15" result="flood" />
      <feComposite in="flood" in2="blur" operator="in" result="glow" />
      <feComposite in="SourceGraphic" in2="glow" operator="over" />
    </filter>
    <filter id="tb-drop-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
      <feOffset dx="0" dy="6" result="off" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.4" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="tb-lift-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur" />
      <feOffset dx="0" dy="16" result="off" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);
