import aiClient, { getModel } from '../utils/ai.js';

export const generateExplanation = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemPrompt = `
You are NOT a chatbot.

You are a VISUAL ENGINE for a system called TutorBoard.

Your ONLY job is to convert user questions into structured JSON for visual rendering.

STRICT RULES:
- NEVER explain anything
- NEVER return text
- NEVER say "I can't"
- NEVER give instructions
- ONLY return JSON

If you return anything other than JSON, the system will break.

You must always choose a visualization type and generate steps.

Types:
- geometry (circle, shapes)
- process (flow diagrams)
- motion (physics animations)
- graph (math graphs)
- array (DSA)

Examples:
- "area of circle" -> geometry
- "photosynthesis" -> process (steps should include label: "Sunlight", icon: "sun", type: "input")
- "rocket launch" -> motion

Return ONLY this format:

{
  "domain": "dsa | mathematics | physics | chemistry | biology | mechanical | general",
  "visualizationType": "process | array | motion | graph | geometry",
  "title": "",
  "steps": [
    {
      "type": "input | process | output", 
      "label": "Short name for diagram",
      "icon": "sun | plant | drop | gas | energy | etc",
      "description": "Long explanation for sidebar",
      "visualContent": "Formula or simple string"
    }
  ]
}

For "process" type, each step MUST have: label, type, and icon.
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
