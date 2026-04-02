import aiClient, { getModel } from '../utils/ai.js';

// ─── FALLBACK ───
const FALLBACK_RESPONSE = {
  domain: "general",
  visualizationType: "scene",
  title: "Visual Overview",
  objects: [
    { id: "c1", shape: "circle", x: 300, y: 250, r: 60, color: "blue", fillOpacity: 0.2, label: "Concept" },
    { id: "c2", shape: "circle", x: 500, y: 250, r: 60, color: "green", fillOpacity: 0.2, label: "Result" },
    { id: "a1", shape: "arrow", x1: 370, y1: 250, x2: 430, y2: 250, color: "gray", label: "leads to" },
    { id: "t1", shape: "text", x: 400, y: 450, text: "Visual Engine Ready", fontSize: 20, color: "gray" }
  ],
  steps: [
    { label: "Identify", icon: "🔍", description: "Identify the core concept." },
    { label: "Analyze", icon: "⚙️", description: "Break it into visual parts." },
    { label: "Render", icon: "✨", description: "Generate the visual diagram." }
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
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── SYSTEM PROMPT ───
const SYSTEM_PROMPT = `You are TutorBoard Visual Engine — you draw ACTUAL VISUAL DIAGRAMS.

Your canvas is 800 wide × 600 tall. Use these coordinates for all shapes.

RULES:
1. Return ONLY valid JSON. No markdown. No text.
2. NEVER generate paragraphs, bullet points, or trees.
3. Draw REAL shapes — circles, rectangles, arrows, text, orbits.

JSON FORMAT:
{
  "domain": "mathematics | physics | chemistry | biology | dsa | general",
  "visualizationType": "scene",
  "title": "Concept Title",
  "objects": [
    { "id": "c1", "shape": "circle", "x": 400, "y": 250, "r": 80, "color": "blue", "fillOpacity": 0.2, "label": "Label", "glow": false, "pulse": false },
    { "id": "r1", "shape": "rect", "x": 400, "y": 300, "w": 120, "h": 60, "color": "green", "label": "Box" },
    { "id": "l1", "shape": "line", "x1": 200, "y1": 300, "x2": 600, "y2": 300, "color": "red" },
    { "id": "a1", "shape": "arrow", "x1": 300, "y1": 250, "x2": 500, "y2": 250, "color": "white", "label": "flow" },
    { "id": "t1", "shape": "text", "x": 400, "y": 500, "text": "A = πr²", "fontSize": 28, "color": "white" },
    { "id": "o1", "shape": "orbit", "cx": 400, "cy": 300, "orbitRadius": 150, "r": 12, "color": "cyan", "label": "Earth", "speed": 8 },
    { "id": "arc1", "shape": "arc", "cx": 400, "cy": 300, "r": 40, "startAngle": 0, "endAngle": 90, "color": "yellow" }
  ],
  "steps": [
    { "label": "Step Title", "icon": "emoji", "description": "What this visual step shows." }
  ]
}

POSITIONING (800×600 canvas):
- Center: x=400, y=300
- Top-left: x=100, y=100  |  Top-right: x=700, y=100
- Bottom: x=400, y=500
- Spread horizontally: x=200, x=400, x=600

Colors: blue, red, green, yellow, orange, purple, pink, cyan, gold, teal, white, gray

"steps" is MANDATORY with at least 2 items. Each needs "label" and "description".
`;

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

        const completion = await aiClient.chat.completions.create({
          model: getModel(),
          temperature: attempt === 0 ? 0.3 : 0,
          messages,
          response_format: { type: "json_object" }
        });

        const raw = completion.choices[0].message.content;
        console.log(`[TutorBoard:Generate] === RAW OUTPUT ===`);
        console.log(raw);
        console.log(`[TutorBoard:Generate] =================`);

        const parsed = safeParse(raw);
        if (!parsed) {
          console.error(`[TutorBoard:Generate] Parse failed on attempt ${attempt + 1}`);
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
