import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Backdrop';
import { Line } from '../components/Kinetic';
import { easeIn, easeInOut, easeOut, prog, rand } from '../lib/anim';
import { color, fonts } from '../theme';

/**
 * 0–240. "Most answers arrive as words." — a paragraph pours out and turns to
 * noise. "Some need a board." — the dot grid (TutorBoard's canvas) answers.
 */
export const S1Words: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = prog(frame, 0, 40) * (0.35 + 0.65 * prog(frame, 150, 60));

  // The "wall of words": grey text lines that type out, then dissolve.
  const lines = 7;
  const wall = prog(frame, 52, 50, easeOut);
  const wallOut = prog(frame, 112, 26, easeIn);

  // Transition: the grid rushes toward camera into the next scene.
  const rush = prog(frame, 206, 34, easeInOut);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 + rush * 0.9})`, opacity: 1 - rush * 0.6 }}>
        <Backdrop dots={dots} glow={prog(frame, 10, 60)} dotAlpha={0.16 + 0.2 * prog(frame, 140, 50)} />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: 330, width: '100%' }}>
          <Line words={['Most', 'answers', 'arrive', 'as', 'words.']} inAt={18} outAt={118} size={78} />
        </div>

        {/* paragraph of "words" — abstract text bars, never readable */}
        <div
          style={{
            position: 'absolute',
            top: 470,
            width: 900,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            opacity: (1 - wallOut) * 0.9,
            filter: wallOut > 0 ? `blur(${wallOut * 14}px)` : undefined,
            transform: `translateY(${wallOut * 30}px)`,
          }}
        >
          {Array.from({ length: lines }).map((_, i) => {
            const t = Math.max(0, Math.min(1, wall * lines - i));
            const words = i === lines - 1 ? 4 : 9;
            const ws = Array.from({ length: words }).map((__, k) => 0.5 + rand(i * 9 + k));
            const total = ws.reduce((a, b) => a + b, 0);
            const span = (i === lines - 1 ? 0.42 : 1) * (900 - (words - 1) * 10);
            return (
              <div key={i} style={{ display: 'flex', gap: 10, height: 12 }}>
                {ws.map((w, k) => {
                  const wlen = (w / total) * span;
                  const show = (k + 1) / words <= t + 0.0001;
                  return (
                    <div
                      key={k}
                      style={{
                        width: wlen,
                        height: 12,
                        borderRadius: 6,
                        background: color.inkFaint,
                        opacity: show ? 0.5 + rand(k + i) * 0.4 : 0,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ position: 'absolute', top: 470, width: '100%' }}>
          <Line
            words={['Some', 'need', { text: 'a board.', color: color.ink }]}
            inAt={134}
            outAt={204}
            size={96}
            weight={600}
            stagger={6}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 70,
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: '0.3em',
          color: color.inkFaint,
          opacity: prog(frame, 150, 30) * (1 - prog(frame, 200, 20)),
        }}
      >
        TUTORBOARD
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
