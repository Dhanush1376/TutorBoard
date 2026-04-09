import 'dotenv/config';
import { generateTimeline } from './engine/core/pedagogyEngine.js';
import sessionStore from './engine/core/sessionStore.js';

async function runTest() {
  const sessionId = 'test-session-v5';
  sessionStore.create(sessionId, 'test-socket');

  const tests = [
    "How does the Internet work?",
    "Solar system",
    "Pythagorean theorem",
    "What is a neural network?"
  ];

  for (const topic of tests) {
    console.log("\n" + "=".repeat(60));
    console.log(`TOPIC: ${topic}`);
    console.log("=".repeat(60));

    const timeline = await generateTimeline(sessionId, topic);
    
    console.log(`Visual Type: ${timeline.visual_type || 'N/A'}`);
    console.log(`Steps: ${timeline.steps?.length}  Objects: ${timeline.objects?.length}`);
    
    // Count shape types
    const shapeCounts = {};
    timeline.objects?.forEach(o => { shapeCounts[o.shape] = (shapeCounts[o.shape] || 0) + 1; });
    console.log(`Shapes: ${Object.entries(shapeCounts).map(([k,v]) => `${k}(${v})`).join(', ')}`);
    
    // Check connections
    const arrows = timeline.objects?.filter(o => o.shape === 'arrow' || o.shape === 'simpleline') || [];
    const nodes = timeline.objects?.filter(o => ['circle', 'rect'].includes(o.shape)) || [];
    console.log(`Nodes: ${nodes.length}  Connections: ${arrows.length}`);
    
    // Print coordinates compactly
    timeline.objects?.forEach(o => {
      if (o.shape === 'orbit') {
        console.log(`  🪐 ${o.id}: cx=${o.cx} cy=${o.cy} orbit=${o.orbitRadius} color=${o.color}`);
      } else if (['circle', 'rect'].includes(o.shape)) {
        console.log(`  📦 ${o.id}: (${o.x},${o.y}) color=${o.color} label="${o.label}"`);
      } else if (o.shape === 'arrow') {
        console.log(`  ➡️  ${o.id}: (${o.x1},${o.y1})→(${o.x2},${o.y2})`);
      } else if (o.shape === 'text') {
        console.log(`  📝 ${o.id}: "${o.text}" color=${o.color}`);
      }
    });
  }
}

runTest();
