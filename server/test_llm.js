
import * as dotenv from 'dotenv';
dotenv.config();
import { getAIClient, getModel } from './engine/ai/llmClient.js';
import { generateTimeline } from './engine/aiOrchestrator.js';
import sessionStore from './engine/sessionStore.js';

async function test() {
  console.log('Testing LLM directly...');
  try {
    sessionStore.create('test-123', 'test-123');
    const result = await generateTimeline('test-123', 'binary search');
    console.log('Success:', JSON.stringify(result, null, 2).substring(0, 500));
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}
test();
