import { generatePedagogy, generateTimeline } from './engine/core/pedagogyEngine.js';
import sessionStore from './engine/core/sessionStore.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testFullOrchestration() {
  const topic = "Selection Sort";
  console.log(`Testing Optimized 2-Stage Orchestration for topic: "${topic}"...`);
  
  try {
    const sessionId = "orchestration-test";
    sessionStore.create(sessionId, "test-socket");
    
    // Simulate some user interaction
    sessionStore.addDoubt(sessionId, "What is an array?", "An array is a list...");
    sessionStore.addDoubt(sessionId, "I don't get the indexes.", "Indexes start at 0...");

    console.log("\n--- STAGE 1: Maestro Pedagogy Agent ---");
    const session = sessionStore.get(sessionId);
    const userProfile = `Target Complexity = ${session.complexityPreference}, Confusion Level = ${session.confusionIndex}/10`;
    const pedagogy = await generatePedagogy(topic, userProfile);
    console.log("Pedagogy Generated for:", pedagogy.concept);
    console.log("Learning Goal:", pedagogy.learning_goal);
    console.log("Difficulty Level:", pedagogy.difficulty_level);
    console.log("Learning Intent:", pedagogy.learning_intent);
    console.log("Total Steps Intended:", pedagogy.final_steps.length);
    pedagogy.final_steps.forEach(p => {
      console.log(`  [Step ${p.step_number}] ${p.explanation.substring(0, 40)}...`);
      console.log(`    Unit: ${p.concept_unit}`);
      console.log(`    Strategy: Intensity=${p.execution.intensity}, Pacing=${p.execution.pacing}, Mode=${p.execution.interaction}`);
    });

    console.log("\n--- STAGE 2: AnimationEngine ---");
    const timeline = await generateTimeline(sessionId, topic);
    console.log("\nSUCCESS! Optimized 2-stage orchestration complete.");
    console.log("Timeline Steps Generated:", timeline.totalSteps);

  } catch (err) {
    console.error("\n❌ ORCHESTRATION FAILED:", err.message);
  }
}

testFullOrchestration();
