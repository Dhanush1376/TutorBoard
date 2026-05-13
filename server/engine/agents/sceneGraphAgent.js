import { requestCompletion, getModel, resolveModelId } from '../../utils/ai/llmClient.js';

const SCENE_GRAPH_SYSTEM = (artifactClass) => `
You are a visual scene graph generator for ${artifactClass} diagrams.

Output ONLY a valid JSON SceneGraph object. No markdown. No explanation.

Rules:
- Every element MUST have a unique stable "id" (format: el_XXXXX)
- Every connection MUST reference valid source/target element ids
- Assign semantic "tags" to elements: e.g. ["database"], ["auth"], ["backend"]
- Assign meaningful "subtype" values relevant to the diagram class
- Use hex colors for all style values
- Position elements in a logical spatial layout (x/y in range 0–1200)
- Include layout.direction if applicable (e.g. 'LR', 'TB')
- Ensure visual harmony and professional aesthetics (dark mode friendly)

SceneGraph schema:
{
  "artifactId": "auto",
  "artifactClass": "${artifactClass}",
  "title": "...",
  "elements": [
    {
      "id": "el_1",
      "type": "node",
      "subtype": "...",
      "label": "...",
      "position": { "x": 100, "y": 100 },
      "dimensions": { "width": 160, "height": 60 },
      "style": { "fill": "#1e293b", "stroke": "#3b82f6", "textColor": "#ffffff" },
      "tags": ["..."]
    }
  ],
  "connections": [
    {
      "id": "edge_1",
      "source": "el_1",
      "target": "el_2",
      "label": "...",
      "style": { "strokeColor": "#64748b", "animated": false }
    }
  ],
  "layout": { "direction": "LR", "spacing": 80, "viewport": { "x": 0, "y": 0, "zoom": 1 } },
  "theme": { "background": "#0f172a", "fontFamily": "Inter", "primaryColor": "#3b82f6", "accentColor": "#8b5cf6" },
  "metadata": {},
  "version": 1
}
`.trim();

/**
 * Generate a complete scene graph for a given artifact class
 * @param {string} userMessage 
 * @param {string} artifactClass 
 * @returns {Promise<Object>}
 */
export async function generateSceneGraph(userMessage, artifactClass) {
  const result = await requestCompletion({
    model: resolveModelId(getModel()),
    messages: [
      { role: 'system', content: SCENE_GRAPH_SYSTEM(artifactClass) },
      { role: 'user', content: `Generate a ${artifactClass} for: ${userMessage}` },
    ],
    temperature: 0.2,
    maxTokens: 4000,
    taskType: 'generation',
    responseMimeType: 'application/json'
  });

  try {
    const content = result.content.trim();
    const jsonStr = content.startsWith('```json') 
      ? content.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      : content;
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[SceneGraphAgent] Failed to parse JSON:', err);
    throw new Error('Failed to generate visual scene graph');
  }
}
