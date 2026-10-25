/**
 * ShapeUtils.js — Pedagogical Shape Utilities & Constants
 * 
 * This file contains pure JavaScript logic for color resolution, 
 * coordinate normalization, and shape attribute calculations.
 */

export const CW = 800;
export const CH = 600;

export const PALETTE = {
  amber: {
    stroke: "#F4C95D",
    fill: "#262014",
    glass: "#262014",
    text: "#FDF2D0",
    glow: "#F4C95D",
  },
  blue: {
    stroke: "#38BDF8",
    fill: "#15242E",
    glass: "#15242E",
    text: "#E0F2FE",
    glow: "#38BDF8",
  },
  red: {
    stroke: "#FF6B6B",
    fill: "#291414",
    glass: "#291414",
    text: "#FFE4E4",
    glow: "#FF6B6B",
  },
  green: {
    stroke: "#35C98A",
    fill: "#13261C",
    glass: "#13261C",
    text: "#D1FAE5",
    glow: "#35C98A",
  },
  yellow: {
    stroke: "#F4C95D",
    fill: "#262014",
    glass: "#262014",
    text: "#FDF2D0",
    glow: "#F4C95D",
  },
  orange: {
    stroke: "#FF925C",
    fill: "#291B14",
    glass: "#291B14",
    text: "#FFE7DC",
    glow: "#FF925C",
  },
  purple: {
    stroke: "#38BDF8",
    fill: "#15242E",
    glass: "#15242E",
    text: "#E0F2FE",
    glow: "#38BDF8",
  },
  cyan: {
    stroke: "#38BDF8",
    fill: "#15242E",
    glass: "#15242E",
    text: "#E0F2FE",
    glow: "#38BDF8",
  },
  gray: {
    stroke: "#383E38",
    fill: "#171A18",
    glass: "#171A18",
    text: "#F5F5F0",
    glow: "#383E38",
  },
  white: {
    stroke: "#B9BDB7",
    fill: "#202521",
    glass: "#202521",
    text: "#F5F5F0",
    glow: "#B9BDB7",
  },
};

export const resolve = (name) => {
  const s = String(name || "blue")
    .trim()
    .toLowerCase();
  if (PALETTE[s]) return PALETTE[s];
  // hex color passed directly
  return { stroke: s, fill: s, glass: s + "33", text: "#f8fafc", glow: s };
};

export const getStrokeDash = (strokeStyle) => {
  if (strokeStyle === 'dotted') return "2 4";
  if (strokeStyle === 'dashed') return "6 4";
  return "none";
};

export const resolveNoteColors = (bgColor) => {
  const c = String(bgColor).toLowerCase();
  if (c === "#fef9c3" || c === "#fbbf24")
    return { bg: "#fef9c3", ruled: "#fde047", tape: "#facc15" };
  if (c === "#dcfce7" || c === "#6ee7b7")
    return { bg: "#dcfce7", ruled: "#86efac", tape: "#4ade80" };
  if (c === "#dbeafe" || c === "#7dd3fc")
    return { bg: "#dbeafe", ruled: "#93c5fd", tape: "#60a5fa" };
  if (c === "#fce7f3" || c === "#fca5a5")
    return { bg: "#fce7f3", ruled: "#f9a8d4", tape: "#f472b6" };
  if (c === "#ffedd5" || c === "#fdba74")
    return { bg: "#ffedd5", ruled: "#fdba74", tape: "#fb923c" };
  if (c === "#ede9fe" || c === "#c4b5fd")
    return { bg: "#ede9fe", ruled: "#c4b5fd", tape: "#a78bfa" };
  if (c === "#ccfbf1")
    return { bg: "#ccfbf1", ruled: "#5eead4", tape: "#2dd4bf" };
  if (c === "#fffef9" || c === "#ffffff")
    return { bg: "#fffef9", ruled: "#e5e7eb", tape: "#d1d5db" };

  return { bg: bgColor, ruled: "rgba(0,0,0,0.1)", tape: "rgba(0,0,0,0.2)" };
};
