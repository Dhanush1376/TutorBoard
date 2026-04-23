import { AI_CONFIG } from '../config/providers.js';
import { formatStandardOutput } from '../utils/formatter.js';
import OpenAI from 'openai';

/**
 * Groq API Provider (OpenAI Compatible)
 */
export async function generateResponse(prompt, signal) {
  const config = AI_CONFIG.providers.groq;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) throw new Error("Groq API key missing");

  const groq = new OpenAI({
    apiKey,
    baseURL: config.baseUrl
  });

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: config.model,
    response_format: { type: "json_object" }
  }, { signal });

  const rawText = completion.choices[0].message.content;
  return formatStandardOutput(rawText);
}
