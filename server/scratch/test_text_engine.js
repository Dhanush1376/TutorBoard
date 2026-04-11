import { generateTextResponse } from '../engine/core/pedagogyEngine.js';
import sessionStore from '../engine/core/sessionStore.js';
import dotenv from 'dotenv';
dotenv.config();

async function testTextResponse() {
  const sessionId = 'test-session-' + Date.now();
  sessionStore.create(sessionId, 'mock-socket-id');
  sessionStore.update(sessionId, { topic: 'Photosynthesis' });

  console.log("Testing Conversational Greeting with 'OpenRouter' UI ID...");
  try {
    const res = await generateTextResponse(sessionId, 'Hi Tutu!', 'OpenRouter');
    console.log("Response:", res);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testTextResponse();
