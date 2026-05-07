import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ParticleWave = ({ count = 5000 }) => {
  const points = useRef();

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const rows = 100;
    const cols = count / rows;
    
    for (let i = 0; i < count; i++) {
      const x = (i % cols) - cols / 2;
      const z = Math.floor(i / cols) - rows / 2;
      positions[i * 3] = x * 0.4;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z * 0.4;
    }
    return positions;
  }, [count]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const pos = points.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];
      
      const y = Math.sin(x * 0.3 + time * 0.5) * 0.5 + Math.cos(z * 0.3 + time * 0.5) * 0.5;
      pos[i * 3 + 1] = y;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.rotation.y = time * 0.02;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesPosition.length / 3}
          array={particlesPosition}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#8a887b"
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8}
      />
    </points>
  );
};

const ParticleWaves = ({ opacity = 0.6 }) => {
  return (
    <div 
      className="particle-waves-container"
      style={{ 
        position: 'absolute', 
        inset: 0, 
        zIndex: 0, 
        pointerEvents: 'none',
        opacity: opacity,
        width: '100%',
        height: '100%',
      }}
    >
      <Canvas 
        camera={{ position: [0, 6, 12], fov: 50 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <ParticleWave />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ParticleWaves;
