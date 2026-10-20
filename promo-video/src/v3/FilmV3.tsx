import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { plan } from './lib';
import { Brand } from './scenes/Brand';
import { DoubtScene, FinishScene } from './scenes/Doubt';
import { Hero } from './scenes/Hero';
import { Hook } from './scenes/Hook';
import { Montage } from './scenes/Montage';

const S = plan.scenes;

/**
 * TutorBoard — "See how it works" (v3, 60 s).
 * Hook → real ask/send/lesson → controls + Bubble Sort → contextual doubt →
 * resume → five-subject montage → every lesson → brand.
 */
export const FilmV3: React.FC<{ voiceover?: boolean }> = ({ voiceover = true }) => (
  <AbsoluteFill style={{ backgroundColor: '#050505' }}>
    {/* the hero is mounted early so the hook can split open onto it */}
    <Sequence from={S.hero[0] - plan.hero.lead} durationInFrames={S.hero[1] - S.hero[0] + plan.hero.lead} name="2 · Ask → lesson">
      <Hero />
    </Sequence>
    <Sequence from={S.hook[0]} durationInFrames={S.hook[1] - S.hook[0]} name="1 · Hook">
      <Hook />
    </Sequence>
    <Sequence from={S.doubt[0]} durationInFrames={S.doubt[1] - S.doubt[0]} name="3 · Doubt">
      <DoubtScene />
    </Sequence>
    <Sequence from={S.finish[0]} durationInFrames={S.finish[1] - S.finish[0] + plan.montage.subjects[0].start} name="4 · Resume">
      <FinishScene />
    </Sequence>
    <Sequence from={S.montage[0]} durationInFrames={S.montage[1] - S.montage[0]} name="5 · Any subject">
      <Montage />
    </Sequence>
    <Sequence from={S.brand[0]} durationInFrames={S.brand[1] - S.brand[0]} name="6 · Brand">
      <Brand />
    </Sequence>
    <Audio src={staticFile(voiceover ? 'audio/score_v3_vo.wav' : 'audio/score_v3.wav')} />
  </AbsoluteFill>
);
