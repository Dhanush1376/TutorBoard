import { detectTools, shouldSearch, applyPlannerOverride } from './utils/ai/searchGate.js';
import { runChatPlanner } from './engine/agents/chatPlannerAgent.js';

async function test() {
  try {
    const topic = 'Hello';
    console.log('detectTools', detectTools(topic));
    console.log('shouldSearch', shouldSearch(topic));
    console.log('Running planner...');
    const plan = await runChatPlanner(topic, '', '', null);
    console.log('Plan:', plan);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
