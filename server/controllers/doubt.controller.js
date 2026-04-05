import { getAIClient, getModel } from '../utils/ai.js';



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
    // Strip <think>...</think> blocks from reasoning models
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    // Extract JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── SYSTEM PROMPT ─── Universal Visual Engine
const SYSTEM_PROMPT = `You are TutorBoard Visual Engine — the world's most advanced interactive learning system.
Your mission is to explain complex concepts by simultaneously writing clear text AND drawing perfectly coordinate-aligned SVG diagrams.

ABSOLUTE RULES:
1. ALWAYS return valid JSON. NEVER return plain text or markdown explanations alone.
2. For EVERY response, you MUST provide a visual scene in "visualUpdate".
   - If the user just says "Hi", draw a "Welcome" scene with a smiling robot or a books icon.
   - If the user asks a deep question, draw a detailed technical diagram (Circuit, Physics scene, DSA array, etc.).
3. Coordinate System: Canvas is 800 wide × 600 tall. Center is 400,300.
4. "hasVisuals" MUST be true for every educational response.

MANDATORY JSON STRUCTURE:
{
  "answer": "Clear, deep explanation (2-4 sentences). Use markdown for bolding key terms.",
  "hasVisuals": true,
  "visualUpdate": {
    "type": "scene",
    "title": "Concept Title",
    "domain": "mathematics | physics | chemistry | biology | dsa | general",
    "objects": [
       -- Use a mix of circles, rects, arrows, lines, and text --
       -- IMPORTANT: For DSA, use shape: "array", "pointer", "swapbridge" --
    ],
    "steps": [
       -- Minimum 2 steps. Each step must have "label" and "description" --
    ]
  }
}`;

// ─── LLM CALL WITH RETRY ─── Max 2 retries with stricter prompt on failure
async function callLLMWithRetry(messages, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TutorBoard] LLM call attempt ${attempt + 1}/${maxRetries + 1}`);
      
      const ai = getAIClient();
      const completion = await ai.chat.completions.create({
        model: getModel(),
        temperature: attempt === 0 ? 0.3 : 0.1,
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
          messages.push({ role: "assistant", content: raw });
          messages.push({ role: "user", content: "INVALID OUTPUT. Your response was not valid JSON. You MUST return ONLY a valid JSON object matching the exact schema. Try again." });
          continue;
        }
        return null;
      }

      if (!validateAnimationResponse(parsed)) {
        console.error(`[TutorBoard] Schema validation FAILED on attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          messages.push({ role: "user", content: "INVALID SCHEMA. Ensure you include 'answer', 'hasVisuals': true, 'visualUpdate' with 'objects' and 'steps'. Fix and retry." });
          continue;
        }
        return parsed;
      }

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
      ? `\nContext: Student is on Step ${(stepIndex || 0) + 1}: "${stepDescription}".`
      : '';

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + contextInfo },
      ...(history || []).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: "user", content: question }
    ];

    console.log(`[TutorBoard] Processing visual query: "${question}"`);
    const data = await callLLMWithRetry(messages);

    // If LLM completely failed, use fallback
    if (!data) {
      console.warn('[TutorBoard] All LLM attempts failed. Returning fallback animation.');
      const fallback = { ...FALLBACK_ANIMATION };
      fallback.visualUpdate = { ...fallback.visualUpdate };
      fallback.visualUpdate.title = question.substring(0, 50);
      
      // Add debug info to the canvas objects
      fallback.visualUpdate.objects = [...fallback.visualUpdate.objects, { 
        id: "debug-err", shape: "text", x: 400, y: 550, 
        text: `Engine Error: LLM call failed. Check server logs.`, 
        fontSize: 12, color: "gray" 
      }];
      
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
    // MongoDB removed — returning empty history for now
    res.json({ history: [] });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};
