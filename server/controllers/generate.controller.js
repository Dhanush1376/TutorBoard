import aiClient, { getModel } from '../utils/ai.js';

export const generateExplanation = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemPrompt = `
You are TutorBoard Visual Engine — a specialist in converting educational concepts into clear, structured visual sequences.

Your ONLY job is to convert user prompts into structured JSON for visual rendering on a whiteboard.

## 🎨 VISUAL INTELLIGENCE RULES
- Convert explanations into visuals instead of long text.
- Focus on: Flow diagrams, Step sequences, and Node connections.
- Keep visuals clean, meaningful, and professional.
- Avoid clutter; focus on clarity.

STRICT RULES:
- NEVER explain anything.
- NEVER return text or conversational filler.
- NEVER say "I can't".
- ONLY return a valid JSON object.

Visualization Types:
- geometry (shapes, trigonometry)
- process (standard flow diagrams, biological cycles, chemical reactions)
- motion (animations, physics movements)
- graph (mathematical functions, data plotting)
- array (data structures, logic steps)

Return ONLY this format:
{
  "domain": "dsa | mathematics | physics | chemistry | biology | mechanical | general",
  "visualizationType": "process | array | motion | graph | geometry",
  "title": "...",
  "steps": [
    {
      "type": "input | process | output", 
      "label": "...",
      "icon": "...",
      "description": "...",
      "visualContent": "..."
    }
  ]
}
`;

    const completion = await aiClient.chat.completions.create({
      model: getModel(),
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Parse safely — strip markdown fences if present
    let content = completion.choices[0].message.content.trim();
    
    // Debug as per STEP 5
    console.log("=== AI RAW OUTPUT ===");
    console.log(content);
    console.log("=====================");

    if (content.startsWith('```json')) {
      content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    if (content.startsWith('```')) {
      content = content.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    const parsedResponse = JSON.parse(content);
    res.json(parsedResponse);
  } catch (error) {
    console.error("OpenAI Error:", error.message || error);
    res.status(500).json({
      success: false,
      message: "AI Agent is currently unavailable"
    });
  }
};
