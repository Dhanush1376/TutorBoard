/**
 * Geometry Utilities for Canvas Shapes
 */

// Helper: Convert raw points to a smooth SVG path string (Midpoint averaging)
export const getSvgPath = (points, width, height) => {
  if (!points || points.length < 2) return '';
  const pts = points.map(p => [p[0] * width, p[1] * height]);
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]},${pts[i][1]} ${xc},${yc}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]},${last[1]}`;
  return d;
};

export const getStarPoints = (x, y, w, h) => {
  const rOuter = Math.min(w, h) / 2;
  const rInner = rOuter * 0.4;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(' ');
};

export const getHexagonPoints = (x, y, w, h) => {
  const rw = w / 2;
  const rh = h / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(`${cx + rw * Math.cos(angle)},${cy + rh * Math.sin(angle)}`);
  }
  return points.join(' ');
};

export const getDiamondPoints = (x, y, w, h) => {
  const dw = w / 2;
  const dh = h / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `${cx},${cy - dh} ${cx + dw},${cy} ${cx},${cy + dh} ${cx - dw},${cy}`;
};
