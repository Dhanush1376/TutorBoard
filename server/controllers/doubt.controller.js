import aiClient, { getModel } from '../utils/ai.js';
import Doubt from '../models/Doubt.js';
import mongoose from 'mongoose';

// ─── FALLBACK ANIMATION ─── Safe scene returned when everything fails
const FALLBACK_ANIMATION = {
  answer: "I've prepared a visual overview for your question.",
  hasVisuals: true,
  visualUpdate: {
    type: "scene",
    title: "Visual Overview",
    domain: "general",
    visualizationType: "scene",
    objects: [
      { id: "c1", shape: "circle", x: 300, y: 250, r: 60, color: "blue", fillOpacity: 0.2, label: "Concept" },
      { id: "c2", shape: "circle", x: 500, y: 250, r: 60, color: "green", fillOpacity: 0.2, label: "Result" },
      { id: "a1", shape: "arrow", x1: 370, y1: 250, x2: 430, y2: 250, color: "gray", label: "leads to" },
      { id: "t1", shape: "text", x: 400, y: 450, text: "Visual Engine Ready", fontSize: 20, color: "gray" }
    ],
    steps: [
      { label: "Identify", icon: "🔍", description: "Identify the core concept to visualize." },
      { label: "Analyze", icon: "⚙️", description: "Break it down into visual components." },
      { label: "Visualize", icon: "✨", description: "Render the final visual diagram." }
    ]
  }
};

// ─── VALIDATION ─── Strict schema enforcement
function validateAnimationResponse(data) {
  if (typeof data.answer !== 'string' || !data.answer.trim()) return false;
  if (typeof data.hasVisuals !== 'boolean') return false;
  if (data.hasVisuals === false) return true;
  if (!data.visualUpdate || typeof data.visualUpdate !== 'object') return false;
  // Must have either objects array OR steps array (or both)
  const hasObjects = Array.isArray(data.visualUpdate.objects) && data.visualUpdate.objects.length > 0;
  const hasSteps = Array.isArray(data.visualUpdate.steps) && data.visualUpdate.steps.length > 0;
  if (!hasObjects && !hasSteps) return false;
  return true;
}

// ─── SAFE PARSE ───
function safeParse(content) {
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── SYSTEM PROMPT ─── Visual Scene Generator
const SYSTEM_PROMPT_BASE = `You are TutorBoard Visual Engine — you convert questions into VISUAL SCENE DIAGRAMS.

You are NOT a chatbot. You draw ACTUAL SHAPES on an SVG canvas.
Your canvas is 800 wide × 600 tall. Use these coordinates for positioning objects.

ABSOLUTE RULES:
1. Return ONLY valid JSON. No markdown. No commentary.
2. NEVER generate text explanations, bullet points, or hierarchical trees.
3. Think like a DESIGNER drawing on a whiteboard — use shapes, arrows, labels.

MANDATORY JSON FORMAT:
{
  "answer": "Brief 1 sentence describing what the visual shows.",
  "hasVisuals": true,
  "visualUpdate": {
    "type": "scene",
    "title": "Concept Title",
    "domain": "mathematics | physics | chemistry | biology | dsa | general",
    "visualizationType": "scene",
    "objects": [
      -- AVAILABLE SHAPES --
      { "id": "c1", "shape": "circle", "x": 400, "y": 250, "r": 80, "color": "blue", "fillOpacity": 0.2, "label": "Label below", "innerLabel": "Text inside", "glow": false, "pulse": false },
      { "id": "r1", "shape": "rect", "x": 400, "y": 300, "w": 120, "h": 60, "color": "green", "label": "Box Label", "rx": 12 },
      { "id": "l1", "shape": "line", "x1": 200, "y1": 300, "x2": 600, "y2": 300, "color": "red", "strokeWidth": 2, "dashed": false },
      { "id": "a1", "shape": "arrow", "x1": 300, "y1": 250, "x2": 500, "y2": 250, "color": "white", "label": "flow label" },
      { "id": "t1", "shape": "text", "x": 400, "y": 500, "text": "A = πr²", "fontSize": 28, "color": "white", "fontWeight": "bold" },
      { "id": "o1", "shape": "orbit", "cx": 400, "cy": 300, "orbitRadius": 150, "r": 12, "color": "cyan", "label": "Earth", "speed": 8 },
      { "id": "arc1", "shape": "arc", "cx": 400, "cy": 300, "r": 40, "startAngle": 0, "endAngle": 90, "color": "yellow" }
    ],
    "steps": [
      { "label": "Step Title", "icon": "emoji", "description": "What this step shows visually." }
    ]
  }
}

POSITIONING GUIDE (canvas is 800×600):
- Center: x=400, y=300
- Top-left: x=100, y=100
- Top-right: x=700, y=100
- Bottom-center: x=400, y=500
- Spread items horizontally: x=200, x=400, x=600 (all at y=300)

VISUAL RULES:
- Use "circle" for concepts, planets, atoms, nodes
- Use "rect" for processes, steps, containers, blocks
- Use "arrow" to show flow, direction, cause→effect
- Use "line" for axes, connections, measurements
- Use "text" for formulas, labels, titles
- Use "orbit" for anything that revolves (planets, electrons)
- Use "arc" for angles, curves
- Use "glow": true for emphasis (e.g., the Sun)
- Use "pulse": true for animated pulsing
- Use colors: blue, red, green, yellow, orange, purple, pink, cyan, gold, teal, white, gray

EXAMPLES:

"Area of a circle" →
Objects: A large blue circle at center, a red radius line from center to edge, "r" label on the line, "A = πr²" formula text below.

"Solar system" →
Objects: A golden glowing circle for the Sun at center, orbit shapes for each planet at different radii and speeds, labels for each planet.

"Binary search" →
Objects: rectangles for array elements spread horizontally, arrows showing comparison, highlighted elements.

"steps" array is MANDATORY with at least 2 items.
Each step needs "label" and "description".

For greetings ("hi", "hello"):
{
  "answer": "Hey! Ask me anything and I'll draw a visual diagram to explain it.",
  "hasVisuals": false,
  "visualUpdate": null
}`;

// ─── LLM CALL WITH RETRY ─── Max 2 retries with stricter prompt on failure
async function callLLMWithRetry(messages, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TutorBoard] LLM call attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const completion = await aiClient.chat.completions.create({
        model: getModel(),
        temperature: attempt === 0 ? 0.3 : 0, // Lower temp on retries
        messages,
        response_format: { type: "json_object" }
      });

      const raw = completion.choices[0].message.content;
      console.log(`[TutorBoard] === RAW LLM OUTPUT (attempt ${attempt + 1}) ===`);
      console.log(raw);
      console.log(`[TutorBoard] ==========================================`);

      const parsed = safeParse(raw);
      if (!parsed) {
        console.error(`[TutorBoard] JSON parse FAILED on attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          // Add retry instruction
          messages.push({ role: "assistant", content: raw });
          messages.push({ role: "user", content: "INVALID OUTPUT. Your response was not valid JSON. You MUST return ONLY a valid JSON object matching the exact schema. Try again." });
          continue;
        }
        return null;
      }

      if (!validateAnimationResponse(parsed)) {
        console.error(`[TutorBoard] Schema validation FAILED on attempt ${attempt + 1}:`, JSON.stringify(parsed).substring(0, 200));
        if (attempt < maxRetries) {
          messages.push({ role: "assistant", content: raw });
          messages.push({ role: "user", content: "INVALID SCHEMA. Your response must include 'answer' (string), 'hasVisuals' (boolean), and if hasVisuals=true, 'visualUpdate' with a non-empty 'steps' array where each step has 'label' and 'description'. Fix and retry." });
          continue;
        }
        // On final attempt failure, try to salvage what we can
        return parsed;
      }

      console.log(`[TutorBoard] ✅ Valid response on attempt ${attempt + 1}`);
      return parsed;

    } catch (err) {
      console.error(`[TutorBoard] LLM error on attempt ${attempt + 1}:`, err.message);
      if (attempt === maxRetries) return null;
    }
  }
  return null;
}

// ─── MAIN CONTROLLER ───
export const answerDoubt = async (req, res) => {
  try {
    const { question, history, stepDescription, stepData, stepIndex } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const contextInfo = stepDescription
      ? `Context: Student is on Step ${(stepIndex || 0) + 1}: "${stepDescription}".`
      : '';

    const systemPrompt = SYSTEM_PROMPT_BASE + (contextInfo ? `\n\n${contextInfo}` : '');

    const chatHistory = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: question }
    ];

    const data = await callLLMWithRetry(messages);

    // If LLM completely failed, use fallback
    if (!data) {
      console.warn('[TutorBoard] All LLM attempts failed. Returning fallback animation.');
      const fallback = { ...FALLBACK_ANIMATION };
      fallback.visualUpdate = { ...fallback.visualUpdate };
      fallback.visualUpdate.title = question.substring(0, 50);
      return res.json(fallback);
    }

    // Ensure steps array always exists when hasVisuals
    if (data.hasVisuals && data.visualUpdate) {
      if (!Array.isArray(data.visualUpdate.steps) || data.visualUpdate.steps.length === 0) {
        // Build steps from sequence if available
        if (Array.isArray(data.visualUpdate.sequence) && data.visualUpdate.sequence.length > 0) {
          data.visualUpdate.steps = data.visualUpdate.sequence.map((s, i) => ({
            type: "process",
            label: `Step ${i + 1}`,
            icon: "🔹",
            description: s.description || `Animation frame ${i + 1}`
          }));
        } else {
          // Minimal fallback steps
          data.visualUpdate.steps = [
            { type: "process", label: "Concept", icon: "🔹", description: data.answer || "Visual concept" }
          ];
        }
      }
      // Ensure visualizationType
      if (!data.visualUpdate.visualizationType) {
        data.visualUpdate.visualizationType = "process";
      }
    }

    // Save to DB
    if (req.user && mongoose.connection.readyState === 1) {
      try {
        await Doubt.create({
          user: req.user._id,
          question,
          answer: data.answer,
          stepIndex: stepIndex || 0,
          stepDescription: stepDescription || '',
        });
      } catch (dbErr) {
        console.error('[TutorBoard] DB save failed:', dbErr.message);
      }
    }

    res.json(data);
  } catch (error) {
    console.error('[TutorBoard] Critical error in answerDoubt:', error);
    // Even on crash, return fallback
    res.json(FALLBACK_ANIMATION);
  }
};

/**
 * GET /api/doubts/history
 */
export const getDoubtHistory = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
       return res.status(503).json({ error: 'Database connection error. History unavailable.' });
    }
    const history = await Doubt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ history: history.reverse() });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};
