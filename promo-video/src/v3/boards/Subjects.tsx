import React from 'react';
import { Easing } from 'remotion';
import { easeInOut, easeOut, lerp, prog } from '../../lib/anim';
import { fonts } from '../../theme';

/**
 * The montage boards, drawn in the visual language of TutorBoard's canvas
 * renderer (ContentPlugin / ArrayPlugin / AuxPlugin): warm off-white ink,
 * 0.28-alpha axes, indigo accent, amber marks with a glow, CPK atoms, dark
 * network nodes with blue strokes. Each takes `t` = frames since the board
 * started and draws in app CSS px.
 */

const INK = '#F2F0EA';
const DIM = '#B9B6AE';
const AXIS = 'rgba(255,255,255,0.28)';
const INDIGO = '#6366F1';
const BLUE = '#60A5FA';
const AMBER = '#F59E0B';
const AMBER_T = '#FBBF24';
const GREEN = '#22C55E';
const CYAN = '#22D3EE';
const PINK = '#EC4899';
const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

export type BoardProps = { t: number };

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', fontFamily: fonts.sans }}>
    <defs>
      <marker id="arrowInk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={INK} />
      </marker>
      {[['G', GREEN], ['I', INDIGO], ['A', AMBER], ['B', BLUE], ['C', CYAN], ['P', PINK], ['D', DIM]].map(([k, c]) => (
        <marker key={k} id={`arrow${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={c} />
        </marker>
      ))}
    </defs>
    {children}
  </svg>
);

const Mono: React.FC<{ x: number; y: number; children: React.ReactNode; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; opacity?: number; spacing?: string; weight?: number }> = ({
  x, y, children, color = DIM, size = 13, anchor = 'middle', opacity = 1, spacing = '0.06em', weight = 500,
}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={fonts.mono} fontSize={size} fill={color} opacity={opacity} letterSpacing={spacing} fontWeight={weight}>
    {children}
  </text>
);

const Title: React.FC<{ x: number; y: number; text: string; sub?: string; t: number; subAt?: number }> = ({ x, y, text, sub, t, subAt = 0 }) => (
  <g opacity={prog(t, 0, 10)}>
    <text x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={700} letterSpacing="0.24em" fill={INK} opacity={0.9}>{text}</text>
    {sub && <Mono x={x} y={y + 24} opacity={prog(t, subAt, 12)} color={AMBER_T}>{sub}</Mono>}
  </g>
);

/** The app's array-cell look, tinted by a state colour. */
const Tile: React.FC<{ x: number; y: number; w: number; h: number; label: string; color: string; opacity?: number; rot?: number; glow?: number }> = ({
  x, y, w, h, label, color, opacity = 1, rot = 0, glow = 0,
}) => (
  <g transform={`translate(${x + w / 2} ${y + h / 2}) rotate(${rot})`} opacity={opacity}>
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={14} fill="#1C1B19" stroke={color} strokeOpacity={0.85} strokeWidth={1.6}
      style={{ filter: `drop-shadow(0 8px 18px rgba(0,0,0,0.5))${glow > 0 ? ` drop-shadow(0 0 ${14 * glow}px ${color})` : ''}` }} />
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={14} fill={color} fillOpacity={0.14} />
    <text textAnchor="middle" dy="0.35em" fontFamily={fonts.mono} fontSize={26} fill={INK}>{label}</text>
  </g>
);

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Stack vs Queue — LIFO beside FIFO
export const STACKQUEUE_STEPS = [0, 10, 36, 44];
export const StackQueueBoard: React.FC<BoardProps> = ({ t }) => {
  const COLORS = [INDIGO, GREEN, AMBER];
  const NAMES = ['A', 'B', 'C'];
  // stack geometry
  const sx = 640, sw = 160, sb = 650, iw = 136, ih = 62, gap = 10;
  const slotY = (k: number) => sb - 12 - (k + 1) * ih - k * gap;
  const pushAt = [6, 14, 22];
  const popAt = 36;
  // queue geometry
  const qx0 = 1010, qy = 446, qw = 104, qh = 62;
  const slotX = (k: number) => qx0 + k * (qw + 12);
  const enqAt = [10, 18, 26];
  const deqAt = 44;
  const shift = prog(t, deqAt + 4, 12, easeInOut);
  const draw = prog(t, 0, 14, easeOut);

  // pointers
  const topK = t < popAt + 6 ? Math.max(-1, pushAt.filter((a) => t >= a + 4).length - 1) : 1;
  const topY = topK >= 0 ? slotY(topK) + ih / 2 : sb - 20;
  const frontK = t >= deqAt + 8 ? 1 : 0;
  const rearCount = enqAt.filter((a) => t >= a + 6).length;

  return (
    <Svg>
      <Title x={720} y={212} text="STACK" sub="LIFO · last in, first out" t={t} subAt={popAt + 8} />
      <Title x={1240} y={212} text="QUEUE" sub="FIFO · first in, first out" t={t} subAt={deqAt + 8} />
      {/* containers */}
      <path d={`M${sx},${sb - 330} L${sx},${sb} L${sx + sw},${sb} L${sx + sw},${sb - 330}`} fill="none" stroke={AXIS} strokeWidth={2.2} strokeLinejoin="round"
        pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      <line x1={qx0 - 14} y1={qy - 14} x2={qx0 + 3 * (qw + 12) + 30} y2={qy - 14} stroke={AXIS} strokeWidth={2.2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      <line x1={qx0 - 14} y1={qy + qh + 14} x2={qx0 + 3 * (qw + 12) + 30} y2={qy + qh + 14} stroke={AXIS} strokeWidth={2.2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
      <Mono x={qx0 - 40} y={qy + qh / 2 + 5} opacity={draw * 0.8} anchor="end">out ◂</Mono>
      <Mono x={qx0 + 3 * (qw + 12) + 56} y={qy + qh / 2 + 5} opacity={draw * 0.8} anchor="start">◂ in</Mono>

      {/* stack items */}
      {NAMES.map((n, k) => {
        const a = pushAt[k];
        if (t < a) return null;
        const drop = prog(t, a, 10, backOut);
        let y = lerp(sb - 470, slotY(k), drop);
        let op = prog(t, a, 3);
        let rot = 0;
        if (k === 2 && t >= popAt) {
          const up = prog(t, popAt, 14, easeInOut);
          y = lerp(slotY(k), sb - 500, up);
          op *= 1 - prog(t, popAt + 8, 8);
          rot = up * -8;
        }
        return <Tile key={n} x={sx + (sw - iw) / 2} y={y} w={iw} h={ih} label={n} color={COLORS[k]} opacity={op} rot={rot} glow={k === 2 && t >= popAt ? 1 : Math.max(0, 1 - (t - a - 8) / 10)} />;
      })}
      {/* stack ops */}
      {pushAt.map((a, k) => (
        <Mono key={k} x={sx + sw + 30} y={slotY(k) + ih / 2 + 5} anchor="start" color={INK} opacity={prog(t, a + 2, 4) * (1 - prog(t, a + 12, 6))}>{`push(${NAMES[k]})`}</Mono>
      ))}
      <Mono x={sx + sw + 30} y={slotY(2) - 8} anchor="start" color={AMBER_T} size={15} weight={600} opacity={prog(t, popAt + 2, 5) * (1 - prog(t, popAt + 30, 8))}>pop() → C</Mono>
      {/* top pointer */}
      {topK >= 0 && (
        <g opacity={prog(t, pushAt[0] + 4, 6)} transform={`translate(0 ${topY})`}>
          <line x1={sx - 70} y1={0} x2={sx - 12} y2={0} stroke={AMBER} strokeWidth={2.4} markerEnd="url(#arrowA)" />
          <Mono x={sx - 78} y={5} anchor="end" color={AMBER_T} weight={600}>top</Mono>
        </g>
      )}

      {/* queue items */}
      {NAMES.map((n, k) => {
        const a = enqAt[k];
        if (t < a) return null;
        const slide = prog(t, a, 12, easeOut);
        let x = lerp(qx0 + 3 * (qw + 12) + 160, slotX(k), slide);
        let op = prog(t, a, 4);
        if (k === 0 && t >= deqAt) {
          const out = prog(t, deqAt, 12, easeInOut);
          x = lerp(slotX(0), qx0 - 190, out);
          op *= 1 - prog(t, deqAt + 6, 8);
        } else if (k > 0) x -= shift * (qw + 12);
        return <Tile key={n} x={x} y={qy} w={qw} h={qh} label={n} color={COLORS[k]} opacity={op} glow={k === 0 && t >= deqAt ? 1 : Math.max(0, 1 - (t - a - 10) / 10)} />;
      })}
      {enqAt.map((a, k) => (
        <Mono key={k} x={slotX(k) + qw / 2} y={qy - 34} color={INK} opacity={prog(t, a + 4, 4) * (1 - prog(t, a + 14, 6))}>{`enqueue(${NAMES[k]})`}</Mono>
      ))}
      <Mono x={slotX(0) + qw / 2 - 60} y={qy - 34} color={AMBER_T} size={15} weight={600} opacity={prog(t, deqAt + 2, 5) * (1 - prog(t, deqAt + 28, 8))}>dequeue() → A</Mono>
      {/* front / rear pointers */}
      <g opacity={prog(t, enqAt[0] + 8, 6)}>
        <g transform={`translate(${slotX(frontK) + qw / 2 - (frontK === 1 ? shift * (qw + 12) : 0)} ${qy + qh + 26})`}>
          <line x1={0} y1={46} x2={0} y2={4} stroke={GREEN} strokeWidth={2.4} markerEnd="url(#arrowG)" />
          <Mono x={0} y={66} color={GREEN} weight={600}>front</Mono>
        </g>
        {rearCount > 1 && (
          <g transform={`translate(${slotX(rearCount - 1) + qw / 2 - (t >= deqAt ? shift * (qw + 12) : 0)} ${qy + qh + 26})`} opacity={prog(t, enqAt[1] + 8, 6)}>
            <line x1={0} y1={46} x2={0} y2={4} stroke={INDIGO} strokeWidth={2.4} markerEnd="url(#arrowI)" />
            <Mono x={0} y={66} color="#A5B4FC" weight={600}>rear</Mono>
          </g>
        )}
      </g>
    </Svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Geometry — why a triangle's angles sum to 180°
export const GEOMETRY_STEPS = [0, 20, 34, 52];
const P = { A: { x: 660, y: 660 }, B: { x: 1300, y: 660 }, C: { x: 900, y: 270 } };
const ang = (o: { x: number; y: number }, p: { x: number; y: number }) => Math.atan2(p.y - o.y, p.x - o.x);
const wedge = (o: { x: number; y: number }, a0: number, a1: number, r: number) => {
  // sector from angle a0 to a1 (radians, screen coords), sweeping the short way
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const x0 = o.x + r * Math.cos(a0), y0 = o.y + r * Math.sin(a0);
  const x1 = o.x + r * Math.cos(a0 + d), y1 = o.y + r * Math.sin(a0 + d);
  return `M${o.x},${o.y} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${x1.toFixed(1)},${y1.toFixed(1)} Z`;
};
const deg = (r: number) => {
  let d = r;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.round((Math.abs(d) * 180) / Math.PI);
};

export const GeometryBoard: React.FC<BoardProps> = ({ t }) => {
  const { A, B, C } = P;
  const aA = [ang(A, B), ang(A, C)];
  const aB = [ang(B, A), ang(B, C)];
  const aC = [ang(C, A), ang(C, B)];
  const alpha = deg(aA[1] - aA[0]);
  const beta = deg(aB[0] - aB[1]);
  const gamma = 180 - alpha - beta;
  const side = (p: { x: number; y: number }, q: { x: number; y: number }, at: number) => (
    <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={INDIGO} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - prog(t, at, 12, easeInOut)} />
  );
  const fill = prog(t, 16, 10);
  const arcs = prog(t, 20, 10, easeOut);
  const par = prog(t, 34, 14, easeInOut);
  // alternate angles travel from A and B up to C (rotating half a turn)
  const fly = prog(t, 42, 16, easeInOut);
  const straight = prog(t, 54, 12, easeOut);
  const eq = prog(t, 58, 14, easeOut);
  const vertex = (p: { x: number; y: number }, name: string, dx: number, dy: number, at: number) => {
    const s = prog(t, at, 8, backOut);
    return (
      <g>
        <circle cx={p.x} cy={p.y} r={5.5 * s} fill={INK} />
        <text x={p.x + dx} y={p.y + dy} textAnchor="middle" fontSize={18} fontWeight={700} fill={INK} opacity={s}>{name}</text>
      </g>
    );
  };
  const flying = (o: { x: number; y: number }, a: number[], color: string) => {
    const x = lerp(o.x, C.x, fly);
    const y = lerp(o.y, C.y, fly);
    return (
      <g transform={`translate(${x - o.x} ${y - o.y}) rotate(${180 * fly} ${o.x} ${o.y})`} opacity={fly > 0 ? 1 : 0}>
        <path d={wedge(o, a[0], a[1], 58)} fill={color} fillOpacity={0.32} stroke={color} strokeWidth={2.2} />
      </g>
    );
  };
  return (
    <Svg>
      <path d={`M${A.x},${A.y} L${B.x},${B.y} L${C.x},${C.y} Z`} fill={INDIGO} fillOpacity={0.08 * fill} />
      {side(A, B, 0)}
      {side(B, C, 5)}
      {side(C, A, 10)}
      {/* parallel through C */}
      <line x1={C.x - 420 * par} y1={C.y} x2={C.x + 470 * par} y2={C.y} stroke={INK} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="8 7" />
      <Mono x={C.x + 470} y={C.y - 12} anchor="end" opacity={prog(t, 44, 8)} color={DIM}>∥ AB</Mono>
      {/* interior angles */}
      <g opacity={arcs}>
        <path d={wedge(A, aA[0], aA[1], 58 * arcs)} fill={AMBER} fillOpacity={0.2} stroke={AMBER} strokeWidth={2.2} />
        <path d={wedge(B, aB[0], aB[1], 58 * arcs)} fill={GREEN} fillOpacity={0.2} stroke={GREEN} strokeWidth={2.2} />
        <path d={wedge(C, aC[0], aC[1], 50 * arcs)} fill={PINK} fillOpacity={0.22} stroke={PINK} strokeWidth={2.2} />
        <text x={A.x + 92} y={A.y - 22} fontSize={16} fontWeight={650} fill={AMBER_T} textAnchor="middle">α = {alpha}°</text>
        <text x={B.x - 96} y={B.y - 22} fontSize={16} fontWeight={650} fill="#86EFAC" textAnchor="middle">β = {beta}°</text>
        <text x={C.x + 6} y={C.y + 92} fontSize={16} fontWeight={650} fill="#F9A8D4" textAnchor="middle">γ = {gamma}°</text>
      </g>
      {flying(A, aA, AMBER)}
      {flying(B, aB, GREEN)}
      {fly >= 1 && (
        <g opacity={prog(t, 58, 6)}>
          <text x={C.x - 92} y={C.y + 34} fontSize={16} fontWeight={650} fill={AMBER_T} textAnchor="middle">α</text>
          <text x={C.x + 96} y={C.y + 34} fontSize={16} fontWeight={650} fill="#86EFAC" textAnchor="middle">β</text>
        </g>
      )}
      {/* the straight angle */}
      <g opacity={straight}>
        <path d={`M${C.x - 96},${C.y} A96,96 0 0 0 ${C.x + 96},${C.y}`} fill="none" stroke={AMBER_T} strokeWidth={2} strokeDasharray="4 5" pathLength={1}
          strokeDashoffset={0} style={{ filter: `drop-shadow(0 0 8px ${AMBER})` }} />
        <circle cx={C.x} cy={C.y} r={7} fill={AMBER} style={{ filter: `drop-shadow(0 0 10px ${AMBER})` }} />
        <text x={C.x + 22} y={C.y - 16} textAnchor="start" fontSize={20} fontWeight={700} fill={INK}>180°</text>
      </g>
      {vertex(A, 'A', -22, 30, 2)}
      {vertex(B, 'B', 22, 30, 8)}
      {vertex(C, 'C', -30, -14, 14)}
      {/* equation card (ContentPlugin equation style) */}
      <g opacity={eq} transform={`translate(0 ${(1 - eq) * 10})`}>
        <rect x={810} y={712} width={330} height={62} rx={14} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.10)" />
        <text x={975} y={752} textAnchor="middle" fontSize={26} fill={INK} fontStyle="italic" fontFamily="'Times New Roman', serif">
          <tspan fill={AMBER_T}>α</tspan> + <tspan fill="#86EFAC">β</tspan> + <tspan fill="#F9A8D4">γ</tspan> <tspan fontStyle="normal">= 180°</tspan>
        </text>
      </g>
    </Svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Physics — projectile at 45°
export const PHYSICS_STEPS = [0, 16, 39, 62];
export const PhysicsBoard: React.FC<BoardProps> = ({ t }) => {
  const O = { x: 560, y: 690 };
  const R = 800, Hm = 200;
  const ax = prog(t, 0, 12, easeOut);
  const u = prog(t, 16, 46, (x) => x); // horizontal speed is constant → x is linear in time
  const pos = (uu: number) => ({ x: O.x + R * uu, y: O.y - 4 * Hm * uu * (1 - uu) });
  const ball = pos(u);
  const N = 60;
  const trail = Array.from({ length: Math.max(2, Math.ceil(u * N) + 1) }, (_, i) => pos(Math.min(u, i / N)));
  const d = trail.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const launched = t >= 16;
  const vy = 1 - 2 * u; // normalised vertical velocity
  const apex = prog(t, 39, 8, easeOut);
  const land = prog(t, 62, 10, easeOut);
  const vec = prog(t, 6, 10, easeOut) * (1 - prog(t, 16, 6));
  const eq = prog(t, 64, 12, easeOut);
  return (
    <Svg>
      {/* axes (plot style) */}
      <g opacity={ax}>
        <line x1={O.x - 30} y1={O.y} x2={O.x - 30 + 900 * ax} y2={O.y} stroke={AXIS} strokeWidth={1.4} />
        <line x1={O.x} y1={O.y + 20} x2={O.x} y2={O.y + 20 - 330 * ax} stroke={AXIS} strokeWidth={1.4} />
        {Array.from({ length: 9 }, (_, k) => (
          <g key={k}>
            <line x1={O.x + k * 100} y1={O.y - 3} x2={O.x + k * 100} y2={O.y + 3} stroke={AXIS} />
            <text x={O.x + k * 100} y={O.y + 20} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.45)">{k * 5}</text>
          </g>
        ))}
        <text x={O.x + 860} y={O.y - 10} textAnchor="end" fontSize={11} fill={DIM}>x (m)</text>
        <text x={O.x + 8} y={O.y - 320} fontSize={11} fill={DIM}>y (m)</text>
      </g>
      {/* launch vector and its components */}
      <g opacity={vec}>
        <line x1={O.x} y1={O.y} x2={O.x + 120} y2={O.y - 120} stroke={INK} strokeWidth={3} markerEnd="url(#arrowInk)" />
        <line x1={O.x} y1={O.y} x2={O.x + 120} y2={O.y} stroke={GREEN} strokeWidth={2.4} strokeDasharray="6 4" markerEnd="url(#arrowG)" />
        <line x1={O.x} y1={O.y} x2={O.x} y2={O.y - 120} stroke={INDIGO} strokeWidth={2.4} strokeDasharray="6 4" markerEnd="url(#arrowI)" />
        <text x={O.x + 132} y={O.y - 128} fontSize={16} fontWeight={650} fill={INK}>v₀</text>
        <text x={O.x + 128} y={O.y - 10} fontSize={14} fontWeight={600} fill="#86EFAC">vₓ</text>
        <text x={O.x - 30} y={O.y - 110} fontSize={14} fontWeight={600} fill="#A5B4FC">v_y</text>
        <path d={`M${O.x + 46},${O.y} A46,46 0 0 0 ${O.x + 32.5},${O.y - 32.5}`} fill="none" stroke={AMBER} strokeWidth={2} />
        <text x={O.x + 62} y={O.y - 14} fontSize={13} fontWeight={650} fill={AMBER_T}>45°</text>
      </g>
      {/* path + strobe ghosts */}
      {launched && <path d={d} fill="none" stroke={BLUE} strokeWidth={3} strokeLinecap="round" />}
      {launched && [0.125, 0.25, 0.375, 0.625, 0.75, 0.875].filter((g) => g < u).map((g) => {
        const p = pos(g);
        return <circle key={g} cx={p.x} cy={p.y} r={8} fill={INK} opacity={0.18} />;
      })}
      {/* apex */}
      <g opacity={apex}>
        <line x1={pos(0.5).x} y1={pos(0.5).y} x2={pos(0.5).x} y2={O.y} stroke={AMBER_T} strokeOpacity={0.6} strokeDasharray="5 6" strokeWidth={1.6} />
        <circle cx={pos(0.5).x} cy={pos(0.5).y} r={7} fill={AMBER} style={{ filter: `drop-shadow(0 0 8px ${AMBER})` }} />
        <text x={pos(0.5).x} y={pos(0.5).y - 18} textAnchor="middle" fontSize={13} fontWeight={650} fill={INK}>max height · v_y = 0</text>
      </g>
      {/* landing + range */}
      <g opacity={land}>
        <circle cx={O.x + R} cy={O.y} r={7} fill={AMBER} style={{ filter: `drop-shadow(0 0 8px ${AMBER})` }} />
        <circle cx={O.x + R} cy={O.y} r={10 + 40 * land} fill="none" stroke={AMBER} strokeOpacity={0.6 * (1 - land)} strokeWidth={2} />
        <line x1={O.x} y1={O.y + 44} x2={O.x + R * land} y2={O.y + 44} stroke={INK} strokeOpacity={0.7} strokeWidth={1.5} markerStart="url(#arrowInk)" markerEnd="url(#arrowInk)" />
        <text x={O.x + R / 2} y={O.y + 66} textAnchor="middle" fontSize={13} fontWeight={600} fill={INK}>range R</text>
      </g>
      {/* live vectors on the ball */}
      {launched && t < 64 && (
        <g>
          <line x1={ball.x} y1={ball.y} x2={ball.x + 64} y2={ball.y} stroke={GREEN} strokeWidth={2.6} markerEnd="url(#arrowG)" />
          {Math.abs(vy) > 0.06 && <line x1={ball.x} y1={ball.y} x2={ball.x} y2={ball.y - 64 * vy} stroke={INDIGO} strokeWidth={2.6} markerEnd="url(#arrowI)" />}
          <line x1={ball.x} y1={ball.y + 14} x2={ball.x} y2={ball.y + 58} stroke={AMBER} strokeWidth={2.4} markerEnd="url(#arrowA)" />
          <text x={ball.x + 8} y={ball.y + 60} fontSize={13} fontWeight={650} fill={AMBER_T}>g</text>
        </g>
      )}
      <circle cx={launched ? ball.x : O.x} cy={launched ? ball.y : O.y} r={11} fill={INK} style={{ filter: `drop-shadow(0 0 10px ${INK})` }} opacity={prog(t, 4, 6)} />
      {/* range formula */}
      <g opacity={eq} transform={`translate(0 ${(1 - eq) * 10})`}>
        <rect x={1080} y={250} width={300} height={60} rx={14} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.10)" />
        <text x={1230} y={289} textAnchor="middle" fontSize={24} fill={INK} fontStyle="italic" fontFamily="'Times New Roman', serif">
          R = v₀² sin 2θ / g
        </text>
      </g>
    </Svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Chemistry — why water is bent
export const CHEM_STEPS = [0, 20, 40];
export const ChemBoard: React.FC<BoardProps> = ({ t }) => {
  const O = { x: 975, y: 400 + Math.sin(t / 14) * 3 };
  const L = 176;
  const theta = lerp(109.5, 104.5, prog(t, 26, 18, easeInOut)) * (Math.PI / 180);
  const H1 = { x: O.x - L * Math.sin(theta / 2), y: O.y + L * Math.cos(theta / 2) };
  const H2 = { x: O.x + L * Math.sin(theta / 2), y: O.y + L * Math.cos(theta / 2) };
  const oIn = prog(t, 0, 10, backOut);
  const b1 = prog(t, 6, 10, easeOut);
  const b2 = prog(t, 9, 10, easeOut);
  const h1 = prog(t, 13, 8, backOut);
  const h2 = prog(t, 16, 8, backOut);
  const pairs = prog(t, 14, 8);
  const lone = prog(t, 20, 12, easeOut);
  const push = prog(t, 26, 10) * (1 - prog(t, 46, 8));
  const arc = prog(t, 40, 10, easeOut);
  const charge = prog(t, 52, 12, easeOut);
  const lobe = (dir: number) => {
    // lone-pair lobe pointing up-left / up-right of O
    const a = (-90 + dir * 56) * (Math.PI / 180);
    const cx = O.x + Math.cos(a) * 70 * lone;
    const cy = O.y + Math.sin(a) * 70 * lone;
    return (
      <g opacity={lone}>
        <ellipse cx={cx} cy={cy} rx={36 * lone} ry={22 * lone} transform={`rotate(${(a * 180) / Math.PI} ${cx} ${cy})`} fill="rgba(99,102,241,0.18)" stroke="rgba(129,140,248,0.7)" strokeWidth={1.4} />
        {[-1, 1].map((s) => (
          <circle key={s} cx={cx + Math.cos(a + Math.PI / 2) * 9 * s} cy={cy + Math.sin(a + Math.PI / 2) * 9 * s} r={4} fill="#A5B4FC" />
        ))}
      </g>
    );
  };
  const bond = (H: { x: number; y: number }, g: number) => {
    const x2 = lerp(O.x, H.x, g);
    const y2 = lerp(O.y, H.y, g);
    const mx = lerp(O.x, H.x, 0.5), my = lerp(O.y, H.y, 0.5);
    const nx = -(H.y - O.y) / L, ny = (H.x - O.x) / L;
    return (
      <g>
        <line x1={O.x} y1={O.y} x2={x2} y2={y2} stroke="rgba(242,240,234,0.55)" strokeWidth={6} strokeLinecap="round" />
        <g opacity={pairs}>
          <circle cx={mx + nx * 14} cy={my + ny * 14} r={4} fill={CYAN} />
          <circle cx={mx + nx * 26} cy={my + ny * 26} r={4} fill={CYAN} />
        </g>
      </g>
    );
  };
  const atom = (p: { x: number; y: number }, el: 'O' | 'H', s: number) => {
    const fill = el === 'O' ? '#EF4444' : '#E5E7EB';
    const r = el === 'O' ? 48 : 30;
    return (
      <g transform={`translate(${p.x} ${p.y}) scale(${s})`}>
        <circle r={r} fill={fill} style={{ filter: `drop-shadow(0 0 14px ${fill})` }} />
        <circle r={r} fill="url(#atomShade)" />
        <text textAnchor="middle" dy="0.35em" fontSize={el === 'H' ? 17 : 22} fontWeight={700} fill={el === 'H' ? '#111' : '#fff'}>{el}</text>
      </g>
    );
  };
  const a1 = Math.atan2(H1.y - O.y, H1.x - O.x);
  const a2 = Math.atan2(H2.y - O.y, H2.x - O.x);
  const ra = 74;
  return (
    <Svg>
      <defs>
        <radialGradient id="atomShade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <g opacity={prog(t, 0, 10)}>
        <text x={560} y={240} fontSize={34} fontWeight={700} fill={INK}>H₂O</text>
        <Mono x={562} y={268} anchor="start" opacity={prog(t, 44, 10)} color={AMBER_T}>bent · polar</Mono>
      </g>
      {/* tetrahedral reference (109.5°) fades as the lone pairs squeeze it */}
      <g opacity={prog(t, 22, 6) * (1 - prog(t, 44, 10)) * 0.6}>
        {[-1, 1].map((s) => (
          <line key={s} x1={O.x} y1={O.y} x2={O.x + s * L * Math.sin((109.5 * Math.PI) / 360)} y2={O.y + L * Math.cos((109.5 * Math.PI) / 360)} stroke={DIM} strokeDasharray="5 6" strokeWidth={1.4} />
        ))}
        <Mono x={O.x} y={O.y + 214} color={DIM}>109.5°</Mono>
      </g>
      {b1 > 0 && bond(H1, b1)}
      {b2 > 0 && bond(H2, b2)}
      {/* bond angle */}
      <g opacity={arc}>
        <path d={`M${O.x + ra * Math.cos(a1)},${O.y + ra * Math.sin(a1)} A${ra},${ra} 0 0 0 ${O.x + ra * Math.cos(a2)},${O.y + ra * Math.sin(a2)}`} fill="none" stroke={AMBER} strokeWidth={2.4} style={{ filter: `drop-shadow(0 0 6px ${AMBER})` }} />
        <text x={O.x} y={O.y + ra + 34} textAnchor="middle" fontSize={20} fontWeight={700} fill={AMBER_T}>104.5°</text>
      </g>
      {lobe(-1)}
      {lobe(1)}
      {/* repulsion */}
      <g opacity={push}>
        {[-1, 1].map((s) => (
          <path key={s} d={`M${O.x + s * 92},${O.y - 40} Q${O.x + s * 150},${O.y + 20} ${O.x + s * 128},${O.y + 92}`} fill="none" stroke={AMBER} strokeWidth={2.2} markerEnd="url(#arrowA)" />
        ))}
        <Mono x={O.x + 230} y={O.y - 30} anchor="start" color={AMBER_T}>lone pairs repel</Mono>
      </g>
      {h1 > 0 && atom(H1, 'H', h1)}
      {h2 > 0 && atom(H2, 'H', h2)}
      {atom(O, 'O', oIn)}
      {/* partial charges + dipole */}
      <g opacity={charge}>
        <text x={O.x} y={O.y - 118} textAnchor="middle" fontSize={22} fontWeight={700} fill="#F9A8D4">δ−</text>
        <text x={H1.x - 46} y={H1.y + 46} textAnchor="middle" fontSize={20} fontWeight={700} fill="#67E8F9">δ+</text>
        <text x={H2.x + 46} y={H2.y + 46} textAnchor="middle" fontSize={20} fontWeight={700} fill="#67E8F9">δ+</text>
        <line x1={1290} y1={560} x2={1290} y2={560 - 230 * charge} stroke={INK} strokeWidth={2.4} markerEnd="url(#arrowInk)" />
        <line x1={1278} y1={540} x2={1302} y2={540} stroke={INK} strokeWidth={2.4} />
        <Mono x={1306} y={460} anchor="start" color={DIM}>dipole</Mono>
      </g>
    </Svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Machine learning — pixels → features → network → prediction
export const ML_STEPS = [0, 8, 22, 52];
const CAT = (() => {
  const n = 12;
  const g: number[][] = [];
  const sign = (p1: number[], p2: number[], p3: number[]) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const inTri = (px: number, py: number, a: number[], b: number[], c: number[]) => {
    const p = [px, py];
    const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  for (let y = 0; y < n; y++) {
    const row: number[] = [];
    for (let x = 0; x < n; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      const head = ((cx - 6) / 5) ** 2 + ((cy - 7.2) / 4.3) ** 2 <= 1;
      const ear = inTri(cx, cy, [0.6, 0.4], [1.6, 5], [4.6, 3.6]) || inTri(cx, cy, [11.4, 0.4], [10.4, 5], [7.4, 3.6]);
      let v = head || ear ? 0.78 : 0.06;
      if (((cx - 3.9) ** 2 + (cy - 6.6) ** 2) < 0.9 || ((cx - 8.1) ** 2 + (cy - 6.6) ** 2) < 0.9) v = 0.12; // eyes
      if (((cx - 6) ** 2) / 0.5 + ((cy - 8.6) ** 2) / 0.3 < 1) v = 0.98; // nose
      const k = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      v += ((k - Math.floor(k)) - 0.5) * 0.08;
      row.push(Math.max(0, Math.min(1, v)));
    }
    g.push(row);
  }
  return g;
})();

export const MLBoard: React.FC<BoardProps> = ({ t }) => {
  const px0 = 470, py0 = 330, cs = 13;
  const layers = [5, 6, 4, 2];
  const lx = [890, 1030, 1170, 1300];
  const ly = (l: number, i: number) => 412 + (i - (layers[l] - 1) / 2) * 62;
  const kern = prog(t, 8, 16, (x) => x);
  const kx = Math.floor(kern * 9.99) % 10, ky = Math.floor(kern * 3.99);
  const featTitles = ['edges', 'ears', 'eyes'];
  const nodeIn = (l: number) => prog(t, 14 + l * 3, 8, backOut);
  const sig = (l: number) => prog(t, 22 + l * 10, 10, (x) => x); // signal from layer l to l+1
  const act = (l: number, i: number) => (l === 0 ? 0.5 + 0.5 * Math.sin(i * 2.1 + 1) : 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + l * 2.3)));
  const lit = (l: number) => (l === 0 ? prog(t, 20, 6) : prog(t, 22 + (l - 1) * 10 + 8, 5));
  const out = prog(t, 52, 14, easeOut);
  const cat = Math.round(94 * out);
  return (
    <Svg>
      {[['PIXELS', 548], ['FEATURES', 728], ['NETWORK', 1030], ['PREDICTION', 1395]].map(([s, x], k) => (
        <text key={s} x={x as number} y={236} textAnchor="middle" fontFamily={fonts.mono} fontSize={12} letterSpacing="0.18em" fill={DIM} opacity={prog(t, k * 6, 10) * 0.85}>{s}</text>
      ))}
      {/* input image */}
      {CAT.map((row, y) => row.map((v, x) => (
        <rect key={`${x}-${y}`} x={px0 + x * cs} y={py0 + y * cs} width={cs - 1} height={cs - 1} rx={1.5}
          fill={`rgba(242,240,234,${v})`} opacity={prog(t, y * 0.8, 5)} />
      )))}
      <rect x={px0 - 6} y={py0 - 6} width={12 * cs + 11} height={12 * cs + 11} rx={8} fill="none" stroke={AXIS} opacity={prog(t, 0, 8)} />
      {t >= 8 && t < 26 && (
        <rect x={px0 + kx * cs - 1} y={py0 + ky * 3 * cs - 1} width={3 * cs + 1} height={3 * cs + 1} rx={3} fill="none" stroke={AMBER} strokeWidth={2} style={{ filter: `drop-shadow(0 0 6px ${AMBER})` }} />
      )}
      {/* feature maps */}
      {featTitles.map((name, k) => {
        const fy = 300 + k * 84;
        const fill = prog(t, 10 + k * 3, 12);
        return (
          <g key={name}>
            {Array.from({ length: 36 }, (_, i) => {
              const x = i % 6, y = Math.floor(i / 6);
              const on = k === 0 ? (x === 0 || x === 5 || y === 5 ? 1 : 0.15) : k === 1 ? (y < 2 && (x < 2 || x > 3) ? 1 : 0.12) : (y === 2 && (x === 1 || x === 4) ? 1 : 0.1);
              return <rect key={i} x={700 + x * 10} y={fy + y * 10} width={9} height={9} rx={1.5} fill={k === 0 ? BLUE : k === 1 ? CYAN : '#A5B4FC'} opacity={on * fill * (y * 6 + x <= fill * 36 ? 1 : 0)} />;
            })}
            <rect x={696} y={fy - 4} width={68} height={68} rx={6} fill="none" stroke={AXIS} opacity={prog(t, 8 + k * 3, 8)} />
            <Mono x={780} y={fy + 34} anchor="start" size={11} opacity={fill}>{name}</Mono>
          </g>
        );
      })}
      {/* edges */}
      {layers.slice(0, -1).map((n, l) => Array.from({ length: n }, (_, i) => Array.from({ length: layers[l + 1] }, (_, j) => (
        <line key={`${l}-${i}-${j}`} x1={lx[l]} y1={ly(l, i)} x2={lx[l + 1]} y2={ly(l + 1, j)} stroke={BLUE} strokeOpacity={0.28 * nodeIn(l + 1)} strokeWidth={1.2} />
      ))))}
      {/* features feed the first layer */}
      {[0, 1, 2].map((k) => Array.from({ length: 5 }, (_, i) => (
        <line key={`f${k}-${i}`} x1={764} y1={334 + k * 84} x2={lx[0]} y2={ly(0, i)} stroke={BLUE} strokeOpacity={0.16 * nodeIn(0)} strokeWidth={1} />
      )))}
      {/* signal pulses */}
      {layers.slice(0, -1).map((n, l) => {
        const s = sig(l);
        if (s <= 0 || s >= 1) return null;
        return Array.from({ length: n }, (_, i) => Array.from({ length: layers[l + 1] }, (_, j) => {
          if ((i + j + l) % 2 === 1) return null;
          const x = lerp(lx[l], lx[l + 1], s), y = lerp(ly(l, i), ly(l + 1, j), s);
          return <circle key={`p${l}-${i}-${j}`} cx={x} cy={y} r={3.2} fill={l === 2 ? AMBER : '#BFDBFE'} style={{ filter: `drop-shadow(0 0 5px ${l === 2 ? AMBER : BLUE})` }} />;
        }));
      })}
      {/* nodes */}
      {layers.map((n, l) => Array.from({ length: n }, (_, i) => {
        const s = nodeIn(l);
        const isOut = l === layers.length - 1;
        const win = isOut && i === 0 ? out : 0;
        const a = lit(l) * act(l, i);
        return (
          <g key={`n${l}-${i}`} transform={`translate(${lx[l]} ${ly(l, i)}) scale(${s})`}>
            <circle r={14} fill={win > 0.01 ? AMBER : '#111318'} fillOpacity={win > 0.01 ? win : 1} stroke={win > 0.01 ? AMBER : BLUE} strokeWidth={2.5} style={win > 0.01 ? { filter: `drop-shadow(0 0 ${12 * win}px ${AMBER})` } : undefined} />
            {!isOut && <circle r={14} fill={BLUE} opacity={a * 0.55} />}
          </g>
        );
      }))}
      {/* prediction */}
      {['cat', 'dog'].map((name, i) => {
        const y = ly(3, i);
        const p = i === 0 ? cat : Math.round(6 * out);
        return (
          <g key={name} opacity={prog(t, 46, 8)}>
            <text x={1330} y={y + 5} fontSize={15} fontWeight={i === 0 ? 700 : 500} fill={i === 0 ? AMBER_T : DIM}>{name}</text>
            <rect x={1372} y={y - 4} width={110} height={8} rx={4} fill="rgba(255,255,255,0.08)" />
            <rect x={1372} y={y - 4} width={(110 * p) / 100} height={8} rx={4} fill={i === 0 ? AMBER : DIM} style={i === 0 ? { filter: `drop-shadow(0 0 6px ${AMBER})` } : undefined} />
            <text x={1492} y={y + 5} fontSize={13} fontFamily={fonts.mono} fill={i === 0 ? AMBER_T : DIM}>{p}%</text>
          </g>
        );
      })}
      <g opacity={prog(t, 62, 10, easeOut)}>
        <text x={1395} y={560} textAnchor="middle" fontSize={20} fontWeight={700} fill={INK}>Prediction: <tspan fill={AMBER_T}>cat</tspan></text>
      </g>
    </Svg>
  );
};

export const BOARDS = {
  stackqueue: { C: StackQueueBoard, steps: STACKQUEUE_STEPS },
  geometry: { C: GeometryBoard, steps: GEOMETRY_STEPS },
  physics: { C: PhysicsBoard, steps: PHYSICS_STEPS },
  chem: { C: ChemBoard, steps: CHEM_STEPS },
  ml: { C: MLBoard, steps: ML_STEPS },
} as const;
