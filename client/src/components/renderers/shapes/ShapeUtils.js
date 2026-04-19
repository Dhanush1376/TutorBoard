/**
 * ShapeUtils.js — Pedagogical Shape Utilities & Constants
 * 
 * This file contains pure JavaScript logic for color resolution, 
 * coordinate normalization, and shape attribute calculations.
 */

export const CW = 800;
export const CH = 600;

export const PALETTE = {
  blue: {
    stroke: "#60a5fa",
    fill: "#3b82f6",
    glass: "rgba(59,130,246,0.20)",
    text: "#f1f5f9",
    glow: "#60a5fa",
  },
  red: {
    stroke: "#f87171",
    fill: "#ef4444",
    glass: "rgba(239,68,68,0.20)",
    text: "#f1f5f9",
    glow: "#f87171",
  },
  green: {
    stroke: "#4ade80",
    fill: "#22c55e",
    glass: "rgba(34,197,94,0.20)",
    text: "#f1f5f9",
    glow: "#4ade80",
  },
  yellow: {
    stroke: "#fbbf24",
    fill: "#f59e0b",
    glass: "rgba(245,158,11,0.20)",
    text: "#0f172a",
    glow: "#fbbf24",
  },
  orange: {
    stroke: "#fb923c",
    fill: "#f97316",
    glass: "rgba(249,115,22,0.20)",
    text: "#f1f5f9",
    glow: "#fb923c",
  },
  purple: {
    stroke: "#c084fc",
    fill: "#9333ea",
    glass: "rgba(168,85,247,0.20)",
    text: "#f1f5f9",
    glow: "#c084fc",
  },
  cyan: {
    stroke: "#22d3ee",
    fill: "#06b6d4",
    glass: "rgba(6,182,212,0.20)",
    text: "#0f172a",
    glow: "#22d3ee",
  },
  gray: {
    stroke: "#94a3b8",
    fill: "#475569",
    glass: "rgba(148,163,184,0.15)",
    text: "#f1f5f9",
    glow: "#94a3b8",
  },
  white: {
    stroke: "#f1f5f9",
    fill: "#334155",
    glass: "rgba(255,255,255,0.12)",
    text: "#f8fafc",
    glow: "#f1f5f9",
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
