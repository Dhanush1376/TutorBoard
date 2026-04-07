import { buildLessonPrompt } from './server/engine/prompts/userPrompts.js';

try {
  const result = buildLessonPrompt({ topic: 'Sorting Algorithms' });
  console.log('Successfully built lesson prompt for "Sorting Algorithms"');
  console.log('Domain:', result.domain);
  console.log('Difficulty:', result.difficulty);
  console.log('Prompt length:', result.prompt.length);
  
  if (result.prompt.includes('{{TOPIC}}')) {
    console.error('Error: Placeholder {{TOPIC}} not replaced!');
    process.exit(1);
  }
  
  console.log('\nVerification PASSED!');
} catch (error) {
  console.error('Verification FAILED!');
  console.error(error);
  process.exit(1);
}
