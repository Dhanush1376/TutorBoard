import { requestCompletion, getTextModel } from '../../utils/ai/llmClient.js';
import { DELTA_AGENT_PROMPT } from '../../utils/ai/deltaPrompt.js';

/**
 * DeltaAgent v1.0
 * 
 * Specifically designed to handle real-time doubts by generating 
 * incremental visual/narrative changes (deltas) to the current state.
 */
export async function runDeltaAgent(question, currentState, context) {
  try {
    console.log(`[DeltaAgent] Resolving doubt: "${question}"`);

    const res = await requestCompletion({
      model: getTextModel(),
      messages: [
        { role: 'system', content: DELTA_AGENT_PROMPT },
        { 
          role: 'user', 
          content: `
            STUDENT QUESTION: "${question}"
            CURRENT CANVAS STATE: ${JSON.stringify(currentState)}
            PEDAGOGICAL CONTEXT: ${JSON.stringify(context)}
            
            Respond ONLY with the delta JSON.
          ` 
        }
      ],
      temperature: 0.2,
      responseMimeType: 'application/json'
    });

    return JSON.parse(res.content || '{}');
  } catch (err) {
    console.error(`[DeltaAgent] ❌ Execution failed:`, err);
    return {
      explanation: "I'm sorry, I encountered an error while trying to clarify that. Let's continue with the main flow.",
      delta_actions: [],
      pathway: 'clarification'
    };
  }
}

export const generateDelta = runDeltaAgent;
