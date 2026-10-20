import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { build, fill } from '../../pages/Marketing/particleShapes';
import { AUTH_SUBJECTS, at, styleOf } from './authSequence';

/*
 * The sign-in panel's particle film: the galaxy opens, then the particles
 * become one subject after another on a loop, and fold back into the galaxy.
 * Each change has its own pace (see authSequence.js): some burst apart and
 * snap into place, some dissolve slowly, some swirl round into the next shape;
 * the camera moves with them.
 */

const SHAPES = AUTH_SUBJECTS.map((s) => s.shape);

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
  uniform float uBurst;
  uniform float uSwirl;
  uniform float uStagger;
  uniform vec3 uInk;
  uniform vec3 uAccent;
  varying vec3 vColor;
  varying float vOpen;
  varying float vAlpha;

  vec3 galaxy() {
    if (aGalKind > 1.5) return aGal;
    float a = aGal.y + uTime * 0.12 / (0.4 + aGal.x * 0.35);
    vec3 q = vec3(cos(a) * aGal.x, aGal.z, sin(a) * aGal.x);
    float c = cos(1.1);
    float s = sin(1.1);
    return vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
  }

  vec3 turnY(vec3 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  }

  void main() {
    // Each particle leaves a little after the one before it (the stagger), so the
    // change ripples through the shape instead of happening all at once.
    float e = smoothstep(0.0, 1.0, clamp((uMix - aRnd * uStagger) / (1.0 - uStagger), 0.0, 1.0));
    float mid = sin(e * 3.14159265);
    vec3 p = mix(position, aTo, e) + aScatter * mid * uBurst;
    p = turnY(p, uSwirl * mid * (0.6 + aRnd));
    float intro = smoothstep(0.0, 1.0, clamp((uIntro - aRnd * 0.4) / 0.6, 0.0, 1.0));
    p = mix(aScatter * 3.6, p, intro);
    float open = smoothstep(0.0, 1.0, clamp(uOpen * 1.4 - aRnd * 0.4, 0.0, 1.0));
    p = mix(p, galaxy(), open);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float galScale = mix(0.75 + aGalSize * 0.3, 0.45 + aGalSize * 0.25, uLight);
    
    // Depth calculations for true 3D visual perception
    float zDist = -mv.z;
    float depthFactor = clamp((6.6 - zDist) / 3.0, -1.0, 1.0);
    
    // In light mode: foreground particles are bold & punchy; background particles are refined & subdued
    float lightScale = mix(1.0, 0.72 + 0.38 * max(0.0, depthFactor), uLight);
    gl_PointSize = uSize * lightScale * (0.6 + aRnd * 0.8) * (1.0 + mid * min(uBurst, 1.5) * 0.25) * mix(1.0, galScale, open) / zDist;
    
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
    
    // Opacity: Background particles in light mode have lower opacity (0.28) so foreground silhouette reads cleanly
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
    float edge = mix(smoothstep(0.5, 0.22, d), smoothstep(0.5, 0.35, d), uLight);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
`;

function readColour(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color().setStyle(v || fallback, THREE.LinearSRGBColorSpace);
}

/**
 * One frame of the film, kept outside the component: buffers, uniforms and the
 * camera are mutable GPU-side state, and `film` carries the loop's position.
 */
function advance(film, state, delta, { u, g, geometry, data, reduce, pointer, onSubject, pixelRatio }) {
  const dt = Math.min(delta, 0.05);
  // With reduced motion the film holds on the galaxy.
  if (!reduce) film.clock += dt;
  const now = at(film.clock);
  const t = reduce ? 0 : state.clock.elapsedTime;

  // Only the two shapes on screen are worked out each frame.
  if (now.from >= 0) {
    fill(SHAPES[now.from], data.params[now.from], t, data.from, data.n);
    geometry.attributes.position.needsUpdate = true;
  }
  if (now.to >= 0 && now.to !== now.from) {
    fill(SHAPES[now.to], data.params[now.to], t, data.to, data.n);
    geometry.attributes.aTo.needsUpdate = true;
  }

  const style = styleOf(now.style);
  u.uMix.value = now.mix;
  u.uOpen.value = now.open;
  u.uBurst.value = style.burst;
  u.uSwirl.value = style.swirl;
  u.uStagger.value = style.stagger;
  u.uTime.value = t;
  u.uSize.value = 19 * pixelRatio;
  if (!reduce) u.uIntro.value = Math.min(1, u.uIntro.value + dt / 2.2);

  if (now.subject !== film.subject) {
    film.subject = now.subject;
    onSubject?.(now.subject);
  }

  // Camera work: stable, clear perspective with gentle natural breathing sway
  const inFlight = now.kind === 'morph' ? Math.sin(now.mix * Math.PI) : 0;
  const shapeWeight = 1 - now.open;
  const targetY = 0.08 * Math.sin(state.clock.elapsedTime * 0.25) * shapeWeight + pointer.current.x * 0.15;
  const targetX = 0.04 * Math.sin(state.clock.elapsedTime * 0.18) * shapeWeight + pointer.current.y * 0.1;
  g.rotation.y += (targetY - g.rotation.y) * Math.min(1, dt * 3);
  g.rotation.x += (targetX - g.rotation.x) * Math.min(1, dt * 3);
  const push = now.kind === 'hold' ? now.progress * 0.03 : 0;
  const pull = inFlight * (style.pull || 0.02);
  const s = (0.88 + push - pull) * (1 - 0.04 * now.open) + 0.16 * now.open;
  g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 3.5));
  // Keep shapes perfectly centered in showcase viewport without edge clipping
  const tx = 0.16 * shapeWeight;
  const ty = 0.14 * shapeWeight;
  g.position.x += (tx - g.position.x) * Math.min(1, dt * 3);
  g.position.y += (ty - g.position.y) * Math.min(1, dt * 3);
}

function Field({ reduce, onSubject, pointer }) {
  const group = useRef(null);
  const material = useRef(null);
  const n = 9000;
  const data = useMemo(() => build(n, SHAPES), []);
  const { gl } = useThree();
  // Where the loop is, how far the camera has turned, which subject was last named.
  const film = useMemo(() => ({ clock: 0, spin: 0, subject: null }), []);

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
      uOpen: { value: 1 },
      uTime: { value: 0 },
      uIntro: { value: reduce ? 1 : 0 },
      uSize: { value: 19 },
      uLight: { value: 0 },
      uBurst: { value: 0.9 },
      uSwirl: { value: 0 },
      uStagger: { value: 0.3 },
      uInk: { value: new THREE.Color(0.06, 0.06, 0.06) },
      uAccent: { value: new THREE.Color(0.96, 0.62, 0.04) },
    }),
    // uniforms are created once; reduce only seeds the intro
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Colours follow the site theme, straight from the CSS tokens.
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
    if (material.current && group.current) {
      advance(film, state, delta, { u: material.current.uniforms, g: group.current, geometry, data, reduce, pointer, onSubject, pixelRatio: gl.getPixelRatio() });
    }
  });

  return (
    <group ref={group} scale={0.9}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} transparent depthWrite={false} />
      </points>
    </group>
  );
}

/** The looping subject film. `onSubject(index)` fires as each subject arrives (-1 = the galaxy). */
export default function AuthMorph({ active = true, reduce = false, onSubject }) {
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
      camera={{ position: [0, 0, 7.0], fov: 37 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
      style={{ pointerEvents: 'none' }}
      fallback={null}
    >
      <Field reduce={reduce} onSubject={onSubject} pointer={pointer} />
    </Canvas>
  );
}

