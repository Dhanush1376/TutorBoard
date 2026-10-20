import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HERO_SUBJECT_COUNT, HERO_TEXT_OUT, morphAt } from './kit';
import { SHAPES, TAU, build, fill } from './particleShapes';

/*
 * One particle field, eight subjects (the shapes live in particleShapes.js).
 * Only the two shapes being scrolled between are evaluated each frame; the
 * shader blends them per particle.
 */

/* ── Shader ───────────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  attribute vec3 aTo;
  attribute vec3 aScatter;
  attribute float aRnd;
  attribute float aAccent;
  attribute vec3 aGal;
  attribute float aGalKind;
  attribute vec3 aGalColor;
  attribute float aGalSize;
  uniform float uMix;
  uniform float uOpen;
  uniform float uTime;
  uniform float uIntro;
  uniform float uSize;
  uniform float uLight;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vOpen;
  varying float vAlpha;

  // A slowly turning spiral galaxy, inner stars faster than outer ones, seen at an angle.
  vec3 galaxy() {
    if (aGalKind > 1.5) return aGal;
    float a = aGal.y + uTime * 0.12 / (0.4 + aGal.x * 0.35);
    vec3 q = vec3(cos(a) * aGal.x, aGal.z, sin(a) * aGal.x);
    float c = cos(1.1);
    float s = sin(1.1);
    return vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  }

  void main() {
    float e = smoothstep(0.0, 1.0, clamp((uMix - aRnd * 0.3) / 0.7, 0.0, 1.0));
    vec3 p = mix(position, aTo, e) + aScatter * sin(e * 3.14159265) * 0.9;
    float intro = smoothstep(0.0, 1.0, clamp((uIntro - aRnd * 0.4) / 0.6, 0.0, 1.0));
    p = mix(aScatter * 3.6, p, intro);
    float open = smoothstep(0.0, 1.0, clamp(uOpen * 1.4 - aRnd * 0.4, 0.0, 1.0));
    p = mix(p, galaxy(), open);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float galScale = mix(0.75 + aGalSize * 0.3, 0.45 + aGalSize * 0.25, uLight);
    
    // Depth calculations for true 3D visual perception
    // Foreground particles are closer to camera (less negative mv.z), background are further
    float zDist = -mv.z;
    float depthFactor = clamp((6.6 - zDist) / 3.0, -1.0, 1.0); // > 0 is foreground, < 0 is background
    
    // In light mode: foreground particles are bold & punchy; background particles are refined & subdued
    float lightScale = mix(1.0, 0.72 + 0.38 * max(0.0, depthFactor), uLight);
    gl_PointSize = uSize * lightScale * (0.6 + aRnd * 0.8) * mix(1.0, galScale, open) / zDist;
    
    float warm = clamp((aGalColor.r - aGalColor.b) * 2.2, 0.0, 1.0);
    vec3 paperStar = mix(vec3(0.08, 0.08, 0.12), uInk, warm * 0.85);
    vec3 star = mix(aGalColor, paperStar, uLight);
    
    // Colors: In light mode, deep black ink and saturated warm amber
    vec3 lightInk = vec3(0.08, 0.08, 0.07);
    vec3 lightAmber = vec3(0.88, 0.50, 0.03);
    vec3 activeInk = mix(uInk, lightInk, uLight);
    vec3 activeAccent = mix(uAccent, lightAmber, uLight);
    vColor = mix(mix(activeInk, activeAccent, aAccent), star, open);
    vOpen = open;
    
    float twinkle = 0.72 + 0.28 * sin(uTime * (1.5 + aRnd * 4.0) + aRnd * 60.0);
    
    // Opacity: Background particles in light mode have lower opacity (0.28) so the foreground silhouette reads instantly
    float lightAlpha = mix(0.28, 0.95, smoothstep(-0.8, 0.6, depthFactor));
    float darkAlpha = clamp(1.3 - (zDist - 4.5) * 0.25, 0.2, 1.0);
    float depthAlpha = mix(darkAlpha, lightAlpha, uLight);
    
    vAlpha = min(1.0, depthAlpha) * (0.45 + 0.55 * intro) * mix(1.0, 0.9 * twinkle, open);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uLight;
  varying vec3 vColor;
  varying float vOpen;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // Circular particles with crisp antialiased edge
    float edge = mix(smoothstep(0.5, 0.22, d), smoothstep(0.5, 0.35, d), uLight);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
`;

/**
 * Per-frame update, kept outside the component: buffers and uniforms are
 * mutable GPU state. Evaluates only the shapes the blend can currently show.
 */
function advance(geometry, u, data, p, dt, size, reduce, clock) {
  const m = morphAt(p);
  const seg = Math.min(Math.floor(m), SHAPES.length - 2);
  const f = m - seg;
  const t = reduce ? 0 : clock;
  if (f < 1) {
    fill(SHAPES[seg], data.params[seg], t, data.from, data.n);
    geometry.attributes.position.needsUpdate = true;
  }
  if (f > 0) {
    fill(SHAPES[seg + 1], data.params[seg + 1], t, data.to, data.n);
    geometry.attributes.aTo.needsUpdate = true;
  }
  u.uMix.value = f;
  const settle = Math.min(Math.max(p / (HERO_TEXT_OUT * 1.4), 0), 1);
  u.uOpen.value = 1 - settle * settle * (3 - 2 * settle);
  u.uTime.value = t;
  u.uSize.value = size;
  if (!reduce) u.uIntro.value = Math.min(1, u.uIntro.value + dt / 2.2);
}

function readColour(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Values are used as-is in the shader, so keep them in display space.
  return new THREE.Color().setStyle(v || fallback, THREE.LinearSRGBColorSpace);
}

function Field({ progress, pointer, reduce, compact, centre = false, openX = 0, openY = 0.6 }) {
  const group = useRef(null);
  const material = useRef(null);
  const points = useRef(null);
  const n = compact ? 5000 : 9000;
  const data = useMemo(() => build(n), [n]);
  const { gl } = useThree();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.from, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTo', new THREE.BufferAttribute(data.to, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aScatter', new THREE.BufferAttribute(data.scatter, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(data.rnd, 1));
    g.setAttribute('aAccent', new THREE.BufferAttribute(data.accent, 1));
    g.setAttribute('aGal', new THREE.BufferAttribute(data.gal, 3));
    g.setAttribute('aGalKind', new THREE.BufferAttribute(data.galKind, 1));
    g.setAttribute('aGalColor', new THREE.BufferAttribute(data.galColor, 3));
    g.setAttribute('aGalSize', new THREE.BufferAttribute(data.galSize, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    return g;
  }, [data]);

  const uniforms = useMemo(
    () => ({
      uMix: { value: 0 },
      uSize: { value: 24 },
      uIntro: { value: reduce ? 1 : 0 },
      uLight: { value: 0 },
      uOpen: { value: 1 },
      uTime: { value: 0 },
      uInk: { value: new THREE.Color(0.06, 0.06, 0.06) },
      uAccent: { value: new THREE.Color(0.96, 0.62, 0.04) },
    }),
    // uniforms are created once; reduce only seeds the intro
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Follow the site theme: the colours come straight from the CSS tokens.
  useEffect(() => {
    const apply = () => {
      const u = material.current?.uniforms;
      if (!u) return;
      u.uInk.value.copy(readColour('--text-primary', '#0f0f0e'));
      u.uLight.value = document.documentElement.classList.contains('dark') ? 0 : 1;
      u.uAccent.value.copy(readColour('--mk-accent', '#e08a0b'));
    };
    apply();
    const mo = new MutationObserver(() => requestAnimationFrame(apply));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const p = progress.get();
    const dt = Math.min(delta, 0.05);
    if (material.current && points.current) {
      advance(points.current.geometry, material.current.uniforms, data, p, dt, (compact ? 17 : 19) * gl.getPixelRatio(), reduce, state.clock.elapsedTime);
    }
    const g = group.current;
    if (!g) return;
    // Centre stage throughout; it grows a little as the headline parts.
    const settle = Math.min(Math.max(p / (HERO_TEXT_OUT * 1.4), 0), 1);
    const ease = settle * settle * (3 - 2 * settle);
    const tx = compact ? 0 : openX * (1 - ease);
    // Subjects sit a touch below centre, clear of the navigation bar.
    // The galaxy rides high so the opening statement has the lower half to itself.
    const ty = centre ? 0 : compact ? 0.35 * ease : openY * (1 - ease) + 0.05 * ease;
    const spin = reduce ? 0 : state.clock.elapsedTime * 0.08;
    g.position.x += (tx - g.position.x) * Math.min(1, dt * 6);
    g.position.y += (ty - g.position.y) * Math.min(1, dt * 6);
    // Each subject rotates exactly 180° (Math.PI) during its hold window before transitioning to the next
    const segProgress = Math.min(Math.max((p - 0.05) / (0.985 - 0.05), 0), 1) * (HERO_SUBJECT_COUNT - 1);
    const currSeg = Math.floor(segProgress);
    const currFrac = segProgress - currSeg;
    const holdFrac = Math.min(Math.max(currFrac / 0.72, 0), 1);
    // Smooth ease for the 180-degree rotation
    const rotInSeg = (holdFrac * holdFrac * (3 - 2 * holdFrac)) * Math.PI;
    const targetY = (spin + (currSeg * Math.PI + rotInSeg)) * ease + pointer.current.x * 0.35;
    const targetX = pointer.current.y * 0.18;
    // Take the short way round, so a fast scroll back never leaves it spinning to catch up.
    let dy = (targetY - g.rotation.y) % TAU;
    if (dy > Math.PI) dy -= TAU;
    if (dy < -Math.PI) dy += TAU;
    g.rotation.y += dy * Math.min(1, dt * 5);
    g.rotation.x += (targetX - g.rotation.x) * Math.min(1, dt * 4);
    const s = compact ? 0.62 + 0.04 * ease : 0.9 + 0.06 * ease;
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 5));
  });

  return (
    <group ref={group} scale={compact ? 0.62 : 0.9}>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/** `centre` keeps the opening galaxy in the middle of its frame (for panels, not the hero). */
export default function ParticleMorph({ progress, active, reduce, compact, centre = false, openX = 0, openY = 0.6 }) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reduce) return undefined;
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [reduce]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6.6], fov: 38 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
      style={{ pointerEvents: 'none' }}
      fallback={null}
    >
      <Field progress={progress} pointer={pointer} reduce={reduce} compact={compact} centre={centre} openX={openX} openY={openY} />
    </Canvas>
  );
}
