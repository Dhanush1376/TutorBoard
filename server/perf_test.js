
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
dotenv.config({ path: './server/.env' });

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://tutorboard.app',
    'X-Title': 'TutorBoard Perf Test',
  }
});

async function runTest() {
  console.log(`Testing latency for model: ${model}`);
  const start = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: 'You are a helpful tutor. Return only JSON.' },
        { role: 'user', content: 'Explain photosynthesis in 5 steps for a visual animation engine with objects and steps.' }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });
    const end = Date.now();
    console.log(`Time taken: ${(end - start) / 1000}s`);
    console.log(`Characters received: ${completion.choices[0].message.content.length}`);
    // console.log(completion.choices[0].message.content.substring(0, 200) + '...');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

runTest();
