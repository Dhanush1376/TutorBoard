import React from 'react';
import { Line } from './Kinetic';
import { Cam, toScreen } from './UIShot';

type Word = string | { text: string; color?: string; italic?: boolean };

/**
 * Typography placed *on the board*: anchored to a point in the app's empty
 * canvas area and scaled with the camera, so it reads as part of the space
 * rather than a subtitle pasted on top.
 */
export const BoardCaption: React.FC<{
  cam: Cam;
  at: { x: number; y: number };
  words: Word[];
  inAt: number;
  outAt: number;
  size?: number;
  weight?: number;
  dim?: number;
}> = ({ cam, at, words, inAt, outAt, size = 34, weight = 500, dim = 1 }) => {
  const p = toScreen(cam, at);
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y,
        width: 1600,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <Line words={words} inAt={inAt} outAt={outAt} size={size * cam.z} weight={weight} dim={dim} />
    </div>
  );
};
