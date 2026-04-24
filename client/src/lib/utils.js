import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for easier tailwind class merging
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * getCanvasFingerprint
 * Creates a unique string hash of the canvas objects' positions, colors, and content
 * to detect mutations (moves/edits) that don't change array length.
 */
export function getCanvasFingerprint(objects) {
  if (!objects || objects.length === 0) return 'empty';
  
  // Hash essential properties: id + position + color + text
  // We use a lightweight join approach for performance over crypto-hashing
  return objects
    .map(obj => {
      const x = obj.x ?? obj.cx ?? obj.x1 ?? 0;
      const y = obj.y ?? obj.cy ?? obj.y1 ?? 0;
      const color = obj.color ?? obj.stroke ?? obj.fill ?? '';
      const text = obj.text ?? obj.label ?? '';
      const w = obj.width ?? obj.w ?? obj.r ?? 0;
      const h = obj.height ?? obj.h ?? obj.r ?? 0;

      return `${obj.id}:${Number(x).toFixed(1)},${Number(y).toFixed(1)}:${Number(w).toFixed(1)}x${Number(h).toFixed(1)}:${color}:${text.length}`;
    })
    .join('|');
}