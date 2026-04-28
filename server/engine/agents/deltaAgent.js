import { requestCompletion, getTextModel } from '../../utils/ai/llmClient.js';
import { MASTER_DELTA_PROMPT, DOUBT_CLASSIFIER_PROMPT } from '../../utils/ai/deltaPrompt.js';

/**
 * DeltaAgent v3.0 — Intelligent Classification & Master Delta
 */
export async function runDeltaAgent({ question, canvasState, topic, modelId, userConfig, file = null }) {
  try {
    console.log(`[DeltaAgent] Resolving doubt: "${question}"`);

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

    // --- Phase 2: Delta Generation ---
    const prompt = MASTER_DELTA_PROMPT({
      doubt: question,
      snapshot: canvasState || [],
      topic: `${topic} (Category: ${category})`
    });


    const res = await requestCompletion({
      model: modelId || getTextModel(),
      messages: [
        { role: 'system', content: "You are the Delta Visual Intelligence Engine. Respond ONLY with valid JSON." },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      responseMimeType: 'application/json',
      userConfig,
      taskType: 'teaching',
      file
    });


    const parsed = JSON.parse(res.content || '{}');
    
    // ─── Phase 2: Map actions to VisualScript commands ───
    let actions = parsed.actions || parsed.delta_actions || parsed.commands || [];
    
    // Map new schema (type/target) to internal schema (action/id) for validator & interpreter
    actions = actions.map(a => ({
      id: a.target || a.id,
      action: a.type || a.action,
      duration: a.duration ?? 0.5,
      props: a.meta || a.props || {},
      delay: a.delay ?? 0
    }));

    // --- Phase 3: Strict Validation ---
    if (actions.length > 5) {
      console.warn(`[DeltaAgent] ⚠️ Too many actions (${actions.length}). Truncating to 5.`);
      actions = actions.slice(0, 5);
    }

    const destructive = actions.some(a => ['removeAllNodes', 'resetCanvas'].includes(a.action));
    if (destructive) {
      console.error(`[DeltaAgent] ❌ Destructive operations detected. Blocking delta.`);
      actions = [];
    }

    if (actions.length > 0) {
      const { validateVisualScript } = await import('../core/visualScriptValidator.js');
      actions = validateVisualScript(actions);
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
