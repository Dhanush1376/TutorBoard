import 'dotenv/config';
import { generateTimeline } from './engine/core/pedagogyEngine.js';
import sessionStore from './engine/core/sessionStore.js';

async function runTest() {
  const sessionId = 'test-session-coords';
  sessionStore.create(sessionId, 'test-socket');

  const topic = "Solar system with planets revolving around the sun";
  console.log(`\nTEST: ${topic}\n`);

  const timeline = await generateTimeline(sessionId, topic);
  
  console.log(`Steps: ${timeline.steps?.length}, Objects: ${timeline.objects?.length}\n`);
  
  // Print every object with coordinates
  timeline.objects.forEach(obj => {
    if (obj.shape === 'orbit') {
      console.log(`  ${obj.shape.padEnd(12)} id=${obj.id.padEnd(20)} cx=${obj.cx}, cy=${obj.cy}, orbitRadius=${obj.orbitRadius}, color=${obj.color}`);
    } else if (obj.shape === 'circle') {
      console.log(`  ${obj.shape.padEnd(12)} id=${obj.id.padEnd(20)} x=${obj.x}, y=${obj.y}, r=${obj.r}, color=${obj.color}`);
    } else if (obj.shape === 'text') {
      console.log(`  ${obj.shape.padEnd(12)} id=${obj.id.padEnd(20)} x=${obj.x}, y=${obj.y}, color=${obj.color}, text="${obj.text}"`);
    } else if (obj.shape === 'simpleline' || obj.shape === 'arrow') {
      console.log(`  ${obj.shape.padEnd(12)} id=${obj.id.padEnd(20)} (${obj.x1},${obj.y1})->(${obj.x2},${obj.y2}), color=${obj.color}`);
    } else {
      console.log(`  ${obj.shape.padEnd(12)} id=${obj.id.padEnd(20)} `, JSON.stringify(obj));
    }
  });
}

runTest();
