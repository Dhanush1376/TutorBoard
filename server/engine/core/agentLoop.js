/**
 * AgentLoop v4.0 — Autonomous Pedagogical Scene Graph Generator
 * 
 * ARCHITECTURE (v4 rewrite):
 *   The previous multi-tool agent loop was fundamentally broken:
 *   - The orchestrating LLM called tools, each making SEPARATE LLM calls
 *   - The `animate_for_concept` tool had a tiny prompt with no domain context
 *   - The LLM never called FINISH, exhausting iterations → fallback orb
 *   - 6-12 LLM calls per request, burning tokens and time
 * 
 *   v4 uses a streamlined 3-phase architecture:
 *   Phase 1: GENERATE — Single powerful LLM call with full context → scene graph
 *   Phase 2: VALIDATE — Structural validity check
 *   Phase 3: REFINE   — If invalid, ONE retry with error feedback
 * 
 *   Result: 1-2 LLM calls max, full context, rich output, no FINISH bug.
 */

import { requestCompletion, getModel, getTextModel } from '../utils/llmClient.js';
import { getAnimationGuide, getVisualScaffold } from '../agents/domainConfig.js';
import { searchDomainKnowledge, formatSearchContext } from '../tools/webSearch.js';
import { safeParse } from '../utils/parser.js';
import { circuitBreaker } from './circuitBreaker.js';

// ─── Robust JSON Extractor ───────────────────────────────────────────────────
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  let cleaned = text.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) { /* fall through */ }

  // Find the outermost JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch (_) { /* fall through */ }
  }

  // Last resort: try to find JSON within the text using regex
  const jsonMatch = cleaned.match(/\{[\s\S]*"elements"[\s\S]*"timeline"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (_) { /* fall through */ }
  }

  return null;
}

// ─── Scene Graph Validator ───────────────────────────────────────────────────
function validateSceneGraph(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Not an object'] };
  }

  const errors = [];
  const elements = obj.elements || obj.objects || obj.nodes || [];
  const timeline = obj.timeline || obj.steps || [];

  if (!Array.isArray(elements) || elements.length === 0) {
    errors.push('Missing or empty "elements" array. Need at least 3-5 visual elements.');
  }

  if (!Array.isArray(timeline) || timeline.length === 0) {
    errors.push('Missing or empty "timeline" array. Need at least 4-6 steps.');
  }

  if (elements.length < 3) {
    errors.push(`Only ${elements.length} elements. Need at least 3-5 for a meaningful visualization.`);
  }

  if (timeline.length < 3) {
    errors.push(`Only ${timeline.length} steps. Need at least 4-6 steps for clear concept progression.`);
  }

  // Check element structure
  for (const el of elements) {
    if (!el || !el.id) {
      errors.push('Found element without an "id" field.');
      break;
    }
    if (el.x === undefined || el.y === undefined) {
      errors.push(`Element "${el.id}" missing x/y coordinates.`);
    }
  }

  // Check timeline structure
  for (const step of timeline) {
    if (!step) continue;
    if (!step.title && !step.label) {
      errors.push('Found timeline step without a "title".');
      break;
    }
    if (!step.explanation && !step.narration) {
      errors.push('Found timeline step without "explanation" or "narration".');
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Build the Generation Prompt ─────────────────────────────────────────────
function buildGenerationPrompt(topic, domain, planningResult, systemPrompt, researchContext) {
  // The systemPrompt (from unifiedPrompt.js) already contains:
  // - The full thinking framework (Understand → Classify → Decompose → Design → Generate)
  // - Shape vocabulary, color palette, coordinate rules
  // - Output JSON schema with examples
  // - Strict rules against generic output
  //
  // We just need to add the specific topic directive and any research context.
  
  const researchBlock = researchContext 
    ? `\nGROUNDING DATA (use this for factual accuracy):\n${researchContext}\n`
    : '';

  return `${systemPrompt}
${researchBlock}
NOW: Apply the 5-step thinking process to "${topic}" (Domain: ${domain}).
Analyze what this topic truly requires, then produce the scene graph.
Return ONLY the raw JSON object.`;
}


// ─── Main Autonomous Loop ────────────────────────────────────────────────────
export async function runAgentLoop({ topic, domain, systemPrompt, maxSteps = 3, planningResult, onProgress = () => {} }) {
  console.log(`[AgentLoop] 🚀 Autonomous generation for: "${topic}"`);

  // ── Phase 0: Optional Research (for factual domains) ──────────────────────
  let researchContext = null;
  try {
    onProgress('Gathering domain knowledge...');
    const searchData = await searchDomainKnowledge(domain, topic);
    if (searchData) {
      researchContext = formatSearchContext(searchData);
      console.log(`[AgentLoop] 📚 Research context acquired (${researchContext.length} chars)`);
    }
  } catch (err) {
    console.warn(`[AgentLoop] ⚠️ Research phase failed (non-fatal): ${err.message}`);
  }

  // ── Phase 1: GENERATE — Single powerful LLM call ──────────────────────────
  onProgress('Designing visual scene graph...');
  console.log(`[AgentLoop] 🎨 Phase 1: Generating scene graph...`);

  const generationPrompt = buildGenerationPrompt(topic, domain, planningResult, systemPrompt, researchContext);

  let sceneGraph = null;
  let lastErrors = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Reset circuit breaker before each attempt (402 credits error trips it)
      circuitBreaker.reset('openrouter');

      const messages = [
        { role: 'system', content: generationPrompt }
      ];

      // Adaptive token budget: smaller on retry to fit credit limits
      const tokenBudget = attempt === 1 ? 2000 : 1500;

      // On retry, add the error feedback
      if (attempt > 1 && lastErrors.length > 0) {
        onProgress('Refining scene graph...');
        console.log(`[AgentLoop] 🔄 Phase 3: Retry with feedback...`);
        messages.push({
          role: 'user', 
          content: `Your previous scene graph had these issues:\n${lastErrors.map(e => `- ${e}`).join('\n')}\n\nPlease fix these and generate a COMPLETE, VALID scene graph for "${topic}". Return ONLY raw JSON.`
        });
      } else {
        messages.push({
          role: 'user',
          content: `Generate the complete visual animation scene graph for "${topic}". Return ONLY the raw JSON object.`
        });
      }

      const response = await requestCompletion({
        model: getModel(),
        messages,
        temperature: 0.4,
        maxTokens: tokenBudget
      });

      console.log(`[AgentLoop] 📦 Raw response length: ${(response.content || '').length} chars`);

      // ── Phase 2: VALIDATE ─────────────────────────────────────────────────
      const parsed = extractJSON(response.content);

      if (!parsed) {
        console.warn(`[AgentLoop] ⚠️ Attempt ${attempt}: Failed to extract JSON from response`);
        lastErrors = ['Response was not valid JSON. Return ONLY a raw JSON object with "elements" and "timeline" arrays.'];
        continue;
      }

      const validation = validateSceneGraph(parsed);

      if (validation.valid) {
        sceneGraph = parsed;
        console.log(`[AgentLoop] ✅ Valid scene graph on attempt ${attempt}: ${(parsed.elements || parsed.objects || []).length} elements, ${(parsed.timeline || parsed.steps || []).length} steps`);
        break;
      } else {
        console.warn(`[AgentLoop] ⚠️ Attempt ${attempt} validation failed:`, validation.errors);
        lastErrors = validation.errors;
        
        // Even if validation found issues, if we have SOME data, keep it as backup
        if ((parsed.elements || parsed.objects) && (parsed.timeline || parsed.steps)) {
          sceneGraph = parsed; // Keep as fallback in case retry also fails
        }
      }

    } catch (err) {
      console.error(`[AgentLoop] ❌ Attempt ${attempt} error: ${err.message}`);
      lastErrors = [`LLM call failed: ${err.message}`];
    }
  }

  if (sceneGraph) {
    console.log(`[AgentLoop] 🎬 Returning scene graph for "${topic}"`);
    return sceneGraph;
  }

  console.warn(`[AgentLoop] ❗ All attempts failed for "${topic}". Returning null.`);
  return null;
}
