import { loadFont as loadGeist } from '@remotion/google-fonts/Geist';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

// TutorBoard's own typefaces (client/src/index.css): Geist for UI and display,
// JetBrains Mono for technical microcopy.
const geist = loadGeist('normal', { weights: ['300', '400', '500', '600', '700'], subsets: ['latin'] });
const mono = loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] });

export const fonts = {
  sans: geist.fontFamily,
  mono: mono.fontFamily,
};

// The product is monochrome; amber is the film's single accent and appears
// only where understanding happens (the doubt highlight, the tagline).
export const color = {
  bg: '#070707',
  bgLift: '#0E0E0E',
  ink: '#F2F0EA', // warm off-white, as the app's user bubble
  inkDim: 'rgba(242, 240, 234, 0.56)',
  inkFaint: 'rgba(242, 240, 234, 0.22)',
  line: 'rgba(255, 255, 255, 0.08)',
  amber: '#F5A524',
  amberGlow: 'rgba(245, 165, 36, 0.35)',
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
