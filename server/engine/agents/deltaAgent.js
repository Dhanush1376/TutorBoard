import { requestCompletion, getTextModel } from '../../utils/ai/llmClient.js';
import { MASTER_DELTA_PROMPT, DOUBT_CLASSIFIER_PROMPT } from '../../utils/ai/deltaPrompt.js';
import { buildLLMMessages } from './BuildSystemPrompt.js';

/**
 * DeltaAgent v3.0 — Intelligent Classification & Master Delta
 */
export async function runDeltaAgent({ question, canvasState, topic, modelId, userConfig, mode = 'EXPLAIN', file = null, history = [] }) {
  try {
    console.log(`[DeltaAgent] Resolving doubt: "${question}" (Mode: ${mode})`);

    // --- Phase 1: Classification ---
    const classificationRes = await requestCompletion({
      model: modelId || getTextModel(),
      messages: [
        { role: 'system', content: DOUBT_CLASSIFIER_PROMPT },
        { role: 'user', content: question }
      ],
      temperature: 0,
      userConfig,
      taskType: 'teaching'
    });
    const category = classificationRes.content?.trim() || 'UNCLEAR';
    console.log(`[DeltaAgent] Doubt Category: ${category}`);

    const modeInstruction = mode === 'SIMPLIFY'
      ? 'The student is confused. Use the simplest possible language. Add a concrete real-world analogy. Avoid abstract notation.'
      : 'Clarify the student\'s question directly and precisely.';

    // --- Phase 2: Delta Generation ---
    const prompt = MASTER_DELTA_PROMPT({
      doubt: question,
      snapshot: canvasState || [],
      topic: `${topic} (Category: ${category})`,
      mode: mode || userConfig?.mode || 'EXPLAIN',
      instruction: modeInstruction
    });


    const llmMessages = buildLLMMessages(history, "You are the Delta Visual Intelligence Engine. Respond ONLY with valid JSON.", 10);
    llmMessages.push({ role: 'user', content: prompt });

    const res = await requestCompletion({
      model: modelId || getTextModel(),
      messages: llmMessages,
      temperature: 0.1,
      responseMimeType: 'application/json',
      userConfig,
      taskType: 'teaching',
      file
    });


    const parsed = JSON.parse(res.content || '{}');
    
    // Use the new deltaScript field directly
    let actions = parsed.deltaScript || parsed.actions || [];
    
    // --- Phase 3: Strict Validation ---
    if (actions.length > 10) {
      console.warn(`[DeltaAgent] ⚠️ Too many actions (${actions.length}). Truncating to 10.`);
      actions = actions.slice(0, 10);
    }

    const destructive = actions.some(a => ['reset', 'clear'].includes(a.cmd));
    if (destructive) {
      console.error(`[DeltaAgent] ❌ Destructive operations detected in delta. Blocking.`);
      actions = [];
    }

    return {
      answer: parsed.explanation || parsed.answer || "I'm looking into that...",
      commands: actions,
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
