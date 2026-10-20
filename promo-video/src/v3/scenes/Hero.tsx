import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../../components/Backdrop';
import { Cursor } from '../../components/Cursor';
import { Cam, lerpCam, UIShot } from '../../components/UIShot';
import { easeInOut, easeOut, keys, prog } from '../../lib/anim';
import { composerDrift, composerMacro, FULL } from '../../lib/cams';
import { centerOf, rect, shotFrame, still } from '../../lib/capture';
import { BubbleBoard } from '../boards/BubbleBoard';
import { bubbleBase, bubbleStep, caretOn, clampCam, mmss, plan, typedCount } from '../lib';
import { AppCam } from '../ui/AppCam';
import { LessonUI } from '../ui/LessonUI';
import { Callout, Caption, CaptionScrim } from '../ui/Overlay';

const T = plan.hero;
const OPS = plan.sort.pass1;

export const controlsCam: Cam = clampCam({ x: 975, y: 900, z: 2.3 });
export const boardCam: Cam = { x: 1200, y: 420, z: 1.22 };
export const heroEndCam: Cam = { x: 1170, y: 392, z: 1.38 };
const floatA: Cam = { x: 960, y: 560, z: 0.8 };

/** Lesson progress: the 32 s lesson, 8 s per step. */
export const progressAt = (step: number, within: number) => Math.min(1, (step + within) / 4);

/**
 * Hook → 540. The real app: Deep Visual Dive, the question typed key by key,
 * Send, the real pipeline screens, the real lesson arriving. Then (in the
 * rebuild) a tour of the controls, Play, and Bubble Sort comparing and
 * swapping on the board.
 */
export const Hero: React.FC = () => {
  const f = useCurrentFrame() - T.lead;

  // ── camera ────────────────────────────────────────────────────────────────
  let cam: Cam;
  if (f < 0) cam = { ...floatA, z: floatA.z * (1 + (f + T.lead) * 0.0015) };
  else if (f < T.push[1]) cam = lerpCam({ ...floatA, z: floatA.z * (1 + T.lead * 0.0015) }, composerMacro, prog(f, 0, T.push[1], easeInOut));
  else if (f < T.clickSend) cam = lerpCam(composerMacro, composerDrift, prog(f, T.push[1], T.clickSend - T.push[1], easeInOut));
  else if (f < T.controls[0]) cam = lerpCam(composerDrift, FULL, prog(f, T.clickSend + 2, 30, easeInOut));
  else if (f < T.toBoard[0]) cam = lerpCam(FULL, controlsCam, prog(f, T.controls[0], 24, easeInOut));
  else cam = lerpCam(lerpCam(controlsCam, boardCam, prog(f, T.toBoard[0], T.toBoard[1] - T.toBoard[0], easeInOut)), heroEndCam, prog(f, T.toBoard[1], 390 - T.toBoard[1], (x) => x));
  const rotX = keys(f, [[-T.lead, 13], [-4, 9], [T.push[1], 0]]);
  const rotY = keys(f, [[-T.lead, -7], [-4, -4], [T.push[1], 0]]);

  // ── real footage until the hand-off ───────────────────────────────────────
  let src = still('mode-selected');
  if (f >= T.typing[0] - 6) src = shotFrame('typing', typedCount(T.typing, f));
  if (f >= T.clickSend - 12) src = still('send-hover');
  if (f > T.clickSend) src = shotFrame('send', ((f - T.clickSend) * 23) / (T.think[1] - T.clickSend));
  if (f >= T.reveal[0]) src = shotFrame('reveal', ((f - T.reveal[0]) * 104) / (T.reveal[1] - T.reveal[0]));
  const rebuild = prog(f, T.handoff[0], T.handoff[1] - T.handoff[0], easeInOut);

  // ── lesson state in the rebuild ───────────────────────────────────────────
  const playing = f >= T.clickPlay + 1;
  const step = f < OPS[0].at ? 0 : f < OPS[1].at ? 1 : 2;
  const stepStart = step === 0 ? T.clickPlay : OPS[step === 1 ? 0 : 1].at;
  const within = step === 0 ? prog(f, T.clickPlay, OPS[0].at - T.clickPlay, (x) => x) : step === 1 ? prog(f, OPS[0].at, OPS[0].dur, (x) => x) : prog(f, OPS[1].at, OPS[3].at + OPS[3].dur - OPS[1].at, (x) => x) * 0.95;
  const progress = playing ? progressAt(step, within) : 0.0;
  const s = {
    ...bubbleBase,
    ...bubbleStep(step),
    // the real capture is still typing the first explanation at the hand-off — keep typing across the cut
    explanationChars: step === 0 ? (f < 200 ? 186 + (f - T.handoff[0]) * 1.4 : undefined) : (f - stepStart) * 3.4,
    composerCaret: caretOn(f),
    playing,
    progress,
    time: [mmss(progress * 32), '0:32'] as [string, string],
    hover: f > T.clickPlay - 8 && f < T.clickPlay + 6 ? ('play' as const) : null,
  };

  const play = centerOf(rect('playBtn', { x: 788, y: 999, w: 38, h: 38 }));
  const send = centerOf(rect('sendBtnTyped', { x: 273, y: 1005, w: 44, h: 44 }));

  return (
    <AbsoluteFill>
      <Backdrop dots={0.7} />
      {rebuild < 1 && (
        <UIShot src={src} cam={cam} rotX={rotX} rotY={rotY} radius={14} />
      )}
      {rebuild > 0 && (
        <AppCam cam={cam} opacity={rebuild}>
          <LessonUI s={s} board={<BubbleBoard values={[5, 1, 4, 2, 8]} ops={OPS} frame={f} />} />
        </AppCam>
      )}

      <Sequence from={T.lead} layout="none">
      <Cursor
        cam={cam}
        opacity={prog(f, T.clickSend - 30, 8) * (1 - prog(f, T.clickSend + 10, 8))}
        scale={1.5}
        path={[
          { f: T.clickSend - 30, x: send.x + 80, y: send.y - 70 },
          { f: T.clickSend - 5, x: send.x, y: send.y },
        ]}
        clicks={[T.clickSend]}
      />
      {/* control tour */}
      <Callout cam={cam} anchor={{ x: 975, y: 930 }} dx={0} dy={-150} text="Step by step" inAt={T.controls[0] + 14} outAt={T.toBoard[0] - 2} />
      <Callout cam={cam} anchor={{ x: play.x, y: play.y - 20 }} dx={-90} dy={-250} text="Play · Pause" inAt={T.controls[0] + 18} outAt={T.toBoard[0] - 2} />
      <Callout cam={cam} anchor={{ x: 1177, y: 1004 }} dx={90} dy={-250} text="Ask a doubt" inAt={T.controls[0] + 22} outAt={T.toBoard[0] - 2} />
      <Cursor
        cam={cam}
        opacity={prog(f, T.controls[0] + 6, 8) * (1 - prog(f, T.clickPlay + 12, 10))}
        scale={1.6}
        path={[
          { f: T.controls[0] + 6, x: 1080, y: 930 },
          { f: T.clickPlay - 5, x: play.x + 2, y: play.y + 2 },
          { f: T.clickPlay + 24, x: play.x + 90, y: play.y - 40 },
        ]}
        clicks={[T.clickPlay]}
      />

      <CaptionScrim opacity={prog(f, 20, 10) * (1 - prog(f, 84, 10)) + prog(f, 232, 12) * (1 - prog(f, 384, 6))} />
      <Caption text="Ask anything." inAt={24} outAt={84} />
      <Caption text="Watch the answer come to life." inAt={236} outAt={372} dim={['Watch', 'the']} />
      </Sequence>
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
