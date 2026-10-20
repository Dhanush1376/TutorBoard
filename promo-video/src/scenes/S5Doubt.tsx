import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../components/Backdrop';
import { BoardCaption } from '../components/BoardCaption';
import { Cursor } from '../components/Cursor';
import { Cam, frameRect, lerpCam, toScreen, UIShot } from '../components/UIShot';
import { easeInOut, prog } from '../lib/anim';
import { boardCenterX, cellsRow, doubtEnd, unfoldEnd } from '../lib/cams';
import { cells, centerOf, manifest, rect, Rect, shotFrame, timeline, union } from '../lib/capture';
import { color } from '../theme';

const T = timeline.doubt;
const U = timeline.unfold;

/** A camera path: hold each key until the next begins, ease between them. */
const path = (frame: number, ks: Array<[number, number, Cam]>): Cam => {
  let cam = ks[0][2];
  for (let i = 1; i < ks.length; i++) {
    const [start, dur, to] = ks[i];
    if (frame >= start) cam = lerpCam(cam, to, prog(frame, start, dur, easeInOut));
  }
  return cam;
};

/**
 * 1360–2000. The differentiator. Pause on step 3, ask about what is on the
 * board — the answer arrives *on the board*: the 5 lights up, a callout lands
 * under it, the explanation fills the session panel. Then the lesson resumes.
 */
export const S5Doubt: React.FC = () => {
  const frame = useCurrentFrame();

  // ── footage ──
  const lastPlay = U.playMap[U.playMap.length - 1];
  const typing: number[] = T.typing;
  let src = shotFrame('play', lastPlay);
  if (frame > T.clickPause) src = shotFrame('pause', frame - T.clickPause - 1);
  if (frame > T.clickDoubt) src = shotFrame('doubt-open', frame - T.clickDoubt - 1);
  if (frame >= typing[0]) {
    let k = 0;
    while (k < typing.length && frame >= typing[k]) k++;
    src = shotFrame('doubt-typing', k - 1);
  }
  if (frame >= T.waitStart && frame < T.resumeStart) {
    const seq: [string, number][] = T.answerSeq;
    const [shot, f] = seq[Math.min(seq.length - 1, frame - T.waitStart)];
    src = shotFrame(shot, f);
  }
  if (frame >= T.resumeStart) {
    const m: number[] = T.resumeMap;
    src = shotFrame('resume', m[Math.min(m.length - 1, frame - T.resumeStart)]);
  }

  // ── geometry from the capture ──
  const pauseBtn = centerOf(rect('pauseBtn', { x: 790, y: 1000, w: 36, h: 36 }));
  const doubtBtn = centerOf(rect('doubtBtnLive', { x: 1165, y: 1004, w: 28, h: 28 }));
  const input: Rect = rect('doubtInput', { x: 1150, y: 1000, w: 220, h: 34 });
  const card: Rect = rect('answerCard', { x: 1580, y: 160, w: 290, h: 20 });
  const resumeBtn = centerOf(rect('resumeBtn', { x: 1785, y: 938, w: 60, h: 16 }));
  const answerCells = cells('cellsAnswer');
  // Emphasis follows what the AI actually highlighted in this take: a single
  // cell ("arr[3]") or the whole array — the film never points anywhere else.
  const hlTarget = String(
    (manifest.data.doubt as any)?.actions?.find((a: any) => a.cmd === 'highlight')?.id ?? '',
  );
  const cellIdx = /\[(\d+)\]$/.exec(hlTarget);
  const rowRect = answerCells.length ? union(answerCells) : { x: 856, y: 205, w: 560, h: 98 };
  const five: Rect = cellIdx && answerCells[+cellIdx[1]] ? answerCells[+cellIdx[1]] : rowRect;
  const callout: Rect = rect('calloutAnswer', { x: five.x - 120, y: five.y + 180, w: 380, h: 56 });

  // ── camera ──
  const stuck: Cam = { x: boardCenterX, y: cellsRow.y + 200, z: 1.42 };
  const controlBar: Rect = rect('controlBar', { x: input.x - 420, y: input.y - 10, w: 420, h: 54 });
  const bar: Cam = frameRect(union([controlBar, input]), 0.62);
  bar.z = Math.min(bar.z, 2.0);
  const typingCam: Cam = { ...frameRect(input, 0.5), z: 2.5 };
  const cardCam: Cam = { x: card.x + 150, y: card.y + 120, z: 2.0 };
  const focus: Cam = (() => { const c = frameRect(union([five, callout]), 0.56); return { ...c, z: Math.min(2.3, c.z) }; })();
  const answerCam: Cam = { x: card.x + 150, y: card.y + 150, z: 1.75 };
  const both: Cam = { x: 1390, y: 380, z: 1.22 };

  const hl = T.highlight;
  const cam = path(frame, [
    [0, 0, unfoldEnd],
    [14, 50, stuck],
    [100, 30, bar],
    [132, 22, typingCam],
    [T.enter + 2, 32, cardCam],
    [hl - 22, 22, focus],
    [hl + 70, 36, answerCam],
    [hl + 118, 36, both],
    [T.resumeStart + 6, 50, doubtEnd],
  ]);

  // amber bloom on the cell, synchronised to the real highlight
  const bloom = Math.sin(Math.PI * prog(frame, hl - 2, 34));
  const f5 = toScreen(cam, { x: five.x + five.w / 2, y: five.y + five.h / 2 });
  const glowW = Math.max(520, five.w * cam.z * 1.6);

  return (
    <AbsoluteFill>
      <Backdrop dots={0.5} />
      <UIShot src={src} cam={cam}>
        <div
          style={{
            position: 'absolute',
            left: f5.x - glowW / 2,
            top: f5.y - 260,
            width: glowW,
            height: 520,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color.amberGlow} 0%, rgba(245,165,36,0) 60%)`,
            opacity: bloom * 0.9,
            mixBlendMode: 'screen',
          }}
        />
        <BoardCaption
          cam={cam}
          at={{ x: boardCenterX, y: cellsRow.y + cellsRow.h + 200 }}
          words={['Stuck', 'on', 'step', '3?']}
          inAt={36}
          outAt={96}
          size={46}
          weight={600}
        />
        <BoardCaption
          cam={cam}
          at={{ x: boardCenterX - 30, y: cellsRow.y + cellsRow.h + 330 }}
          words={['It', 'answers', { text: 'on the board.', color: color.amber }]}
          inAt={hl + 128}
          outAt={T.clickResume - 4}
          size={38}
          weight={600}
        />
        <BoardCaption
          cam={cam}
          at={{ x: boardCenterX, y: cellsRow.y + cellsRow.h + 230 }}
          words={['…and', 'picks', 'up', 'where', 'you', 'left', 'off.']}
          inAt={T.resumeStart + 40}
          outAt={640}
          size={36}
          dim={0.9}
        />
        <Cursor
          cam={cam}
          opacity={prog(frame, 0, 6) * (1 - prog(frame, T.clickPause + 12, 10))}
          path={[
            { f: 0, x: pauseBtn.x + 90, y: pauseBtn.y - 60 },
            { f: T.clickPause - 3, x: pauseBtn.x, y: pauseBtn.y },
          ]}
          clicks={[T.clickPause]}
        />
        <Cursor
          cam={cam}
          opacity={prog(frame, 98, 8) * (1 - prog(frame, T.clickDoubt + 14, 10))}
          path={[
            { f: 98, x: doubtBtn.x - 200, y: doubtBtn.y - 120 },
            { f: T.clickDoubt - 3, x: doubtBtn.x, y: doubtBtn.y },
          ]}
          clicks={[T.clickDoubt]}
        />
        <Cursor
          cam={cam}
          opacity={prog(frame, T.clickResume - 30, 8) * (1 - prog(frame, T.clickResume + 12, 10))}
          path={[
            { f: T.clickResume - 30, x: resumeBtn.x - 160, y: resumeBtn.y - 200 },
            { f: T.clickResume - 3, x: resumeBtn.x, y: resumeBtn.y },
          ]}
          clicks={[T.clickResume]}
        />
      </UIShot>
      <Grain />
    </AbsoluteFill>
  );
};
