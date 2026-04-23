import { AI_CONFIG } from '../config/providers.js';
import { formatStandardOutput } from '../utils/formatter.js';

/**
 * Hugging Face Inference API Provider
 */
export async function generateResponse(prompt, signal) {
  const config = AI_CONFIG.providers.huggingface;
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) throw new Error("Hugging Face API key missing");

  const url = `${config.baseUrl}${config.model}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal,
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        return_full_text: false,
        max_new_tokens: 500
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Hugging Face Error: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  const rawText = Array.isArray(data) ? data[0].generated_text : data.generated_text;

  return formatStandardOutput(rawText);
}
