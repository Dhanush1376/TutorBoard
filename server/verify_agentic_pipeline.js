/**
 * Agentic Pipeline Verification Tool
 * 
 * Verifies the end-to-end autonomous flow:
 * AnimationPlanner -> AgentLoop -> pedagogyEngine
 */

import { generateTimeline } from './engine/core/pedagogyEngine.js';
import sessionStore from './engine/core/sessionStore.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function runTest(topic) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 TESTING: "${topic}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const sessionId = `test-${Date.now()}`;
  sessionStore.create(sessionId, "test-user");

  try {
    const timeline = await generateTimeline(sessionId, topic, (stage) => {
      console.log(`  [Progress] ${stage}`);
    });

    console.log(`\n✅ SUCCESS!`);
    console.log(`- Title:    ${timeline.title}`);
    console.log(`- Domain:   ${timeline.domain}`);
    console.log(`- Renderer: ${timeline.renderer.toUpperCase()}`);
    console.log(`- Elements: ${timeline.elements.length}`);
    console.log(`- Steps:    ${timeline.timeline.length}`);
    
    // Check for creative freedom
    const shapes = [...new Set(timeline.elements.map(e => e.type || e.shape))];
    console.log(`- Visuals:  ${shapes.join(', ')}`);

  } catch (err) {
    console.error(`\n❌ FAILED: ${err.message}`);
  }
}

async function runVerify() {
  // Test 3 Distinct Scenarios
  await runTest("Quicksort");             // Expected: DSA / Cinematic / Precise
  await runTest("The Solar System");      // Expected: Physics / Physics / Circular/Orbital
  await runTest("The French Revolution"); // Expected: History / Narrative / Timeline
}

runVerify();
