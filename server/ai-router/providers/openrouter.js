import { AI_CONFIG } from '../config/providers.js';
import { formatStandardOutput } from '../utils/formatter.js';
import OpenAI from 'openai';

/**
 * OpenRouter API Provider
 */
export async function generateResponse(prompt, signal) {
  const config = AI_CONFIG.providers.openrouter;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) throw new Error("OpenRouter API key missing");

  const or = new OpenAI({
    apiKey,
    baseURL: config.baseUrl,
    defaultHeaders: {
      "HTTP-Referer": "https://tutorboard.app",
      "X-Title": "TutorBoard",
    }
  });

  const completion = await or.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: config.model,
    response_format: { type: "json_object" }
  }, { signal });

  const rawText = completion.choices[0].message.content;
  return formatStandardOutput(rawText);
}
