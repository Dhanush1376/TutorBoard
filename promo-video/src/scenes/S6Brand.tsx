import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../components/Backdrop';
import { CellTile } from '../components/Cells';
import { Line } from '../components/Kinetic';
import { CubeLogo } from '../components/Logo';
import { easeIn, easeInOut, easeOut, lerp, prog } from '../lib/anim';
import { timeline } from '../lib/capture';
import { color, fonts } from '../theme';

const T = timeline.brand;

/**
 * Closing. The montage's line carries over ("Whatever you want to
 * understand,"), the sorted array from the opening lesson returns and folds
 * into TutorBoard's cube mark, and the line completes: "See the answer unfold."
 */
export const S6Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const values = [1, 2, 4, 5, 8];
  const appear = (i: number) => prog(frame, 14 + i * 4, 18, easeOut);
  const lift = prog(frame, T.lift, 40, easeInOut);
  const fold = prog(frame, T.cube - 8, 34, easeIn);
  const cubeY = 470;
  const fadeAll = 1 - prog(frame, T.fadeOut[0], T.fadeOut[1] - T.fadeOut[0], easeIn);

  return (
    <AbsoluteFill style={{ opacity: fadeAll }}>
      <Backdrop dots={0.45} glow={1} />

      {/* the line carried over from the montage */}
      <AbsoluteFill style={{ justifyContent: 'center' }}>
        <Line words={['Whatever', 'you', 'want', 'to', 'understand,']} inAt={-100} outAt={46} size={74} weight={500} />
      </AbsoluteFill>

      {/* the sorted array returns and becomes the mark */}
      {values.map((v, i) => {
        const row = { x: 960 + (i - 2) * 132, y: 420 + (1 - appear(i)) * 30 };
        const x = lerp(row.x, 960, fold);
        const y = lerp(lerp(row.y, 400, lift), cubeY, fold);
        return (
          <CellTile
            key={i}
            x={x}
            y={y}
            size={104 * lerp(1, 0.3, fold)}
            value={v}
            opacity={appear(i) * prog(frame, 40, 10) * (1 - prog(frame, T.cube + 10, 14))}
            glow={lift * (1 - fold) * 0.25}
          />
        );
      })}

      <AbsoluteFill style={{ alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: cubeY - 150 }}>
          <CubeLogo at={T.cube} size={230} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 660,
            fontFamily: fonts.sans,
            fontSize: 42,
            fontWeight: 600,
            letterSpacing: `${lerp(0.62, 0.42, prog(frame, T.wordmark, 50, easeOut))}em`,
            paddingLeft: '0.42em',
            color: color.ink,
            opacity: prog(frame, T.wordmark, 26),
          }}
        >
          TUTORBOARD
        </div>
        <div style={{ position: 'absolute', top: 750, width: '100%' }}>
          <Line
            words={['See', 'the', 'answer', { text: 'unfold.', color: color.amber }]}
            inAt={T.tagline}
            size={50}
            weight={500}
            stagger={5}
          />
        </div>
        <div style={{ position: 'absolute', top: 852, width: '100%' }}>
          <Line words={['Ask', 'your', 'first', 'question.']} inAt={T.cta} size={24} weight={400} stagger={3} dim={0.62} tracking={0} />
        </div>
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};
