import { getAIClient, getModel } from '../utils/ai.js';

// ─── PROFESSOR-GRADE FALLBACK ───
const FALLBACK_RESPONSE = {
  mode: "explain",
  title: "Visual Overview",
  domain: "general",
  difficulty: "beginner",
  professorNote: "A high-level view of your core concept.",
  learningNodes: [
    { type: "hook", title: "Start Here", content: "Let's begin by understanding the big picture." },
    { type: "concept", title: "Core Idea", content: "The simple definition of this topic." },
    { type: "intuition", title: "Why it works", content: "Thinking like a professor — why this matters." },
    { type: "result", title: "Final Goal", content: "Congratulations on starting the journey!" }
  ],
  totalSteps: 4,
  objects: [
    { id: "c1", shape: "circle", x: 250, y: 300, r: 60, color: "blue", label: "Start" },
    { id: "c2", shape: "circle", x: 400, y: 300, r: 60, color: "orange", label: "Idea" },
    { id: "c3", shape: "circle", x: 550, y: 300, r: 60, color: "green", label: "Result" },
    { id: "a1", shape: "arrow", x1: 310, y1: 300, x2: 340, y2: 300, color: "white", label: "leads" },
    { id: "a2", shape: "arrow", x1: 460, y1: 300, x2: 490, y2: 300, color: "white", label: "results" }
  ],
  steps: [
    { label: "The Hook", icon: "✨", description: "Capturing your attention." },
    { label: "Deep Dive", icon: "🧠", description: "Building the concept layers." },
    { label: "Visual Insight", icon: "👁️", description: "Seeing the relationship clearly." },
    { label: "Complete", icon: "🎓", description: "Mastering the fundamental idea." }
  ]
};

// ─── VALIDATION ───
function validateGenerateResponse(data) {
  if (!data || typeof data !== 'object') return false;
  const hasObjects = Array.isArray(data.objects) && data.objects.length > 0;
  const hasSteps = Array.isArray(data.steps) && data.steps.length > 0;
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

import { TEACHING_TIMELINE_PROMPT } from '../engine/prompts.js';
const SYSTEM_PROMPT = TEACHING_TIMELINE_PROMPT;

export const generateExplanation = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[TutorBoard:Generate] Attempt ${attempt + 1}/3`);
        
        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ];

        if (attempt > 0) {
          messages.push({ role: "user", content: "PREVIOUS OUTPUT INVALID. Return ONLY valid JSON with 'objects' array (actual shapes with positions) and 'steps' array." });
        }

        const ai = getAIClient();
        const completion = await ai.chat.completions.create({
          model: getModel(),
          temperature: attempt === 0 ? 0.3 : 0,
          messages,
          max_tokens: 6000,
          response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content;
        console.log(`[TutorBoard:Generate] === RAW OUTPUT ===`);
        console.log(raw);
        console.log(`[TutorBoard:Generate] =================`);

        const parsed = safeParse(raw);
        if (!parsed) {
          console.error(`[TutorBoard:Generate] Parse failed on attempt ${attempt + 1}`);
          console.error(`[TutorBoard:Generate] ❌ TAIL END:`, raw.slice(-500));
          continue;
        }

        if (!validateGenerateResponse(parsed)) {
          console.error(`[TutorBoard:Generate] Validation failed on attempt ${attempt + 1}`);
          continue;
        }

        if (!parsed.visualizationType) parsed.visualizationType = "scene";
        if (!parsed.domain) parsed.domain = "general";

        console.log(`[TutorBoard:Generate] ✅ Valid on attempt ${attempt + 1}`);
        return res.json(parsed);

      } catch (err) {
        console.error(`[TutorBoard:Generate] Error on attempt ${attempt + 1}:`, err.message);
      }
    }

    console.warn('[TutorBoard:Generate] All attempts failed. Returning fallback.');
    return res.json({ ...FALLBACK_RESPONSE, title: prompt.substring(0, 50) });

  } catch (error) {
    console.error("[TutorBoard:Generate] Critical error:", error);
    res.json(FALLBACK_RESPONSE);
  }
};
