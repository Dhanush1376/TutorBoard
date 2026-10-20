import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../components/Backdrop';
import { CellTile } from '../components/Cells';
import { lerpCam, toScreen, UIShot } from '../components/UIShot';
import { easeInOut, easeOut, lerp, prog, rand } from '../lib/anim';
import { askEnd, FULL } from '../lib/cams';
import { cells, shotFrame, timeline } from '../lib/capture';
import { color, fonts } from '../theme';

const T = timeline.think;

// Verbatim progress messages the server emits while it builds a lesson
// (server/engine/core/pedagogyEngine.js → teaching:progress).
const STAGES = [
  'Running autonomous visual planning loop…',
  'Finalizing scene graph pipeline…',
  'Choreographing cinematic experience…',
];

// Where the digits sit inside the user's message bubble (app CSS px).
const DIGITS = [
  { v: '5', x: 304, y: 170 },
  { v: '1', x: 99, y: 192 },
  { v: '4', x: 115, y: 192 },
  { v: '2', x: 131, y: 192 },
  { v: '8', x: 147, y: 192 },
];

/**
 * 560–800. The question is sent. While the real app shows "Thinking", the
 * pipeline's own stage messages run, and the five numbers lift out of the
 * question to land exactly where the lesson's cells will appear.
 */
export const S3Think: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = lerpCam(askEnd, FULL, prog(frame, T.pullBack[0], T.pullBack[1] - T.pullBack[0], easeInOut));
  const reveal = frame >= T.revealStart;
  const src = reveal ? shotFrame('reveal', frame - T.revealStart) : shotFrame('send', 0);
  const dim = reveal ? lerp(0.42, 1, prog(frame, T.revealStart, 22)) : lerp(1, 0.42, prog(frame, 30, 30));

  const targets = cells('cellsStep1');
  const land = prog(frame, T.numbersLand[0], T.numbersLand[1] - T.numbersLand[0], easeInOut);
  const tilesOut = prog(frame, T.revealStart + 6, 16);

  return (
    <AbsoluteFill>
      <Backdrop dots={0.6} />
      <UIShot src={src} cam={cam} brightness={dim} blur={reveal ? 0 : prog(frame, 30, 30) * 1.5} />

      {/* stage messages */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 118, opacity: 1 - prog(frame, T.numbersLand[0], 20) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 760 }}>
          {STAGES.map((s, i) => {
            const at = T.stages[i];
            const t = prog(frame, at, 10);
            const chars = Math.floor(Math.max(0, frame - at) * 1.6);
            const done = i < STAGES.length - 1 ? frame > T.stages[i + 1] : frame > T.numbersLand[0] - 10;
            return (
              <div
                key={s}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontFamily: fonts.mono,
                  fontSize: 22,
                  color: done ? color.inkDim : color.ink,
                  opacity: t,
                  transform: `translateY(${(1 - t) * 10}px)`,
                }}
              >
                <span style={{ width: 22, color: done ? color.inkDim : color.amber, textAlign: 'center' }}>
                  {done ? '✓' : ['◜', '◝', '◞', '◟'][Math.floor(frame / 4) % 4]}
                </span>
                <span>{s.slice(0, chars)}</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* numbers lift out of the question and land as cells */}
      {DIGITS.map((d, i) => {
        const start = toScreen(cam, d);
        const rise = prog(frame, T.numbersRise + i * 4, 40, easeOut);
        const hover = { x: 960 + (i - 2) * 132, y: 470 + Math.sin((frame + i * 9) / 14) * 6 };
        const target = targets[i]
          ? toScreen(cam, { x: targets[i].x + targets[i].w / 2, y: targets[i].y + targets[i].h / 2 })
          : { x: 960 + (i - 2) * 115, y: 400 };
        const size = targets[i] ? targets[i].w * cam.z : 98;
        const mid = { x: lerp(start.x, hover.x, rise), y: lerp(start.y, hover.y, rise) - Math.sin(rise * Math.PI) * 80 };
        const x = lerp(mid.x, target.x, land);
        const y = lerp(mid.y, target.y, land);
        const glyph = lerp(0.6, 1.9, rise) * lerp(1, 0.46, land); // text grows on lift, settles in cell
        return (
          <CellTile
            key={i}
            x={x}
            y={y}
            size={size}
            value={d.v}
            frameOpacity={prog(frame, T.numbersLand[0] + 6 + i * 3, 16)}
            textScale={glyph * (1 + rand(i) * 0.02)}
            opacity={prog(frame, T.numbersRise + i * 4, 6) * (1 - tilesOut)}
            glow={rise * (1 - land) * 0.3}
          />
        );
      })}
      <Grain />
    </AbsoluteFill>
  );
};
