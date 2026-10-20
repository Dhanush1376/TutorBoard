import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { timeline } from './lib/capture';
import { FPS, HEIGHT, WIDTH } from './theme';
import { FilmV3 } from './v3/FilmV3';
import { plan } from './v3/lib';
import { UITest } from './v3/UITest';

export const Root: React.FC = () => (
  <>
    {/* v3 — 60 s cut with voiceover / music-only */}
    <Composition id="TutorBoardFilm" component={FilmV3} durationInFrames={plan.totalFrames} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ voiceover: true }} />
    <Composition id="TutorBoardFilmNoVO" component={FilmV3} durationInFrames={plan.totalFrames} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ voiceover: false }} />
    {/* v2 — 104 s capture-only cut */}
    <Composition id="TutorBoardLaunch" component={Film} durationInFrames={timeline.totalFrames} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="V3UITest" component={UITest} durationInFrames={200} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ variant: 'step1' }} />
  </>
);
