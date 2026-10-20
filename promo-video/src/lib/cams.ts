import { Cam, frameRect } from '../components/UIShot';
import { cells, rect, union } from './capture';

// Camera positions shared across scene boundaries so every cut is continuous.

const composer = rect('composer', { x: 16, y: 884, w: 318, h: 176 });

export const composerMacro: Cam = (() => {
  const c = frameRect(composer, 0.6);
  return { ...c, z: Math.min(c.z, 2.6) };
})();
export const composerDrift: Cam = { ...composerMacro, z: composerMacro.z * 1.08, x: composerMacro.x + 6 };
/** S2 → S3 hand-off */
export const askEnd: Cam = { ...composerDrift, z: composerDrift.z * 0.82 };

export const FULL: Cam = { x: 960, y: 540, z: 1 };

const step1 = cells('cellsStep1');
const row = step1.length ? union(step1) : { x: 856, y: 205, w: 560, h: 98 };
export const cellsRow = row;
export const boardCenterX = row.x + row.w / 2;

/** On the board: cells near the top, room for captions in the empty canvas below. */
export const board: Cam = { x: boardCenterX, y: row.y + 215, z: 1.45 };
export const boardAndPanel: Cam = { x: 1420, y: 420, z: 1.28 };
/** S4 → S5 hand-off */
export const unfoldEnd: Cam = { x: boardCenterX - 40, y: row.y + 240, z: 1.3 };
/** S5 → S6 hand-off */
export const doubtEnd: Cam = { x: boardCenterX, y: row.y + 220, z: 1.35 };
