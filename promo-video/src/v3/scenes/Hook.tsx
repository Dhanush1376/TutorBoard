import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { DotGrid, Grain } from '../../components/Backdrop';
import { easeIn, easeInOut, easeOut, lerp, prog } from '../../lib/anim';
import { fonts } from '../../theme';
import { plan } from '../lib';

const H = plan.hook;
type W = { w: string; f: number };

/** A word that slams in on its spoken frame: overshoot scale, motion blur, instant opacity. */
const Slam: React.FC<{ w: W; size: number; weight?: number; color?: string; frame: number; strength?: number }> = ({
  w, size, weight = 650, color = '#F4F3EE', frame, strength = 1,
}) => {
  const t = prog(frame, w.f, 7, easeOut);
  const on = frame >= w.f - 1;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: size,
        fontWeight: weight,
        color,
        opacity: on ? Math.min(1, (frame - w.f + 2) / 2) : 0,
        transform: `scale(${lerp(1 + 0.42 * strength, 1, t)}) translateY(${(1 - t) * size * 0.06}px)`,
        filter: t < 0.98 ? `blur(${(1 - t) * 14 * strength}px)` : undefined,
        transformOrigin: '50% 60%',
      }}
    >
      {w.w}
    </span>
  );
};

/**
 * 0–150. Black. "What if AI didn't just answer your questions?" slams in word by
 * word on the voice; "What if it could SHOW you the answer?" — SHOW hits like a
 * door slamming, and the frame splits open on the product.
 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // ── impact on SHOW: shake, flash, aberration ──
  const dt = frame - H.show;
  const shakeAmp = dt >= 0 && dt < 14 ? (1 - dt / 14) ** 2 * 14 : 0;
  const shakeX = shakeAmp * Math.sin(dt * 2.9);
  const shakeY = shakeAmp * Math.cos(dt * 3.7) * 0.7;
  const flash = dt >= 0 ? Math.max(0, 1 - dt / 6) ** 1.5 * 0.42 : 0;
  const aberr = dt >= 0 ? Math.max(0, 1 - dt / 10) * 16 : 0;

  // ── line 1 leaves by flying past the camera ──
  const out1 = prog(frame, H.line1Out, 9, easeIn);
  // ── the split: the whole plate opens horizontally on the product ──
  const split = prog(frame, H.split[0], H.split[1] - H.split[0] - 6, easeIn);
  const seam = prog(frame, H.split[0] - 4, 6, easeOut) * (1 - prog(frame, H.split[0] + 8, 10));
  // slow push on everything — the hook never sits still
  const push = 1 + frame * 0.0009;

  const showSize = 300;
  const showT = prog(frame, H.show, 6, easeOut);
  const tailOut = prog(frame, H.split[0] - 2, 8, easeIn);
  // light sweep across SHOW after the hit
  const sweep = prog(frame, H.show + 4, 22, easeInOut);

  const plate = (
    <AbsoluteFill style={{ background: '#050505', overflow: 'hidden' }}>
      <DotGrid alpha={0.1 + (dt >= 0 ? Math.max(0, 1 - dt / 16) * 0.35 : 0)} drift={0.3} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)' }} />
      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px) scale(${push})`, fontFamily: fonts.sans }}>
        {/* line 1 */}
        {frame < H.line1Out + 10 && (
          <AbsoluteFill
            style={{
              justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 6,
              opacity: 1 - out1, transform: `scale(${1 + out1 * 0.35})`, filter: out1 > 0.01 ? `blur(${out1 * 18}px)` : undefined,
              letterSpacing: '-0.045em', lineHeight: 1.04,
            }}
          >
            <div style={{ display: 'flex', gap: 30 }}>
              {H.line1.slice(0, 5).map((w: W) => <Slam key={w.f + w.w} w={w} size={112} frame={frame} />)}
            </div>
            <div style={{ display: 'flex', gap: 30 }}>
              {H.line1.slice(5).map((w: W, i: number) => (
                <Slam key={w.f + w.w} w={w} size={112} frame={frame} color={i === 2 ? '#F4F3EE' : '#F4F3EE'} strength={i === 2 ? 1.3 : 1} />
              ))}
            </div>
          </AbsoluteFill>
        )}

        {/* line 2 + SHOW + tail */}
        {frame >= H.line2[0].f - 2 && (
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', letterSpacing: '-0.04em' }}>
            <div style={{ display: 'flex', gap: 18, marginBottom: 18, opacity: 1 - tailOut }}>
              {H.line2.map((w: W) => <Slam key={w.f + w.w} w={w} size={66} weight={500} color="rgba(244,243,238,0.72)" frame={frame} strength={0.7} />)}
            </div>
            <div style={{ position: 'relative', height: showSize * 0.86, display: 'flex', alignItems: 'center' }}>
              {frame >= H.show - 1 && (
                <>
                  {/* chromatic split on impact */}
                  {aberr > 0.5 && (
                    <>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: showSize, fontWeight: 700, letterSpacing: '-0.06em', color: 'rgba(255,60,60,0.55)', transform: `translateX(${-aberr}px) scale(${lerp(1.9, 1, showT)})`, mixBlendMode: 'screen' }}>SHOW</div>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: showSize, fontWeight: 700, letterSpacing: '-0.06em', color: 'rgba(60,140,255,0.55)', transform: `translateX(${aberr}px) scale(${lerp(1.9, 1, showT)})`, mixBlendMode: 'screen' }}>SHOW</div>
                    </>
                  )}
                  <div
                    style={{
                      position: 'relative', fontSize: showSize, fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 1,
                      transform: `scale(${lerp(1.9, 1, showT)})`, filter: showT < 0.97 ? `blur(${(1 - showT) * 10}px)` : undefined,
                      backgroundImage: `linear-gradient(100deg, #F4F3EE 0%, #F4F3EE ${sweep * 120 - 20}%, #FFFFFF ${sweep * 120 - 8}%, #F4F3EE ${sweep * 120 + 4}%, #D9D7D0 100%)`,
                      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                      textShadow: '0 0 60px rgba(244,243,238,0.18)',
                    }}
                  >
                    SHOW
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 4, opacity: 1 - tailOut }}>
              {H.tail.map((w: W) => <Slam key={w.f + w.w} w={w} size={66} weight={500} color="rgba(244,243,238,0.72)" frame={frame} strength={0.7} />)}
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
      {/* shockwave */}
      {dt >= 0 && dt < 22 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              width: 200, height: 200, borderRadius: '50%',
              border: `${3 * (1 - dt / 22)}px solid rgba(244,243,238,${0.45 * (1 - dt / 22)})`,
              transform: `scale(${1 + (dt / 22) ** 0.6 * 9})`,
            }}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 52%, #FFFFFF 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 100%)', opacity: flash, mixBlendMode: 'screen' }} />
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );

  if (split <= 0) return plate;

  // Split open: top half up, bottom half down; the product is underneath.
  const gap = split * 620;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: 'inset(0 0 50% 0)', transform: `translateY(${-gap}px)` }}>{plate}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: 'inset(50% 0 0 0)', transform: `translateY(${gap}px)` }}>{plate}</AbsoluteFill>
      {/* the seam of light */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 540 - 1 - gap * 0.02, height: 2 + gap * 0.04,
          background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${0.9 * seam}) 50%, rgba(255,255,255,0) 100%)`,
          boxShadow: `0 0 ${40 * seam}px rgba(255,255,255,${0.6 * seam})`,
        }}
      />
    </AbsoluteFill>
  );
};
