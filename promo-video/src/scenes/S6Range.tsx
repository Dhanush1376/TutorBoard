import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../components/Backdrop';
import { Line } from '../components/Kinetic';
import { Cam, frameRect, lerpCam, UIShot } from '../components/UIShot';
import { easeIn, easeInOut, easeOut, prog } from '../lib/anim';
import { doubtEnd } from '../lib/cams';
import { Rect, shotFrame, subjectFrame, timeline } from '../lib/capture';
import { color, fonts } from '../theme';

const T = timeline.range;
const D = timeline.doubt;

type Subject = {
  key: string; label: string; question: string; start: number; end: number;
  typing: number[]; whip: [number, number]; payoffStart: number;
  composer: Rect; content: Rect | null; payoffFrames: number; typingFrames: number;
};

/**
 * "Any subject." Each subject is two bars of real product: the question
 * typed into the composer, a whip across the interface to the board, and that
 * lesson's own visual arriving — a parabola's roots, a trajectory, a loss
 * curve, an atom. Every frame is the real app.
 */
export const S6Range: React.FC = () => {
  const frame = useCurrentFrame();
  const subjects: Subject[] = T.subjects;
  const i1: number = T.intro[1];
  const [o0, o1] = T.outro;

  // ── intro: the Bubble Sort lesson recedes ──
  if (frame < i1) {
    const m: number[] = D.resumeMap;
    const away = prog(frame, 0, 34, easeInOut);
    const cam: Cam = lerpCam(doubtEnd, { x: 1100, y: 470, z: 0.62 }, away);
    return (
      <AbsoluteFill>
        <Backdrop dots={0.8} />
        <UIShot src={shotFrame('resume', m[m.length - 1])} cam={cam} opacity={1 - prog(frame, 20, 22)} blur={away * 6} />
        <AbsoluteFill style={{ justifyContent: 'center' }}>
          <Line words={['Ask', 'about', { text: 'anything.', color: color.ink }]} inAt={22} outAt={i1 - 8} size={92} weight={600} stagger={5} />
        </AbsoluteFill>
        <Grain />
      </AbsoluteFill>
    );
  }

  // ── outro: hand the line to the brand ──
  if (frame >= o0) {
    const last = subjects[subjects.length - 1];
    return (
      <AbsoluteFill>
        <Backdrop dots={0.7} />
        {last && (
          <UIShot
            src={subjectFrame(last.key, 'payoff', last.payoffFrames - 1, last.payoffFrames)}
            cam={payoffCam(last, 1)}
            opacity={1 - prog(frame, o0, 18)}
            blur={prog(frame, o0, 18) * 8}
          />
        )}
        <AbsoluteFill style={{ justifyContent: 'center' }}>
          <Line words={['Whatever', 'you', 'want', 'to', 'understand,']} inAt={o0 + 8} outAt={o1 + 100} size={74} weight={500} stagger={4} />
        </AbsoluteFill>
        <Grain />
      </AbsoluteFill>
    );
  }

  // ── subjects ──
  const k = Math.min(subjects.length - 1, Math.floor((frame - i1) / 160));
  const sj = subjects[k];
  const local = frame - sj.start;
  let src: string;
  let cam: Cam;
  let blur = 0;
  const macro = (() => { const c = frameRect(sj.composer, 0.62); return { ...c, z: Math.min(2.5, c.z) }; })();
  if (frame < sj.payoffStart) {
    let n = 0;
    while (n < sj.typing.length && frame >= sj.typing[n]) n++;
    src = subjectFrame(sj.key, 'typing', n, sj.typingFrames);
    cam = { ...macro, z: macro.z * (1 + 0.04 * prog(frame, sj.start, 44)) };
  } else {
    src = subjectFrame(sj.key, 'payoff', frame - sj.payoffStart, sj.payoffFrames);
    cam = payoffCam(sj, prog(frame, sj.payoffStart, sj.end - sj.payoffStart, easeOut));
  }
  // whip: move from the composer to the board with motion blur across the cut
  const [w0, w1] = sj.whip;
  if (frame >= w0 && frame < w1 + 6) {
    const t = prog(frame, w0, w1 + 6 - w0, easeInOut);
    cam = lerpCam({ ...macro, z: macro.z * 1.04 }, payoffCam(sj, 0), t);
    blur = Math.sin(Math.PI * t) * 14;
  }
  const enter = prog(frame, sj.start, 8);
  const leave = 1 - prog(frame, sj.end - 6, 6, easeIn);

  return (
    <AbsoluteFill>
      <Backdrop dots={0.6} />
      <UIShot src={src} cam={cam} blur={blur} opacity={enter * leave} />
      {/* subject marker */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 64,
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          opacity: prog(frame, sj.start + 2, 10) * leave,
          transform: `translateY(${(1 - prog(frame, sj.start + 2, 14, easeOut)) * 10}px)`,
        }}
      >
        <span style={{ fontFamily: fonts.mono, fontSize: 18, color: color.amber }}>{String(k + 1).padStart(2, '0')}</span>
        <span style={{ fontFamily: fonts.sans, fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', color: color.ink }}>{sj.label}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 220,
          background: 'linear-gradient(180deg, rgba(7,7,7,0) 0%, rgba(7,7,7,0.55) 100%)',
          opacity: local > 50 ? 1 : 0,
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
};

/** Camera on the lesson's content, pushing in slightly as it plays. */
function payoffCam(sj: Subject, t: number): Cam {
  const content = sj.content ?? { x: 700, y: 260, w: 760, h: 520 };
  const c = frameRect(content, 0.74);
  const z = Math.min(1.9, Math.max(1.1, c.z));
  return { x: c.x, y: c.y, z: z * (1 + 0.06 * t) };
}
