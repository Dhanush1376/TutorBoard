import { requestCompletion, getModel } from './engine/utils/llmClient.js';
import { validatePedagogyResponse } from './engine/validators/maestroValidator.js';

async function testOpenRouterMigration() {
  console.log('🚀 TESTING OPENROUTER MIGRATION...');
  console.log(`Using model: ${getModel()}`);

  const testMessages = [
    { role: 'system', content: 'You are a minimalist pedagogical AI. Output only valid JSON.' },
    { role: 'user', content: 'Explain the basic logic of Selection Sort for a beginner. Decompose into at least 10 steps.' }
  ];

  try {
    console.log('--- CALLING OPENROUTER ---');
    const response = await requestCompletion({
      model: getModel(),
      messages: testMessages,
      responseMimeType: 'application/json'
    });

    console.log('--- RESPONSE RECEIVED ---');
    console.log(response.content);

    try {
      const data = JSON.parse(response.content);
      console.log('✅ JSON Parsing: SUCCESS');
      
      const val = validatePedagogyResponse(data);
      if (val.valid) {
        console.log(`✅ Pedagogy Validation: SUCCESS (${data.steps.length} steps found)`);
      } else {
        console.warn('❌ Pedagogy Validation: FAILED');
        console.warn(val.errors);
      }
    } catch (e) {
      console.error('❌ JSON Parsing: FAILED');
      console.error(response.content);
    }

  } catch (err) {
    console.error('❌ FATAL TEST ERROR:', err);
  }
}

testOpenRouterMigration();
