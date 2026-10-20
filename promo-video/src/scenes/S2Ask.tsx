import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../components/Backdrop';
import { Cursor } from '../components/Cursor';
import { Cam, lerpCam, UIShot } from '../components/UIShot';
import { easeInOut, easeOut, keys, prog } from '../lib/anim';
import { askEnd, composerDrift, composerMacro } from '../lib/cams';
import { centerOf, rect, shotFrame, still, timeline } from '../lib/capture';

const T = timeline.ask;

/**
 * 240–560. The real workspace drifts in; the student picks Deep Visual Dive
 * and asks. Every keystroke is a real capture of the composer.
 */
export const S2Ask: React.FC = () => {
  const frame = useCurrentFrame();

  const modes = centerOf(rect('modesBtn', { x: 84, y: 1012, w: 26, h: 26 }));
  const deep = centerOf(rect('deepItem', { x: 117, y: 728, w: 96, h: 18 }));
  const send = centerOf(rect('sendBtnTyped', { x: 280, y: 1012, w: 30, h: 30 }));

  // ── camera ──
  const floatA: Cam = { x: 960, y: 600, z: 0.66 };
  const floatB: Cam = { x: 960, y: 560, z: 0.86 };
  let cam: Cam;
  if (frame < 60) cam = lerpCam(floatA, floatB, prog(frame, 0, 60, easeOut));
  else if (frame < T.pushIn[0]) cam = floatB;
  else if (frame < T.pushIn[1]) cam = lerpCam(floatB, composerMacro, prog(frame, T.pushIn[0], T.pushIn[1] - T.pushIn[0], easeInOut));
  else if (frame < T.clickSend) cam = lerpCam(composerMacro, composerDrift, prog(frame, T.pushIn[1], T.clickSend - T.pushIn[1], easeInOut));
  else cam = lerpCam(composerDrift, askEnd, prog(frame, T.clickSend, 28, easeInOut));

  // Tilt settles to flat before the pointer arrives, so it lands exactly on target.
  const rotX = keys(frame, [[0, 16], [58, 0]]);
  const rotY = keys(frame, [[0, -6], [58, 0]]);
  const rise = 1 - prog(frame, 0, 40, easeOut);

  // ── which real frame is on screen ──
  const typing: number[] = T.typing;
  let src = still('workspace');
  if (frame >= T.clickModes + 2) src = still('modes-open');
  if (frame >= T.clickDeep + 2) src = still('mode-selected');
  if (frame >= typing[0] - 6) {
    let k = 0;
    while (k < typing.length && frame >= typing[k]) k++;
    src = shotFrame('typing', k);
  }
  if (frame >= T.clickSend - 14) src = still('send-hover');
  if (frame > T.clickSend) src = shotFrame('send', 0);

  const cursorIn = prog(frame, 36, 12) * (1 - prog(frame, T.pushIn[0] + 6, 12));
  const cursor2 = prog(frame, T.clickSend - 34, 10) * (1 - prog(frame, T.clickSend + 12, 10));

  return (
    <AbsoluteFill>
      <Backdrop dots={0.8} />
      <UIShot
        src={src}
        cam={{ ...cam, y: cam.y + rise * 160 }}
        rotX={rotX}
        rotY={rotY}
        opacity={prog(frame, 0, 26)}
        blur={rise * 10}
      >
        <Cursor
          cam={cam}
          opacity={cursorIn}
          path={[
            { f: 36, x: 900, y: 760 },
            { f: T.clickModes - 4, x: modes.x, y: modes.y },
            { f: T.clickDeep - 6, x: deep.x - 20, y: deep.y },
            { f: T.pushIn[0] + 20, x: deep.x + 200, y: deep.y + 160 },
          ]}
          clicks={[T.clickModes, T.clickDeep]}
        />
        <Cursor
          cam={cam}
          opacity={cursor2}
          scale={1.6}
          path={[
            { f: T.clickSend - 34, x: send.x + 70, y: send.y - 60 },
            { f: T.clickSend - 6, x: send.x, y: send.y },
          ]}
          clicks={[T.clickSend]}
        />
      </UIShot>
      <Grain />
    </AbsoluteFill>
  );
};
