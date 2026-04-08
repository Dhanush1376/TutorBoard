import { 
  generatePlan, 
  generateBehavior, 
  generateExecutionStrategy, 
  reflectAndRefine, 
  generateTimeline 
} from './engine/aiOrchestrator.js';
import sessionStore from './engine/sessionStore.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testFullCriticPipeline() {
  const topic = "Gradient Descent";
  console.log(`Testing Full 5-Stage Critic Pipeline for topic: "${topic}"...`);
  
  try {
    const sessionId = "critic-pipeline-test";
    sessionStore.create(sessionId, "test-socket");

    console.log("\n--- STAGE 1: PlannerAgent ---");
    const plan = await generatePlan(topic);

    console.log("\n--- STAGE 2: BehaviorIntelligence ---");
    const behavior = await generateBehavior(plan);

    console.log("\n--- STAGE 3: ExecutionStrategyAgent ---");
    const execution = await generateExecutionStrategy(plan, behavior);

    console.log("\n--- STAGE 4: ReflectionAgent (Critic) ---");
    const reflection = await reflectAndRefine(plan, behavior, execution);
    console.log("Status:", reflection.status);
    if (reflection.status === 'needs_improvement') {
      console.log("Issues:", reflection.issues.join(", "));
      console.log("Refined Steps:", reflection.refined_steps.length);
    }

    console.log("\n--- STAGE 5: AnimationEngine ---");
    const timeline = await generateTimeline(sessionId, topic);
    console.log("SUCCESS! Full 5-stage pipeline complete.");
    console.log("Total Steps:", timeline.totalSteps);

  } catch (err) {
    console.error("\n❌ CRITIC PIPELINE FAILED:", err.message);
  }
}

testFullCriticPipeline();
