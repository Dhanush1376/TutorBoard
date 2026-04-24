import { requestCompletion, getTextModel } from '../../utils/ai/llmClient.js';
import { DELTA_AGENT_PROMPT } from '../../utils/ai/deltaPrompt.js';

/**
 * DeltaAgent v1.1 — Integrated API Orchestration
 * 
 * Specifically designed to handle real-time doubts by generating 
 * incremental visual/narrative changes (deltas) to the current state.
 */
export async function runDeltaAgent({ question, canvasState, topic, modelId, userConfig }) {
  try {
    console.log(`[DeltaAgent] Resolving doubt: "${question}"`);

    const userContext = userConfig ? `
STUDENT CONTEXT:
- Name: ${userConfig.nickname || userConfig.name || 'Student'}
- Role: ${userConfig.role || 'Learner'}
${userConfig.customInstructions ? `- Custom AI Behavior: ${userConfig.customInstructions}` : ''}
---
` : '';

    const res = await requestCompletion({
      model: modelId || getTextModel(),
      messages: [
        { role: 'system', content: userContext + DELTA_AGENT_PROMPT },
        { 
          role: 'user', 
          content: `
            STUDENT QUESTION: "${question}"
            CURRENT CANVAS STATE: ${JSON.stringify(canvasState || [])}
            PEDAGOGICAL CONTEXT: ${JSON.stringify({ topic })}
            
            Respond ONLY with the delta JSON.
          ` 
        }
      ],
      temperature: 0.2,
      responseMimeType: 'application/json',
      userConfig, // CRITICAL: Pass user-provided credentials
      taskType: 'teaching'
    });

    const parsed = JSON.parse(res.content || '{}');
    
    // ─── Phase 2 Fix: Validate VisualScript actions ───
    if (parsed.delta_actions || parsed.commands) {
      const { validateVisualScript } = await import('../core/visualScriptValidator.js');
      const actions = parsed.delta_actions || parsed.commands || [];
      parsed.commands = validateVisualScript(actions);
    }

    return {
      answer: parsed.answer || parsed.explanation || "I'm looking into that...",
      commands: parsed.commands || [],
      followUp: parsed.followUp || parsed.nextQuestion
    };
  } catch (err) {
    console.error(`[DeltaAgent] ❌ Execution failed:`, err);
    return {
      answer: "I'm sorry, I encountered an error while trying to clarify that. Let's continue with the main flow.",
      commands: [],
      isError: true
    };
  }
}

export const generateDelta = runDeltaAgent;
