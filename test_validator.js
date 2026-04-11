import { validateTimeline } from './server/engine/validators/index.js';

const testData = {
  elements: [
    { id: '1', type: 'orb', x: 0.5, y: 0.5, label: 'test' }
  ],
  timeline: [
    { title: 'Step 1', explanation: 'Test' }
  ]
};

try {
  console.log('Validating test data...');
  const result = validateTimeline(testData);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('CRASH DURING VALIDATION:', err);
}
