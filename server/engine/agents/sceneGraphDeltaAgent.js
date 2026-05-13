import { requestCompletion, getModel, resolveModelId } from '../../utils/ai/llmClient.js';

const DELTA_SYSTEM = (sceneGraph) => `
You are a scene graph editor for a visual learning platform. 
The current scene graph is provided below.

Current Scene Graph:
${JSON.stringify(sceneGraph, null, 2)}

The user wants to modify this artifact. Output ONLY a JSON delta object:

{
  "ops": [
    { "type": "update_element", "id": "el_XXXXX", "changes": { ...partial SceneElement } },
    { "type": "add_element", "element": { ...full SceneElement without id } },
    { "type": "remove_element", "id": "el_XXXXX" },
    { "type": "add_connection", "connection": { ...SceneConnection without id } },
    { "type": "remove_connection", "id": "edge_XXXXX" },
    { "type": "update_connection", "id": "edge_XXXXX", "changes": { ... } },
    { "type": "update_layout", "changes": { ... } },
    { "type": "update_theme", "changes": { ... } }
  ],
  "summary": "one line describing what changed"
}

Rules:
- NEVER rewrite the entire graph. Only output the minimum ops needed to achieve the user's goal.
- Resolve natural language references using element labels, tags, and subtypes.
- If the user says "the blue card", find elements where style.fill is a blue hex.
- If the user says "backend section", find elements tagged 'backend'.
- Output only valid JSON. No explanation.
`.trim();

/**
 * Generate a delta (patch) for an existing scene graph based on user instruction
 * @param {string} instruction 
 * @param {Object} sceneGraph 
 * @returns {Promise<Object>}
 */
export async function generateDelta(instruction, sceneGraph) {
  const result = await requestCompletion({
    model: resolveModelId(getModel()),
    messages: [
      { role: 'system', content: DELTA_SYSTEM(sceneGraph) },
      { role: 'user', content: instruction },
    ],
    temperature: 0.1,
    maxTokens: 2000,
    taskType: 'edit',
    responseMimeType: 'application/json'
  });

  try {
    const content = result.content.trim();
    const jsonStr = content.startsWith('```json') 
      ? content.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      : content;
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[SceneGraphDeltaAgent] Failed to parse JSON:', err);
    throw new Error('Failed to generate edit delta');
  }
}
