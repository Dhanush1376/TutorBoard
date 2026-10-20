import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop, Grain } from '../../components/Backdrop';
import { easeIn, easeOut, lerp, prog } from '../../lib/anim';
import { fonts } from '../../theme';
import { caretOn, plan } from '../lib';
import { Icon } from '../ui/Icons';

const B = plan.brand;

// TutorBoard's mark, exactly as client/src/components/layout/VisaiLogo.jsx draws it:
// viewBox 240 60 200 260, currentColor faces at the app's own opacities.
const FACES = [
  { pts: '340,90 427,140 340,190 253,140', a: 0.1, at: 0 },
  { pts: '253,140 340,190 340,290 253,240', a: 0.3, at: 4 },
  { pts: '340,190 427,140 427,240 340,290', a: 0.5, at: 8 },
  { pts: '340,158 376,179 340,200 304,179', a: 0.2, at: 16 },
  { pts: '304,179 340,200 340,242 304,221', a: 0.4, at: 19 },
  { pts: '340,200 376,179 376,221 340,242', a: 0.8, at: 22 },
];

/**
 * 1530–1800. The mark resolves face by face — monochrome, undistorted — then
 * the wordmark lands on the voice, the line, and the composer as the call to action.
 */
export const Brand: React.FC = () => {
  const f = useCurrentFrame();
  const out = prog(f, B.fadeOut[0], B.fadeOut[1] - B.fadeOut[0], easeIn);
  const size = 156;
  const settle = prog(f, 0, 40, easeOut);
  const word = prog(f, B.wordmark, 18, easeOut);
  const a = prog(f, B.taglineA, 16, easeOut);
  const b = prog(f, B.taglineB, 16, easeOut);
  const cta = prog(f, B.cta, 18, easeOut);
  // the whole lockup rises a little as the lines arrive
  const lift = lerp(60, 0, prog(f, B.wordmark - 4, 40, easeOut)) + lerp(0, -40, prog(f, B.cta - 6, 26, easeOut));
  // a slow push for the whole end card, so the hold never sits dead still
  const push = 1 + 0.045 * prog(f, 0, B.fadeOut[1], (x) => x);
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      <Backdrop dots={0.35} glow={0.6 * settle} />
      <AbsoluteFill style={{ opacity: 1 - out, transform: `translateY(${lift}px) scale(${push})` }}>
        {/* the mark */}
        <div style={{ position: 'absolute', left: 960 - size / 2, top: 300 - size * 0.65, width: size, height: size * 1.3 }}>
          <div
            style={{
              position: 'absolute', left: -size * 0.9, top: -size * 0.7, width: size * 2.8, height: size * 2.7, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(244,243,238,0.07) 0%, rgba(244,243,238,0) 62%)', opacity: settle,
            }}
          />
          <svg width={size} height={size * 1.3} viewBox="240 60 200 260" style={{ position: 'relative', overflow: 'visible' }}>
            {FACES.map((face, i) => {
              const t = prog(f, face.at, 18, easeOut);
              return (
                <polygon
                  key={i}
                  points={face.pts}
                  fill="#F4F3EE"
                  fillOpacity={face.a * t}
                  transform={`translate(0 ${(1 - t) * (i < 3 ? 10 : 14)})`}
                />
              );
            })}
          </svg>
        </div>
        {/* wordmark — the sidebar's tracked caps, larger */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 452, textAlign: 'center', fontFamily: fonts.sans, fontSize: 62, fontWeight: 500,
            color: '#F4F3EE', letterSpacing: `${lerp(0.5, 0.3, word)}em`, paddingLeft: '0.3em', opacity: word,
            filter: word < 0.98 ? `blur(${(1 - word) * 10}px)` : undefined,
          }}
        >
          TUTORBOARD
        </div>
        {/* the line */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 572, textAlign: 'center', fontFamily: fonts.sans, fontSize: 40, letterSpacing: '-0.025em', lineHeight: 1.3 }}>
          <div style={{ color: 'rgba(244,243,238,0.55)', fontWeight: 400, opacity: a, transform: `translateY(${(1 - a) * 14}px)`, filter: a < 0.98 ? `blur(${(1 - a) * 8}px)` : undefined }}>
            Don't just get the answer.
          </div>
          <div style={{ color: '#F4F3EE', fontWeight: 600, opacity: b, transform: `translateY(${(1 - b) * 14}px)`, filter: b < 0.98 ? `blur(${(1 - b) * 8}px)` : undefined }}>
            See how it works.
          </div>
        </div>
        {/* call to action: the composer itself */}
        <div
          style={{
            position: 'absolute', left: 960 - 250, top: 760, width: 500, height: 60, borderRadius: 30, boxSizing: 'border-box',
            background: '#0A0A0A', border: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', padding: '0 8px 0 26px',
            opacity: cta, transform: `translateY(${(1 - cta) * 16}px) scale(${lerp(0.97, 1, cta)})`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(244,243,238,0.04)', fontFamily: fonts.sans,
          }}
        >
          <span style={{ display: 'inline-block', width: 2, height: 22, background: '#F4F3EE', opacity: caretOn(f) ? 1 : 0, marginRight: 4 }} />
          <span style={{ flex: 1, fontSize: 19, color: '#6E6D69' }}>Ask anything...</span>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#F4F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrowUp" size={20} color="#111" stroke={2.3} />
          </div>
        </div>
      </AbsoluteFill>
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};
