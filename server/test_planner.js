import { generatePlan, generateTimeline } from './engine/aiOrchestrator.js';
import sessionStore from './engine/sessionStore.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testPlanner() {
  const topic = "Recursion";
  console.log(`Testing PlannerAgent for topic: "${topic}"...`);
  
  try {
    const plan = await generatePlan(topic);
    console.log("SUCCESS! Planner Agent response:");
    console.log(JSON.stringify(plan, null, 2));

    console.log("\n--- Testing Timeline Generation ---");
    const sessionId = "test-session";
    sessionStore.create(sessionId, "test-socket");
    
    const timeline = await generateTimeline(sessionId, topic);
    console.log("SUCCESS! Timeline generated. Total steps:", timeline.totalSteps);
    console.log("Pedagogy Check:", timeline.learningNodes.map(n => n.title).join(" -> "));
  } catch (err) {
    console.error("FAILED! Error:", err.message);
  }
}

testPlanner();
