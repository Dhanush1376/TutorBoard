import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for easier tailwind class merging
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
