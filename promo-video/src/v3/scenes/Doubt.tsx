import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../../components/Backdrop';
import { Cursor } from '../../components/Cursor';
import { Cam, lerpCam } from '../../components/UIShot';
import { easeIn, easeInOut, easeOut, prog } from '../../lib/anim';
import { BubbleBoard } from '../boards/BubbleBoard';
import { bubbleBase, bubbleStep, caretOn, clampCam, doubtData, mmss, plan, typedCount } from '../lib';
import { AppCam } from '../ui/AppCam';
import { LessonState, LessonUI } from '../ui/LessonUI';
import { Caption, CaptionScrim } from '../ui/Overlay';
import { heroEndCam, progressAt } from './Hero';

const D = plan.doubt;
const F = plan.finish;
const CALLOUT = 'larger than neighbors, bubbled right'; // the delta agent's real annotation
const AFTER_PASS1 = [1, 4, 2, 5, 8];

export const barCam: Cam = clampCam({ x: 1000, y: 900, z: 2.1 });
export const panelCam: Cam = { x: 1290, y: 470, z: 1.12 };
const resumeCam: Cam = { x: 1300, y: 500, z: 1.1 };
const sortedCam: Cam = { x: 1136, y: 330, z: 1.6 };

/**
 * 540–780. Pause, open the doubt input, ask about the step on screen. The
 * answer arrives on the board: the exact cell lights up, the callout lands
 * under it, and the Session panel answers in words.
 */
export const DoubtScene: React.FC = () => {
  const f = useCurrentFrame();
  let cam: Cam;
  if (f < D.toPanel[0]) cam = lerpCam(heroEndCam, barCam, prog(f, D.toBar[0], D.toBar[1] - D.toBar[0] + 4, easeInOut));
  else cam = lerpCam(barCam, panelCam, prog(f, D.toPanel[0], D.toPanel[1] - D.toPanel[0], easeInOut));
  // a slow push while the answer lands
  if (f > D.toPanel[1]) cam = { ...cam, z: cam.z * (1 + (f - D.toPanel[1]) * 0.0006) };

  const typed = doubtData.q.slice(0, typedCount(D.typing, f));
  const open = prog(f, D.open[0], D.open[1] - D.open[0], easeOut) * (1 - prog(f, D.enter + 2, 10, easeIn));
  const qIn = prog(f, D.enter + 2, 12, easeOut);
  const s: LessonState = {
    ...bubbleBase,
    ...bubbleStep(2),
    playing: f < D.clickPause,
    progress: progressAt(2, 0.95),
    time: [mmss(progressAt(2, 0.95) * 32), '0:32'],
    doubtOpen: open,
    doubtText: f < D.enter ? typed : '',
    caret: caretOn(f),
    hover: f > D.clickDoubt - 6 && f < D.clickDoubt + 4 ? 'doubt' : f > D.clickPause - 6 && f < D.clickPause + 4 ? 'play' : null,
    question: f > D.enter ? {
      q: doubtData.q, step: 3, answer: doubtData.answer, followUp: doubtData.followUp,
      answerChars: f < D.answer[0] ? 0 : doubtData.answer.length,
      answerIn: prog(f, D.answer[0], 12, easeOut),
      followIn: prog(f, D.followUp, 10), looking: f - D.enter, in: qIn,
    } : undefined,
  };

  return (
    <AbsoluteFill>
      <Backdrop dots={0.6} />
      <AppCam cam={cam}>
        <LessonUI
          s={s}
          board={<BubbleBoard values={AFTER_PASS1} ops={[]} doubt={{ slot: 3, at: D.highlight, calloutAt: D.callout, text: CALLOUT }} />}
        />
      </AppCam>
      <Cursor
        cam={cam}
        opacity={prog(f, 2, 8) * (1 - prog(f, D.clickDoubt + 10, 8))}
        scale={1.55}
        path={[
          { f: 0, x: 900, y: 930 },
          { f: D.clickPause - 4, x: 808, y: 1019 },
          { f: D.clickDoubt - 4, x: 1178, y: 1019 },
          { f: D.clickDoubt + 18, x: 1230, y: 960 },
        ]}
        clicks={[D.clickPause, D.clickDoubt]}
      />
      <CaptionScrim opacity={prog(f, 4, 10) * (1 - prog(f, 70, 10)) + prog(f, 138, 10) * (1 - prog(f, 228, 10))} />
      <Caption text="Have a doubt? Just ask." inAt={6} outAt={70} dim={['Have', 'a', 'doubt?']} />
      <Caption text="It answers right on the board." inAt={140} outAt={226} />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

/**
 * 780–900. Resume picks up exactly where the lesson was: the answer clears,
 * step 4 runs, and the array settles sorted.
 */
export const FinishScene: React.FC = () => {
  const f = useCurrentFrame();
  const endPanel: Cam = { ...panelCam, z: panelCam.z * (1 + (240 - D.toPanel[1]) * 0.0006) };
  let cam = lerpCam(endPanel, resumeCam, prog(f, 0, 10, easeInOut));
  if (f >= 12) cam = lerpCam(resumeCam, sortedCam, prog(f, 12, 60, easeInOut));
  const resumed = f >= F.clickResume + 1;
  const ops = plan.sort.pass2;
  const qOut = 1 - prog(f, F.clickResume + 1, 10, easeIn);
  const within = prog(f, F.pass2[0], F.sorted - F.pass2[0], (x) => x);
  const progress = resumed ? progressAt(3, within) : progressAt(2, 0.95);
  const s: LessonState = {
    ...bubbleBase,
    ...bubbleStep(resumed ? 3 : 2),
    explanationChars: resumed ? (f - F.clickResume) * 3.6 : undefined,
    playing: resumed && f < F.sorted + 10,
    progress,
    time: [mmss(progress * 32), '0:32'],
    hover: f > F.clickResume - 6 && f < F.clickResume + 4 ? 'resume' : null,
    question: qOut > 0.01 ? { q: doubtData.q, step: 3, answer: doubtData.answer, followUp: doubtData.followUp, answerChars: 999, followIn: 1, in: qOut } : undefined,
  };
  return (
    <AbsoluteFill>
      <Backdrop dots={0.6} />
      <AppCam cam={cam}>
        <LessonUI
          s={s}
          board={
            <BubbleBoard
              values={AFTER_PASS1}
              ops={ops}
              sortedAt={F.sorted}
              doubt={{ slot: 3, at: -100, calloutAt: -100, text: CALLOUT, out: F.clickResume }}
            />
          }
        />
      </AppCam>
      <Cursor
        cam={cam}
        opacity={(1 - prog(f, F.clickResume + 8, 8))}
        scale={1.5}
        path={[
          { f: -8, x: 1660, y: 870 },
          { f: F.clickResume - 3, x: 1800, y: 946 },
          { f: F.clickResume + 14, x: 1830, y: 900 },
        ]}
        clicks={[F.clickResume]}
      />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
