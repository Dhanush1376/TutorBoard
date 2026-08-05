import React, { Suspense } from 'react';

/**
 * ParticleWavesLazy — deferred loader for the ambient particle background.
 *
 * ParticleWaves pulls in three.js + @react-three/fiber (~224KB gzipped). It is a
 * purely decorative background, so importing it eagerly put the entire 3D stack
 * on the /session critical path. Loading it lazily keeps that weight off the
 * initial page load; the background simply fades in a moment later.
 *
 * Drop-in replacement: import this instead of ./ParticleWaves — same props.
 */
const ParticleWaves = React.lazy(() => import('./ParticleWaves'));

export default function ParticleWavesLazy(props) {
  return (
    <Suspense fallback={null}>
      <ParticleWaves {...props} />
    </Suspense>
  );
}
