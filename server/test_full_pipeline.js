import { generatePlan, generateBehavior, generateTimeline } from './engine/aiOrchestrator.js';
import sessionStore from './engine/sessionStore.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testFullPipeline() {
  const topic = "Recursion";
  console.log(`Testing Full Pipeline for topic: "${topic}"...`);
  
  try {
    const sessionId = "full-pipeline-test";
    sessionStore.create(sessionId, "test-socket");

    console.log("\n--- STAGE 1: PlannerAgent ---");
    const plan = await generatePlan(topic);
    console.log("Plan Concept:", plan.concept);

    console.log("\n--- STAGE 2: BehaviorIntelligence ---");
    const behavior = await generateBehavior(plan);
    console.log("Behavior Steps:", behavior.steps.length);
    behavior.steps.forEach(s => console.log(`  [Step ${s.step_number}] ${s.title}`));

    console.log("\n--- STAGE 3: AnimationEngine ---");
    const timeline = await generateTimeline(sessionId, topic);
    console.log("Timeline Generated Successfully!");
    console.log("Total Objects:", timeline.objects.length);
    console.log("Total Steps:", timeline.totalSteps);

  } catch (err) {
    console.error("\n❌ PIPELINE FAILED:", err.message);
  }
}

testFullPipeline();
