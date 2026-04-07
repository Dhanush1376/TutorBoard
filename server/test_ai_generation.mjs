import { generateTimeline } from './engine/aiOrchestrator.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log('--- AI Generation Stress Test ---');
  const topic = 'Solar System with planets orbiting the sun';
  const domain = 'space_astronomy';
  
  console.time('Generation Time');
  const result = await generateTimeline(topic, domain);
  console.timeEnd('Generation Time');
  
  if (result && result.steps) {
    console.log('✅ Success! Generated', result.steps.length, 'steps.');
    console.log('First step narration:', result.steps[0].narration.substring(0, 100) + '...');
    process.exit(0);
  } else {
    console.error('❌ Failed to generate timeline.');
    process.exit(1);
  }
}

test().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
