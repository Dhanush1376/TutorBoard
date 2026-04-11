import { requestCompletion } from '../engine/utils/llmClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function testDispatcher() {
  console.log("Testing Dispatcher with OpenRouter...");
  try {
    const res = await requestCompletion({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }]
    });
    console.log("OpenRouter Response:", res.content);
  } catch (err) {
    console.error("OpenRouter Error:", err.message);
  }

  // We won't test Bytez with real API calls as it requires a real key
  // but we can test the ROUTING logic by observing the logs.
  console.log("\nTesting Routing to Bytez (MOCK)...");
  try {
    // This should trigger the [AI:Dispatcher] Routing to Bytez log
    // and then fail in callBytez because of the XXXXX key.
    await requestCompletion({
      model: 'bytez/anthropic/claude-opus-4',
      messages: [{ role: 'user', content: 'Say hello' }]
    });
  } catch (err) {
    console.log("Bytez Routing Catch (Expected):", err.message);
  }
}

testDispatcher();
