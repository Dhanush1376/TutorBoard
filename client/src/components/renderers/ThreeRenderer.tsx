import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Text, MeshDistortMaterial, MeshWobbleMaterial, Environment, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const SubjectVisuals = ({ type, stepIndex }: { type: string; stepIndex: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
      meshRef.current.rotation.x += 0.002;
    }
  });

  const visuals = useMemo(() => {
    switch (type.toLowerCase()) {
      case 'astronomy':
      case 'space':
      case 'orbits':
        return (
          <group>
            <mesh ref={meshRef}>
              <sphereGeometry args={[1.5, 64, 64]} />
              <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.5} roughness={0.1} metalness={0.8} />
            </mesh>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
              <mesh position={[4, 1, 0]}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="#94a3b8" />
              </mesh>
            </Float>
          </group>
        );
      case 'molecular':
      case 'biology':
      case 'chemistry':
        return (
          <group ref={meshRef as any}>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.8, 32, 32]} />
              <MeshDistortMaterial color="#ef4444" speed={2} distort={0.3} radius={1} />
            </mesh>
            {[0, 1, 2, 3].map((i) => (
              <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
                <mesh position={[1.5, 0, 0]}>
                  <sphereGeometry args={[0.4, 32, 32]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.1, 0.1, 1.5, 16]} />
                  <meshStandardMaterial color="#94a3b8" />
                </mesh>
              </group>
            ))}
          </group>
        );
      default:
        return (
          <Float speed={5} rotationIntensity={2} floatIntensity={2}>
            <mesh ref={meshRef}>
              <torusKnotGeometry args={[1, 0.3, 128, 32]} />
              <MeshWobbleMaterial color="#8b5cf6" factor={1} speed={2} />
            </mesh>
          </Float>
        );
    }
  }, [type]);

  return visuals;
};

interface ThreeRendererProps {
  timeline: any;
  currentStepIndex: number;
}

export default function ThreeRenderer({ timeline, currentStepIndex }: ThreeRendererProps) {
  const rendererType = (timeline?.renderer || '3d').toLowerCase();
  const subject = timeline?.topic || timeline?.title || 'Advanced';

  return (
    <div className="w-full h-full min-h-[500px] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl relative border border-slate-800">
      <div className="absolute top-6 left-6 z-10">
        <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
          {subject}
        </h2>
        <p className="text-slate-400 text-sm font-medium mt-1">3D Visual Intelligence Layer</p>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Suspense fallback={null}>
          <SubjectVisuals type={rendererType} stepIndex={currentStepIndex} />
          <Environment preset="city" />
          <ContactShadows position={[0, -3.5, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        </Suspense>

        <OrbitControls 
          enablePan={false} 
          minDistance={4} 
          maxDistance={15} 
          autoRotate 
          autoRotateSpeed={0.5}
        />
      </Canvas>

      <div className="absolute bottom-6 right-6 z-10 flex gap-2">
        <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] uppercase tracking-widest text-white/70 font-bold border border-white/10">
          RTX Enabled
        </div>
        <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] uppercase tracking-widest text-white/70 font-bold border border-white/10">
          Step {currentStepIndex + 1}
        </div>
      </div>
    </div>
  );
}
