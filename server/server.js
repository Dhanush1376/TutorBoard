import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI that generates step-by-step visual explanations for an interactive whiteboard.
The whiteboard uses Konva.js format.
Create a step-by-step response that breaks down the explanation. For each step, provide:
1. "description": A text explaining what happens in this step.
2. "elements": An array of visual elements (shapes, lines, text) to draw on the canvas. 

The canvas size is roughly 800x600.
Available element types:
- text (requires: x, y, text, fontSize, fill)
- rect (requires: x, y, width, height, stroke, fill)
- circle (requires: x, y, radius, stroke, fill)
- arrow (requires: points [x1, y1, x2, y2], stroke, pointerLength, pointerWidth)

Respond with valid JSON only in this exact format:
{
  "steps": [
    {
      "description": "Step 1 text...",
      "elements": [
        {"type": "text", "x": 100, "y": 50, "text": "Hello", "fontSize": 20, "fill": "black"}
      ]
    }
  ]
}`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsedResponse = JSON.parse(completion.choices[0].message.content);
    res.json(parsedResponse);
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
