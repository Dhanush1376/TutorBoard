import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateExplanation = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Native OpenAI model
      messages: [
        {
          role: "system",
          content: `You are an expert Computer Science and Mathematics tutor. Your goal is to convert user questions into structured, step-by-step visual explanations for an interactive whiteboard.

You must reply strictly in valid JSON format representing the steps of an algorithm or mathematical concept.

JSON Schema Requirements:
{
  "title": "String - The overarching concept being taught, e.g., 'Binary Search' or 'y = 2x + 1'",
  "steps": [
    {
      "type": "String - Must be one of: 'array', 'compare', 'swap', 'highlight', 'graph'",
      "description": "String - A concise text explanation of what's precisely happening in this specific step.",
      "data": "Object - See details below based on the 'type'",
      "animation_instructions": "String - A human-readable intent for how the animation should feel (e.g., 'Highlight the middle element in blue and zoom slightly')."
    }
  ]
}

Specific Handlers for 'data' Object based on 'type':

1. type "array":
   - "data" must be: { "array": [Element1, Element2, ...] }
   - Use for defining the base structural array on the board.

2. type "compare":
   - "data" must be: { "array": [Element1, Element2, ...], "index_a": Int, "index_b": Int, "condition": ">" | "<" | "==" }
   - Use heavily for Binary Search or Bubble Sort to show comparison boundaries.

3. type "swap":
   - "data" must be: { "array": [Element1, Element2, ...], "swap_i": Int, "swap_j": Int }
   - Use to denote an active swap in algorithms like Bubble Sort.

4. type "highlight":
   - "data" must be: { "array": [Element1, Element2, ...], "highlight_indices": [Int, Int, ...] }
   - Use to emphasize a specific node without comparison, e.g., "target found".

5. type "graph":
   - "data" must be: { "equation": "String - e.g. y = mx + c", "points": [ [x1, y1], [x2, y2], ... ] }
   - Use when the user asks to visualize a mathematical line or graph.

Ensure you break algorithmic operations (like Bubble Sort or Binary Search) into deliberate, granular frame-by-frame steps.

Respond ONLY with valid JSON.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    // OpenAI sometimes returns Markdown JSON blocks, so we parse it safely:
    let content = completion.choices[0].message.content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    const parsedResponse = JSON.parse(content);
    res.json(parsedResponse);
  } catch (error) {
    console.error('OpenAI generation error:', error);
    res.status(500).json({ error: 'Failed to generate explanation from AI' });
  }
};
