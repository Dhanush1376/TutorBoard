import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../../components/Backdrop';
import { Cursor } from '../../components/Cursor';
import { Cam, FULL, lerpCam } from '../../components/UIShot';
import { easeIn, easeInOut, easeOut, lerp, prog } from '../../lib/anim';
import { fonts } from '../../theme';
import { BOARDS } from '../boards/Subjects';
import { caretOn, clampCam, mmss, plan } from '../lib';
import { AppCam } from '../ui/AppCam';
import { LessonState, LessonUI } from '../ui/LessonUI';
import { Caption, CaptionScrim } from '../ui/Overlay';

type Sub = { key: keyof typeof BOARDS; title: string; question: string; kind: string; guide: string; steps: string[]; explain: string[]; vo: string; start: number; end: number };
const SUBS: Sub[] = plan.montage.subjects;
const WALL: [number, number] = plan.montage.wall;
const BOARD_LEN = 80;
const T0 = 14; // board starts drawing this many frames into a segment (before the whip lands)

const composerCam: Cam = clampCam({ x: 360, y: 880, z: 2.4 });
const boardA: Cam = { x: 1150, y: 452, z: 1.2 };
const boardB: Cam = { x: 1140, y: 446, z: 1.34 };

/** Lesson state for a subject at board time t (frames since its board started). */
export const subjectState = (sub: Sub, t: number, g = 999): LessonState => {
  const at = BOARDS[sub.key].steps;
  const active = Math.max(0, at.filter((a) => t >= a).length - 1);
  const next = at[active + 1] ?? BOARD_LEN;
  const within = Math.max(0, Math.min(1, (t - at[active]) / (next - at[active])));
  const progress = t < 0 ? 0 : (active + within) / sub.steps.length;
  const total = sub.steps.length * 8;
  const typed = Math.max(0, Math.min(1, (g - 2) / 14));
  return {
    title: sub.title,
    kind: sub.kind,
    guide: sub.guide,
    steps: sub.steps,
    active,
    explanation: sub.explain[active],
    explanationChars: t < 0 ? 0 : (t - at[active]) * 4.2,
    playing: t >= 0,
    progress,
    time: [mmss(progress * total), mmss(total)],
    chatQuestion: sub.question,
    composerText: g < 20 ? sub.question.slice(0, Math.round(typed * sub.question.length)) : '',
    composerCaret: g < 20 ? caretOn(g) || typed < 1 : false,
    hover: g >= 15 && g < 20 ? 'send' : null,
  };
};

const Board: React.FC<{ sub: Sub; t: number }> = ({ sub, t }) => {
  const C = BOARDS[sub.key].C;
  return t >= 0 ? <C t={t} /> : null;
};

/** A whole lesson screen as a card (used on the wall). */
const Card: React.FC<{ sub: Sub; t: number; cam: Cam; cx: number; cy: number; scale: number; opacity?: number }> = ({ sub, t, cam, cx, cy, scale, opacity = 1 }) => (
  <div
    style={{
      position: 'absolute', left: cx - 960 * scale, top: cy - 540 * scale, width: 1920, height: 1080,
      transform: `scale(${scale})`, transformOrigin: '0 0', opacity,
      borderRadius: 14 / Math.max(scale, 0.2), overflow: 'hidden',
      boxShadow: `0 ${40 / scale}px ${120 / scale}px rgba(0,0,0,0.7), 0 0 0 ${1.2 / scale}px rgba(255,255,255,0.16)`,
    }}
  >
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0', transform: `translate(${960 - cam.x * cam.z}px, ${540 - cam.y * cam.z}px) scale(${cam.z})` }}>
      <LessonUI s={subjectState(sub, t)} board={<Board sub={sub} t={t} />} />
    </div>
  </div>
);

/**
 * 900–1530. Five subjects, two seconds of each: the question typed into the
 * composer, Send, a whip to the board where the lesson is already drawing.
 * Then every lesson at once.
 */
export const Montage: React.FC = () => {
  const f = useCurrentFrame();
  if (f < SUBS[0].start) return null;

  if (f >= WALL[0]) return <Wall f={f - WALL[0]} />;

  const k = SUBS.findIndex((s) => f >= s.start && f < s.end);
  const sub = SUBS[k];
  const g = f - sub.start;
  const t = g - T0;

  let cam: Cam;
  let whip = 0;
  if (g < 20) cam = { ...composerCam, z: composerCam.z * (1 + g * 0.002) };
  else if (g < 30) {
    const p = prog(g, 20, 10, easeInOut);
    cam = lerpCam({ ...composerCam, z: composerCam.z * 1.04 }, boardA, p);
    whip = Math.sin(p * Math.PI) * 30;
  } else cam = lerpCam(boardA, boardB, prog(g, 30, 75, (x) => x));
  whip = Math.max(whip, (1 - prog(g, 0, 5)) * 26, prog(g, 100, 5, easeIn) * 26);

  const s = subjectState(sub, t, g);
  return (
    <AbsoluteFill>
      <Backdrop dots={0.6} />
      <AppCam cam={cam} whip={whip}>
        <LessonUI s={s} board={<Board sub={sub} t={t} />} />
      </AppCam>
      <Sequence from={sub.start} layout="none">
      <Cursor
        cam={cam}
        opacity={prog(g, 6, 5) * (1 - prog(g, 21, 4))}
        scale={1.5}
        path={[
          { f: 6, x: 430, y: 950 },
          { f: 16, x: 296, y: 1027 },
          { f: 26, x: 330, y: 990 },
        ]}
        clicks={[19]}
      />
      <CaptionScrim opacity={prog(g, 26, 8) * (1 - prog(g, 96, 8)) * 0.8} />
      <Caption text={sub.vo} inAt={26} outAt={96} y={1012} size={46} />
      <div style={{ position: 'absolute', left: 120, top: 902, fontFamily: fonts.mono, fontSize: 15, letterSpacing: '0.2em', color: 'rgba(244,243,238,0.6)', opacity: prog(g, 28, 8) * (1 - prog(g, 96, 8)) }}>
        {`0${k + 1} / 0${SUBS.length}`}
      </div>
      </Sequence>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

const SLOTS = [
  { x: 348, y: 318 }, { x: 960, y: 318 }, { x: 1572, y: 318 },
  { x: 654, y: 678 }, { x: 1266, y: 678 },
];

const Wall: React.FC<{ f: number }> = ({ f }) => {
  const len = WALL[1] - WALL[0];
  const last = SUBS.length - 1;
  const shrink = prog(f, 0, 26, easeInOut);
  const pull = prog(f, 20, len - 20, (x) => x);
  const out = prog(f, len - 16, 16, easeIn);
  const rotX = lerp(9, 4, pull);
  const rotY = lerp(-7, -2, pull);
  const endCam: Cam = boardB;
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      <Backdrop dots={0.5} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <AbsoluteFill
          style={{
            transform: `rotateX(${rotX * shrink}deg) rotateY(${rotY * shrink}deg) scale(${lerp(1, 0.94, pull) * (1 - out * 0.12)})`,
            opacity: 1 - out, filter: out > 0.01 ? `blur(${out * 10}px)` : undefined,
          }}
        >
          {SUBS.map((sub, i) => {
            if (i === last) {
              // the last lesson pulls back from full screen into its slot
              const scale = lerp(1, 0.3, shrink);
              const cx = lerp(960, SLOTS[i].x, shrink);
              const cy = lerp(540, SLOTS[i].y, shrink);
              return <Card key={sub.key} sub={sub} t={BOARD_LEN + 1 + f} cam={lerpCam(endCam, FULL, shrink)} cx={cx} cy={cy} scale={scale} />;
            }
            const a = prog(f, 6 + i * 3, 16, easeOut);
            return <Card key={sub.key} sub={sub} t={BOARD_LEN + 20} cam={FULL} cx={SLOTS[i].x} cy={SLOTS[i].y + (1 - a) * 30} scale={0.3 * lerp(0.92, 1, a)} opacity={a} />;
          })}
        </AbsoluteFill>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 902, textAlign: 'center', fontFamily: fonts.sans, fontSize: 60, fontWeight: 600,
          letterSpacing: '-0.035em', color: '#F4F3EE', opacity: prog(f, 26, 14, easeOut) * (1 - out), transform: `translateY(${(1 - prog(f, 26, 14, easeOut)) * 16}px)`,
        }}
      >
        <span style={{ color: 'rgba(244,243,238,0.55)' }}>One board for </span>whatever you want to understand.
      </div>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
