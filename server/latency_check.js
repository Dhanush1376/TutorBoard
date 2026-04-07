import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTimeline } from './engine/aiOrchestrator.js';
import sessionStore from './engine/sessionStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function testLessonLatency(topic) {
  const sessionId = 'test-session';
  sessionStore.create(sessionId, 'test-socket');
  
  console.log(`\n--- Testing Lesson Generation Latency ---`);
  console.log(`Topic: ${topic}`);
  
  const start = Date.now();
  try {
    const timeline = await generateTimeline(sessionId, topic);
    const end = Date.now();
    
    console.log(`\nSUCCESS`);
    console.log(`Time taken: ${((end - start) / 1000).toFixed(2)}s`);
    console.log(`Steps generated: ${timeline.steps.length}`);
    console.log(`Objects generated: ${timeline.objects.length}`);
    console.log(`Title: ${timeline.title}`);
  } catch (err) {
    console.error(`\nFAILURE: ${err.message}`);
  }
}

// Run the test
const topic = process.argv[2] || "How Photosynthesis works";
testLessonLatency(topic);
