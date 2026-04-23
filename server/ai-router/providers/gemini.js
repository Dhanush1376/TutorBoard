import { AI_CONFIG } from '../config/providers.js';
import { formatStandardOutput } from '../utils/formatter.js';

/**
 * Google Gemini API Provider
 */
export async function generateResponse(prompt, signal) {
  const config = AI_CONFIG.providers.gemini;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) throw new Error("Gemini API key missing");

  const url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  return formatStandardOutput(rawText);
}
