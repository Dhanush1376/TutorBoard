import { requestCompletion, getModel, resolveModelId } from '../../utils/ai/llmClient.js';

const CLASSIFIER_PROMPT = `
You are an artifact type classifier for a visual learning platform.

Given a user message, output a JSON object with:
{
  "artifactClass": one of [flowchart, system_architecture, mindmap, timeline, kanban,
                            erd, uml, infographic, wireframe, chart, table, whiteboard,
                            roadmap, network, tree, concept_map, presentation, dashboard,
                            code, document, ui_mockup],
  "isVisual": true/false,
  "confidence": 0-1,
  "title": "short artifact title",
  "hint": "one sentence describing what to generate"
}

Only output JSON. No explanation.
`.trim();

/**
 * Classify the user intent into an artifact type
 * @param {string} userMessage 
 * @returns {Promise<Object>}
 */
export async function classifyArtifact(userMessage) {
  const result = await requestCompletion({
    model: resolveModelId(getModel()), // Using standard model for classification
    messages: [
      { role: 'system', content: CLASSIFIER_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    maxTokens: 300,
    taskType: 'classification',
    responseMimeType: 'application/json'
  });

  try {
    const content = result.content.trim();
    // Some models might wrap in markdown blocks
    const jsonStr = content.startsWith('```json') 
      ? content.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      : content;
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[ArtifactClassifier] Failed to parse JSON:', err);
    return { artifactClass: 'document', isVisual: false, confidence: 0.3, title: 'Document', hint: 'Generate a document' };
  }
}
