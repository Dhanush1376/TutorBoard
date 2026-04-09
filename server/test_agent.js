import 'dotenv/config';
import { generateTimeline } from './engine/core/pedagogyEngine.js';
import sessionStore from './engine/core/sessionStore.js';

async function runTest() {
  const sessionId = 'test-session-123';
  sessionStore.create(sessionId, 'test-socket');

  console.log("==========================================");
  console.log("TEST 1: DSA - Explain Bubble Sort on [5,3,8,1]");
  console.log("==========================================");
  
  try {
    const dsaTimeline = await generateTimeline(sessionId, "Explain Bubble Sort on [5,3,8,1]");
    console.log("Timeline generated successfully. Total steps:", dsaTimeline?.steps?.length);
    console.log("Shapes:", dsaTimeline?.objects?.map(o => o.shape).join(", "));
    console.log("Sample Step 1 Context Updates:", JSON.stringify(dsaTimeline?.steps?.[0]?.contextUpdates));
  } catch (err) {
    console.error("DSA Test Failed:", err);
  }

  console.log("\n==========================================");
  console.log("TEST 2: Math - Graph y = x² - 4");
  console.log("==========================================");
  try {
    const mathTimeline = await generateTimeline(sessionId, "Graph y = x² - 4");
    console.log("Timeline generated successfully. Total steps:", mathTimeline?.steps?.length);
    console.log("Shapes:", mathTimeline?.objects?.map(o => o.shape).join(", "));
  } catch (err) {
    console.error("Math Test Failed:", err);
  }
}

runTest();
