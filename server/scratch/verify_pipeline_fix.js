import { SceneGraphSchema } from '../engine/validators/timelineSchema.js';

function validateSceneGraph(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Not an object'] };
  }

  // 1. Pre-Validation Normalization (Wire Fix)
  if (obj.objects && !obj.elements) obj.elements = obj.objects;
  if (obj.shapes && !obj.elements) obj.elements = obj.shapes;
  
  if (obj.steps && !obj.timeline) obj.timeline = obj.steps;
  if (obj.flow && !obj.timeline) obj.timeline = obj.flow;

  // 2. Structural Validation via Zod
  const result = SceneGraphSchema.safeParse(obj);
  const errors = [];

  if (!result.success) {
    result.error.issues.forEach(issue => {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    });
  }

  // 3. Density & Pedagogical Quality Checks
  const elements = obj.elements || obj.objects || [];
  const timeline = obj.timeline || obj.steps || [];

  if (elements.length < 1) {
    errors.push(`Visualization empty.`);
  }

  if (timeline.length < 2) {
    errors.push(`Lesson too short: Only ${timeline.length} steps.`);
  }

  return { 
    valid: errors.length === 0, 
    errors,
    data: result.success ? result.data : obj 
  };
}

// TEST CASES
const cases = [
  {
    name: "Standard Correct Schema",
    data: {
      elements: [{ id: '1', type: 'circle', x: 0.5, y: 0.5 }],
      timeline: [{ title: 'Step 1', explanation: 'Hello', objectIds: ['1'] }, { title: 'Step 2', explanation: 'Bye', objectIds: ['1'] }]
    },
    shouldPass: true
  },
  {
    name: "Key Alias (objects/steps)",
    data: {
      objects: [{ id: '1', type: 'circle', x: 0.5, y: 0.5 }],
      steps: [{ title: 'Step 1', explanation: 'Hello' }, { title: 'Step 2', explanation: 'Bye' }]
    },
    shouldPass: true
  },
  {
    name: "Minimalist Geometry (1 polygon, 2 steps)",
    data: {
      elements: [{ id: 'poly1', type: 'polygon', points: [[0,0],[1,1],[0,1]] }],
      timeline: [{ title: 'Intro', explanation: 'A triangle' }, { title: 'Outro', explanation: 'Done' }]
    },
    shouldPass: true
  },
  {
    name: "Missing Required Key (type) in element",
    data: {
      elements: [{ id: '1', x: 0.5 }], // missing type
      timeline: [{ title: 'S1' }, { title: 'S2' }]
    },
    shouldPass: false
  }
];

console.log("--- RUNNING PIPELINE VERIFICATION ---");
cases.forEach(c => {
  const result = validateSceneGraph(c.data);
  if (result.valid === c.shouldPass) {
    console.log(`✅ [${c.name}]: Passed as expected.`);
  } else {
    console.log(`❌ [${c.name}]: FAILED! Expected ${c.shouldPass}, got ${result.valid}. Errors:`, result.errors);
  }
});
