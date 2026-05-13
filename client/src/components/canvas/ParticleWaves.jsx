import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '../../context/useTheme';

const ParticleWave = ({ count = 15000, color = "#8a887b" }) => {
  const points = useRef();

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const rows = 120;
    const cols = count / rows;
    
    for (let i = 0; i < count; i++) {
      const x = (i % cols) - cols / 2;
      const z = Math.floor(i / cols) - rows / 2;
      // FO-03: Denser spacing for 'infinite' feel
      positions[i * 3] = x * 0.25;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = z * 0.25;
    }
    return positions;
  }, [count]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const pos = points.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];
      
      // Multi-frequency wave for more natural motion
      const y = Math.sin(x * 0.2 + time * 0.4) * 0.6 + 
                Math.cos(z * 0.2 + time * 0.4) * 0.6 +
                Math.sin((x + z) * 0.1 + time * 0.2) * 0.3;
      pos[i * 3 + 1] = y;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.rotation.y = time * 0.01;
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
        size={0.05}
        color={color}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const ParticleWaves = ({ opacity = 0.6 }) => {
  const { mode, currentTheme } = useTheme();
  
  // Get theme colors for fog and particles
  const isDark = mode === 'dark';
  const tokens = currentTheme?.colors?.[mode] || {};
  const bgColor = tokens.bg || (isDark ? '#000000' : '#ffffff');
  
  // Adaptive particle color: more visible in light mode
  const particleColor = isDark ? "#8a887b" : "#4a483b";

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
        camera={{ position: [0, 8, 16], fov: 45 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <fog attach="fog" args={[bgColor, 8, 25]} />
        <Suspense fallback={null}>
          <ParticleWave color={particleColor} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ParticleWaves;
