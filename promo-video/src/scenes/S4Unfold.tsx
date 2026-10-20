import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../components/Backdrop';
import { BoardCaption } from '../components/BoardCaption';
import { Cursor } from '../components/Cursor';
import { Cam, lerpCam, UIShot } from '../components/UIShot';
import { easeInOut, prog } from '../lib/anim';
import { board, boardAndPanel, boardCenterX, cellsRow, FULL, unfoldEnd } from '../lib/cams';
import { centerOf, rect, shotFrame, timeline } from '../lib/capture';
import { color } from '../theme';

const T = timeline.unfold;

/**
 * 800–1360. The real lesson: the student presses play and the board walks
 * through Bubble Sort pass by pass. Real playback, sped up only while the app
 * holds a step for reading; every transition plays at 1x.
 */
export const S4Unfold: React.FC = () => {
  const frame = useCurrentFrame();
  const changes: number[] = T.stepChanges ?? [];
  const map: number[] = T.playMap;

  // ── footage ──
  let src: string;
  if (frame < T.revealTail[1]) src = shotFrame('reveal', 40 + frame);
  else if (frame < T.clickPlay) src = shotFrame('play', Math.min(7, frame - T.revealTail[1]));
  else if (frame < T.playStart) src = shotFrame('play', 8);
  else src = shotFrame('play', map[Math.min(map.length - 1, frame - T.playStart)]);

  // ── camera ──
  const s2 = changes[1] ?? 380;
  const wide: Cam = { ...FULL, z: 1.04 };
  let cam: Cam = lerpCam(FULL, wide, prog(frame, 0, T.clickPlay));
  if (frame >= T.clickPlay) cam = lerpCam(wide, board, prog(frame, T.clickPlay + 6, 54, easeInOut));
  if (frame >= s2 - 10) cam = lerpCam(board, boardAndPanel, prog(frame, s2 - 10, 46, easeInOut));
  if (frame >= 512) cam = lerpCam(boardAndPanel, unfoldEnd, prog(frame, 512, 48, easeInOut));
  // a small push on each step change gives the transition weight
  const bump = changes.reduce((acc, c) => acc + Math.sin(Math.PI * prog(frame, c, 26)) * 0.035, 0);
  cam = { ...cam, z: cam.z * (1 + bump) };

  const play = centerOf(rect('playBtn', { x: 790, y: 1000, w: 36, h: 36 }));
  const caption = { x: boardCenterX, y: cellsRow.y + cellsRow.h + 230 };
  const c1 = changes[0] ?? 200;

  return (
    <AbsoluteFill>
      <Backdrop dots={0.6} />
      <UIShot src={src} cam={cam}>
        <BoardCaption
          cam={cam}
          at={caption}
          words={['Not', 'a', 'paragraph', 'about', 'Bubble', 'Sort.']}
          inAt={T.playStart + 26}
          outAt={c1 - 6}
          dim={0.62}
        />
        <BoardCaption
          cam={cam}
          at={caption}
          words={['Bubble', 'Sort,', { text: 'on the board.', color: color.ink }]}
          inAt={c1 + 22}
          outAt={s2 - 14}
          weight={600}
        />
        <Cursor
          cam={cam}
          opacity={prog(frame, 40, 10) * (1 - prog(frame, T.clickPlay + 10, 10))}
          path={[
            { f: 40, x: play.x + 160, y: play.y - 140 },
            { f: T.clickPlay - 4, x: play.x, y: play.y },
          ]}
          clicks={[T.clickPlay]}
        />
      </UIShot>
      <Grain />
    </AbsoluteFill>
  );
};
