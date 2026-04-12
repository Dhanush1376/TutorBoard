/**
 * AdaptiveReplanner — Real-time Pedagogical Bridge Generator
 * 
 * TRIGGERS: 
 *   - confusionIndex >= 5
 *   - repeated doubts on same step
 * 
 * ACTION:
 *   - Regenerates REMAINING steps with higher granularity and simpler narration.
 */

import { requestCompletion, getModel } from '../utils/llmClient.js';
import { runAgentLoop } from './agentLoop.js';
import { buildTimelinePrompt } from '../agents/timelinePrompt.js';
import { getAnimationGuide, getNodeTemplates, getMinSteps } from '../agents/domainConfig.js';

export async function replanRemainingSteps(session, topic) {
  const { currentStepIndex, steps, domain, complexityPreference, confusionIndex } = session;
  
  if (currentStepIndex >= steps.length - 1) return null;

  console.log(`[Replanner] 🧠 Confusion spike (${confusionIndex}/10). Replanning remaining ${steps.length - currentStepIndex - 1} steps...`);

  const remainingStepsContext = steps.slice(currentStepIndex + 1);
  const animationGuide = getAnimationGuide(domain);
  const nodeTemplates = getNodeTemplates(domain);

  // Build a specific "Simplification" prompt
  const systemPrompt = `You are a Remedial Teaching Specialist.
Current Lesson: "${topic}"
Learner Status: CONFUSED (Level ${confusionIndex}/10).
Goal: Take the upcoming planned steps and break them down into much smaller, simpler parts.

UPCOMING PLANNED STEPS:
${JSON.stringify(remainingStepsContext)}

INSTRUCTIONS:
1. Double the number of remaining steps.
2. Use very simple language (ELI5).
3. Focus on "Why" and "How" for every small movement.
4. Ensure total continuity from current step ${currentStepIndex}.
`;

  try {
    const data = await runAgentLoop({
      topic: `${topic} (Simplified)`,
      domain,
      systemPrompt,
      maxSteps: remainingStepsContext.length * 2
    });

    if (data && (Array.isArray(data.steps) || Array.isArray(data.timeline))) {

      // Splice the new simplified steps into the session
      const originalSteps = [...session.steps];
      const previousSteps = originalSteps.slice(0, currentStepIndex + 1);
      const newSteps = data.steps.map((s, i) => ({ ...s, index: currentStepIndex + 1 + i }));
      
      const mergedSteps = [...previousSteps, ...newSteps];
      
      return {
        mergedSteps,
        originalSteps,
        notification: "I've broken down the next few steps into simpler parts to help clarify things! 👋"
      };
    }
  } catch (err) {
    console.error(`[Replanner] Error generating bridge steps:`, err.message);
  }

  return null;
}
