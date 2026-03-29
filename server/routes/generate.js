import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat", // DeepSeek model ID
      messages: [
        {
          role: "system",
          content: `You are an AI that generates step-by-step visual explanations for an interactive whiteboard.
The whiteboard uses a semantic JSON format. Instead of calculating primitive x/y positions, you will output semantic data structures that the frontend visualizer parses.

Create a response that breaks down the explanation into clear visual steps. For each step, provide:
1. "description": A concise text explanation of what's happening.
2. "visuals": An array of semantic visual objects.

Currently supported visual objects:
- "array": Renders a sequence of boxes.
  Required fields for "array":
  - "type": "array"
  - "data": Array of elements (numbers/strings) to display in the boxes.
  - "highlight": Array of indices that should be currently highlighted (e.g., [2] meaning highlight the 3rd element).

Respond ONLY with valid JSON in this exact format:
{
  "steps": [
    {
      "description": "Checking index 2...",
      "visuals": [
        {
           "type": "array",
           "data": [1, 3, 5, 7, 9],
           "highlight": [2]
        }
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
    console.error('DeepSeek generation error:', error);
    res.status(500).json({ error: 'Failed to generate explanation from AI' });
  }
});

export default router;
