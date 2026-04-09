/**
 * AI Orchestrator v7.0 — Direct Canvas Generation
 * 
 * The AI now outputs EXACT canvas coordinates and shape types.
 * No adapter needed — the AI's output IS the timeline.
 */

import { requestCompletion, getModel } from '../utils/llmClient.js';
import { isGreeting } from '../agents/index.js';
import { UNIFIED_PEDAGOGY_PROMPT } from '../agents/unifiedPrompt.js';
import { safeParse } from '../utils/parser.js';
import sessionStore from './sessionStore.js';
import { cache } from './cache.js';

// ─── Fail-Safe Generator ─────────────────────────────────────────────────────
function generateFailSafeTimeline(topic) {
  return {
    mode: 'explain',
    title: `Understanding ${topic}`,
    domain: 'general',
    difficulty: 'beginner',
    totalSteps: 3,
    objects: [
      { id: 'main', shape: 'circle', x: 400, y: 250, r: 50, color: 'blue', label: topic, appearsAtStep: 0 },
      { id: 'title', shape: 'text', x: 400, y: 350, text: topic, fontSize: 20, color: 'white', appearsAtStep: 0 },
      { id: 'desc', shape: 'badge', x: 400, y: 410, text: 'Core Concept', bgColor: '#4f46e5', textColor: '#fff', appearsAtStep: 1 }
    ],
    steps: [
      { index: 0, title: 'Introduction', narration: `Let us explore ${topic}.`, objectIds: ['main', 'title'], highlightIds: ['main'], newIds: ['main', 'title'], durationMs: 4000 },
      { index: 1, title: 'Core Idea', narration: `This is the fundamental concept behind ${topic}.`, objectIds: ['main', 'title', 'desc'], highlightIds: ['desc'], newIds: ['desc'], durationMs: 4000 },
      { index: 2, title: 'Summary', narration: `You now have a foundational understanding of ${topic}.`, objectIds: ['main', 'title', 'desc'], highlightIds: ['main', 'desc'], newIds: [], durationMs: 4000 }
    ]
  };
}

// ─── Post-Processing: Validate & Fix Object Coordinates ──────────────────────
function postProcessTimeline(data, topic) {
  const timeline = { ...data };

  // Ensure required fields
  timeline.mode = 'explain';
  timeline.title = timeline.title || `Understanding ${topic}`;
  timeline.domain = timeline.domain || 'general';
  timeline.difficulty = timeline.difficulty || 'beginner';
  timeline.totalSteps = (timeline.steps || []).length;

  const objects = timeline.objects || [];

  // ─── STEP 1: Force high-contrast colors for text/labels in dark mode ────
  const BRIGHT_TEXT_COLOR = '#f8fafc'; // Premium off-white
  objects.forEach(obj => {
    const isTextLike = obj.shape === 'text' || obj.shape === 'label' || obj.shape === 'formula' || obj.shape === 'depthtext';
    if (isTextLike || obj.label) {
      obj.textColor = BRIGHT_TEXT_COLOR;
      obj.color = BRIGHT_TEXT_COLOR;
      obj.fill = BRIGHT_TEXT_COLOR;
    }
    // Force badge text to be bright
    if (obj.shape === 'badge' || obj.shape === 'floatingbadge') {
      obj.textColor = '#ffffff';
      obj.bgColor = obj.bgColor || '#4f46e5';
    }
  });

  // ─── STEP 2: Calculate coordinates and apply RADIAL TETHERING (Magnet) ─
  const getX = (o) => {
    if (o.x !== undefined) {
      if (o.w !== undefined) return o.x + o.w / 2;
      return o.x;
    }
    if (o.cx !== undefined) return o.cx;
    if (o.x1 !== undefined && o.x2 !== undefined) return (o.x1 + o.x2) / 2;
    return null;
  };

  const getY = (o) => {
    if (o.y !== undefined) {
      if (o.h !== undefined) return o.y + o.h / 2;
      return o.y;
    }
    if (o.cy !== undefined) return o.cy;
    if (o.y1 !== undefined && o.y2 !== undefined) return (o.y1 + o.y2) / 2;
    return null;
  };

  const positionedObjects = objects.filter(o => getX(o) !== null && getY(o) !== null);
  
  if (positionedObjects.length > 0) {
    const targetCenterX = 400;
    const targetCenterY = 280;

    // First: Center the group as a whole
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    positionedObjects.forEach(o => {
      const ox = getX(o);
      const oy = getY(o);
      const hSpread = (o.orbitRadius || o.r || (o.w ? o.w / 2 : 0) || 0);
      const vSpread = (o.orbitRadius || o.r || (o.h ? o.h / 2 : 0) || 0);
      minX = Math.min(minX, ox - hSpread);
      maxX = Math.max(maxX, ox + hSpread);
      minY = Math.min(minY, oy - vSpread);
      maxY = Math.max(maxY, oy + vSpread);
    });
    
    const currentCenterX = (minX + maxX) / 2;
    const currentCenterY = (minY + maxY) / 2;
    const dx = targetCenterX - currentCenterX;
    const dy = targetCenterY - currentCenterY;
    
    // Group Shift
    objects.forEach(obj => {
      if (obj.x !== undefined)  obj.x += dx;
      if (obj.y !== undefined)  obj.y += dy;
      if (obj.x1 !== undefined) obj.x1 += dx;
      if (obj.y1 !== undefined) obj.y1 += dy;
      if (obj.x2 !== undefined) obj.x2 += dx;
      if (obj.y2 !== undefined) obj.y2 += dy;
      if (obj.cx !== undefined) obj.cx += dx;
      if (obj.cy !== undefined) obj.cy += dy;
    });

    // ─── TETHERING PASS: Magnetically pull split halves together ───────
    console.log(`[PostProcess] Applying Radial Tethering to ${objects.length} objects`);
    
    objects.forEach(obj => {
      const ox = getX(obj);
      const oy = getY(obj);
      if (ox === null || oy === null) return;
      
      const dist = Math.sqrt((ox - targetCenterX)**2 + (oy - targetCenterY)**2);
      const threshold = 220; // Maximum distance allowed before magnet kicks in
      
      if (dist > threshold) {
        // Pull towards target center
        const pullFactor = (threshold / dist) * 0.9; // Smoothly pull inward
        const tether = (val, target, factor) => target + (val - target) * factor;

        if (obj.x !== undefined)  obj.x  = tether(obj.x,  targetCenterX, pullFactor);
        if (obj.y !== undefined)  obj.y  = tether(obj.y,  targetCenterY, pullFactor);
        if (obj.x1 !== undefined) obj.x1 = tether(obj.x1, targetCenterX, pullFactor);
        if (obj.y1 !== undefined) obj.y1 = tether(obj.y1, targetCenterY, pullFactor);
        if (obj.x2 !== undefined) obj.x2 = tether(obj.x2, targetCenterX, pullFactor);
        if (obj.y2 !== undefined) obj.y2 = tether(obj.y2, targetCenterY, pullFactor);
        if (obj.cx !== undefined) obj.cx = tether(obj.cx, targetCenterX, pullFactor);
        if (obj.cy !== undefined) obj.cy = tether(obj.cy, targetCenterY, pullFactor);
        
        // Slightly scale down if it's very far (perspective effect)
        const sizeScale = Math.max(0.7, pullFactor);
        if (obj.r) obj.r *= sizeScale;
        if (obj.w) obj.w *= sizeScale;
        if (obj.h) obj.h *= sizeScale;
        if (obj.orbitRadius) obj.orbitRadius *= sizeScale;
      }
    });
  }

  // ─── STEP 3: Clamp all coordinates to safe canvas zone ─────────────────
  objects.forEach(obj => {
    if (obj.x !== undefined)  obj.x  = Math.max(60, Math.min(740, obj.x));
    if (obj.y !== undefined)  obj.y  = Math.max(60, Math.min(540, obj.y));
    if (obj.x1 !== undefined) obj.x1 = Math.max(40, Math.min(760, obj.x1));
    if (obj.y1 !== undefined) obj.y1 = Math.max(40, Math.min(560, obj.y1));
    if (obj.x2 !== undefined) obj.x2 = Math.max(40, Math.min(760, obj.x2));
    if (obj.y2 !== undefined) obj.y2 = Math.max(40, Math.min(560, obj.y2));
    if (obj.cx !== undefined) obj.cx = Math.max(100, Math.min(700, obj.cx));
    if (obj.cy !== undefined) obj.cy = Math.max(100, Math.min(500, obj.cy));

    // Ensure appearsAtStep exists
    if (obj.appearsAtStep === undefined) obj.appearsAtStep = 0;
  });

  // ─── STEP 4: Connection Enforcement ────────────────────────────────────
  // Ensure no floating shapes — every node must be connected
  const connectorShapes = ['arrow', 'simpleline', 'connector', 'line'];
  const nodeShapes = ['circle', 'rect', 'rectangle', 'box', 'node', 'orb'];
  const orbitalShapes = ['orbit', 'planet'];
  
  const connectors = objects.filter(o => connectorShapes.includes(o.shape));
  const nodes = objects.filter(o => nodeShapes.includes(o.shape));
  
  // Build a set of "connected" node IDs
  const connectedIds = new Set();
  connectors.forEach(c => {
    // Find which nodes are near the arrow endpoints
    nodes.forEach(n => {
      const nx = n.x || 0;
      const ny = n.y || 0;
      const dist1 = Math.sqrt((nx - (c.x1 || 0))**2 + (ny - (c.y1 || 0))**2);
      const dist2 = Math.sqrt((nx - (c.x2 || 0))**2 + (ny - (c.y2 || 0))**2);
      if (dist1 < 150 || dist2 < 150) connectedIds.add(n.id);
    });
  });
  
  // Orbital shapes are inherently connected to center — skip them
  objects.filter(o => orbitalShapes.includes(o.shape)).forEach(o => connectedIds.add(o.id));
  // Text/badge/arc/zone/pointer are decorative annotations — skip them
  objects.filter(o => ['text', 'badge', 'arc', 'zone', 'pointer', 'path'].includes(o.shape)).forEach(o => connectedIds.add(o.id));
  
  // Find floating nodes
  const floatingNodes = nodes.filter(n => !connectedIds.has(n.id));
  
  if (floatingNodes.length > 0 && nodes.length > 1) {
    console.log(`[PostProcess] ⚠️ Found ${floatingNodes.length} floating nodes. Auto-connecting...`);
    
    floatingNodes.forEach(floating => {
      // Find the nearest non-floating node to connect to
      let nearest = null;
      let minDist = Infinity;
      nodes.forEach(other => {
        if (other.id === floating.id) return;
        const d = Math.sqrt(((other.x || 0) - (floating.x || 0))**2 + ((other.y || 0) - (floating.y || 0))**2);
        if (d < minDist) { minDist = d; nearest = other; }
      });
      
      if (nearest) {
        const arrowId = `auto_conn_${floating.id}`;
        objects.push({
          id: arrowId,
          shape: 'arrow',
          x1: nearest.x || 400,
          y1: nearest.y || 280,
          x2: floating.x || 400,
          y2: floating.y || 280,
          color: 'gray',
          appearsAtStep: Math.max(floating.appearsAtStep || 0, nearest.appearsAtStep || 0)
        });
        
        // Add the auto-connection to the step where the floating node appears
        const step = (timeline.steps || []).find(s => s.index === floating.appearsAtStep);
        if (step) {
          step.objectIds.push(arrowId);
          step.newIds.push(arrowId);
        }
      }
    });
  }

  // Validate steps
  (timeline.steps || []).forEach((step, i) => {
    step.index = i;
    step.objectIds = step.objectIds || [];
    step.highlightIds = step.highlightIds || [];
    step.newIds = step.newIds || [];
    step.durationMs = step.durationMs || 4000;
  });

  return timeline;
}

// ─── Main Generation Entry Point ─────────────────────────────────────────────
export async function generateTimeline(sessionId, topic, onProgress = () => {}) {
  const session = sessionStore.get(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  if (isGreeting(topic)) {
    return { type: 'greeting', answer: "Hey there! 👋 I'm your visual tutor. Tell me any topic like 'Solar System' or 'Pythagorean Theorem' to see a real visual lesson!" };
  }

  const userProfile = `Target Complexity = ${session.complexityPreference}, Confusion Level = ${session.confusionIndex}/10`;
  const cached = cache.get(topic, userProfile);
  if (cached) return cached;

  console.log(`[UnifiedEngine] 🚀 Generating Direct Canvas for: "${topic}"`);

  try {
    onProgress('Designing the perfect visual layout...');

    const messages = [
      { role: 'system', content: UNIFIED_PEDAGOGY_PROMPT },
      { role: 'user', content: `TOPIC: ${topic}` }
    ];

    const result = await requestCompletion({
      model: getModel(),
      messages,
      temperature: 0.15,
      maxTokens: 4000,
      responseMimeType: "application/json"
    });

    const raw = safeParse(result.content);
    if (!raw || !raw.objects || !raw.steps || raw.steps.length === 0) {
      console.warn("[UnifiedEngine] AI response did not match canvas schema. Falling back.");
      return generateFailSafeTimeline(topic);
    }

    const timeline = postProcessTimeline(raw, topic);

    cache.set(topic, userProfile, timeline);
    console.log(`[UnifiedEngine] ✅ Generated ${timeline.totalSteps} steps, ${timeline.objects.length} objects for "${topic}"`);
    return timeline;

  } catch (err) {
    console.error(`[UnifiedEngine] ❌ Critical Failure: ${err.message}`);
    return generateFailSafeTimeline(topic);
  }
}

// ─── Doubt Handler ───────────────────────────────────────────────────────────
export async function handleDoubt(sessionId, question) {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful educational assistant. Answer the student\'s question concisely in 2-3 sentences. Return JSON: { "answer": "..." }' },
      { role: 'user', content: question }
    ];
    const result = await requestCompletion({ model: getModel(), messages, temperature: 0.2, maxTokens: 500, responseMimeType: "application/json" });
    const parsed = safeParse(result.content);
    return { answer: parsed?.answer || "Great question! Let me think about that.", isRelevant: true, hasVisuals: false, visualUpdate: null };
  } catch (err) {
    return { answer: "That's a great question! This connects directly to what we've been exploring.", isRelevant: true, hasVisuals: false, visualUpdate: null };
  }
}

// ─── Text Response Handler ───────────────────────────────────────────────────
export async function generateTextResponse(sessionId, topic) {
  try {
    const messages = [
      { role: 'system', content: 'You are a friendly educational tutor. Give a concise, helpful answer in 2-3 sentences. Return JSON: { "answer": "..." }' },
      { role: 'user', content: topic }
    ];
    const result = await requestCompletion({ model: getModel(), messages, temperature: 0.3, maxTokens: 400, responseMimeType: "application/json" });
    const parsed = safeParse(result.content);
    return { answer: parsed?.answer || `Great question about "${topic}"!`, type: 'text' };
  } catch (err) {
    return { answer: `I'd love to help with "${topic}"! Try asking again for a visual lesson.`, type: 'text' };
  }
}

// ─── Legacy Stubs ────────────────────────────────────────────────────────────
export async function generatePedagogy() { return null; }
