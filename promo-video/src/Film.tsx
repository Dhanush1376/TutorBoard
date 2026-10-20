import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { timeline } from './lib/capture';
import { S1Words } from './scenes/S1Words';
import { S2Ask } from './scenes/S2Ask';
import { S3Think } from './scenes/S3Think';
import { S4Unfold } from './scenes/S4Unfold';
import { S5Doubt } from './scenes/S5Doubt';
import { S6Brand } from './scenes/S6Brand';
import { S6Range } from './scenes/S6Range';
import { color } from './theme';

const S = timeline.scenes as Record<string, [number, number]>;
const scene = (key: string) => ({ from: S[key][0], durationInFrames: S[key][1] - S[key][0] });

export const Film: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: color.bg }}>
    <Sequence {...scene('words')} name="1 · Words"><S1Words /></Sequence>
    <Sequence {...scene('ask')} name="2 · Ask"><S2Ask /></Sequence>
    <Sequence {...scene('think')} name="3 · Think"><S3Think /></Sequence>
    <Sequence {...scene('unfold')} name="4 · Unfold"><S4Unfold /></Sequence>
    <Sequence {...scene('doubt')} name="5 · Doubt"><S5Doubt /></Sequence>
    {S.range && <Sequence {...scene('range')} name="6 · Any subject"><S6Range /></Sequence>}
    <Sequence {...scene('brand')} name="7 · Brand"><S6Brand /></Sequence>
    <Audio src={staticFile('audio/score.wav')} />
  </AbsoluteFill>
);
