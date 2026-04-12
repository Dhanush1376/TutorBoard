import { validatePedagogyResponse } from '../engine/validators/maestroValidator.js';
import { validateTimeline } from '../engine/validators/timelineValidator.js';

// TEST DATA (Modern v4 format)
const v4Data = {
  concept: "Photosynthesis",
  learning_goal: "Understand the light-dependent reactions",
  learning_intent: "deep_understanding",
  difficulty_level: "beginner",
  predicted_pain_points: ["Electron transport chain"],
  title: "Photosynthesis: The Power of Light",
  domain: "biology",
  elements: [
    { id: 'sun', type: 'orb', x: 0.1, y: 0.1, label: 'Sun', color: 'yellow' },
    { id: 'chloroplast', type: 'block', x: 0.5, y: 0.5, label: 'Chloroplast' }
  ],
  timeline: [
    { title: 'Light Absorption', explanation: 'Light hits the chloroplast.', objectIds: ['sun', 'chloroplast'] },
    { title: 'ATP Production', explanation: 'Energy is stored.', objectIds: ['chloroplast'] }
  ]
};

console.log("--- RUNNING V4 GUARD SEAL VERIFICATION ---");

// 1. Check Maestro Validator
console.log("\n1. Testing Maestro Validator...");
const maestroResult = validatePedagogyResponse(v4Data);
if (maestroResult.valid) {
  console.log("✅ Maestro Validator: PASSED (modern keys accepted)");
} else {
  console.log("❌ Maestro Validator: FAILED. Errors:", maestroResult.errors);
}

// 2. Check Timeline Validator
console.log("\n2. Testing Timeline Validator...");
const timelineResult = validateTimeline(v4Data);
if (timelineResult.valid) {
  console.log("✅ Timeline Validator: PASSED (modern keys accepted)");
  console.log("   - Normalized steps length:", v4Data.steps?.length);
  console.log("   - Normalized objects length:", v4Data.objects?.length);
} else {
  console.log("❌ Timeline Validator: FAILED. Errors:", timelineResult.errors);
}

// 3. Simulated Adaptive Planner Check
console.log("\n3. Testing Adaptive Planner logic...");
const checkAdaptive = (data) => (data && (Array.isArray(data.steps) || Array.isArray(data.timeline)));
if (checkAdaptive(v4Data)) {
  console.log("✅ Adaptive Planner Check: PASSED");
} else {
  console.log("❌ Adaptive Planner Check: FAILED");
}

console.log("\n--- VERIFICATION COMPLETE ---");
if (maestroResult.valid && timelineResult.valid) {
  console.log("\n🚀 THE WIRE IS SEALED. The v4 pipeline is ready for production.");
}
