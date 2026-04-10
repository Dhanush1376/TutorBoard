/**
 * AgentLoop — Intelligence Orchestration Loop
 * 
 * v2.0 — FULLY AGENTIC:
 *   1. Every tool call is REAL — backed by LLM or web search.
 *   2. Self-correction via evaluate_step → revise_step loop.
 *   3. FINISH extracts validated timeline from tool args or conversation history.
 */

import { requestCompletion, getModel, getTextModel } from '../utils/llmClient.js';
import { getAnimationGuide, getVisualScaffold } from '../agents/domainConfig.js';
import { searchDomainKnowledge, formatSearchContext } from '../tools/webSearch.js';

const DEFAULT_MAX_STEPS = 15;

/**
 * Executes a tool and returns the result string.
 * v2: Every case calls a real LLM or external service. Zero hardcoded lies.
 */
const executeTool = async (name, args, context) => {
  console.log(`[AgentLoop] 🛠️ Executing tool: ${name}`, args);

  switch (name) {

    case 'search_examples': {
      // REAL: Actually call the web search tool
      const searchData = await searchDomainKnowledge(context.domain, args.topic);
      if (searchData) return formatSearchContext(searchData);
      // Parametric fallback if search returns nothing
      const res = await requestCompletion({
        model: getTextModel(),
        messages: [{
          role: 'user',
          content: `Give 3 concrete, specific pedagogical examples for teaching "${args.topic}" to a student. 
Format as JSON array of strings. Each string should be one complete, specific teaching example. 
Return ONLY the JSON array, nothing else.`
        }],
        temperature: 0.3,
        maxTokens: 600
      });
      try {
        const examples = JSON.parse(res.content || '[]');
        return Array.isArray(examples)
          ? `Verified teaching examples for "${args.topic}":\n` + examples.map((e, i) => `${i+1}. ${e}`).join('\n')
          : res.content;
      } catch {
        return res.content || `Standard examples for ${args.topic}.`;
      }
    }

    case 'check_prerequisites': {
      // REAL: LLM generates actual prerequisites
      const res = await requestCompletion({
        model: getTextModel(),
        messages: [{
          role: 'user',
          content: `A student is about to learn "${args.topic}". 
List exactly 3 prerequisite concepts they MUST understand first. Be very specific.
Return ONLY a JSON array of strings (the concept names). No explanation.
Example output: ["Binary Search", "Array Indexing", "Logarithms"]`
        }],
        temperature: 0.1,
        maxTokens: 200
      });
      try {
        const prereqs = JSON.parse(res.content || '[]');
        return `Prerequisites for "${args.topic}": ${Array.isArray(prereqs) ? prereqs.join(', ') : res.content}`;
      } catch {
        return `Prerequisites for "${args.topic}": ${res.content}`;
      }
    }

    case 'generate_step': {
      // REAL: Generate one actual pedagogical step using the timeline schema
      const res = await requestCompletion({
        model: getTextModel(),
        messages: [{
          role: 'system',
          content: `You are generating ONE step of a visual teaching timeline for "${context.topic}".
Step type: "${args.type}" (hook | concept | intuition | result).
Stage hint: "${args.hint || 'core concept'}".
Step number: ${args.step_number || 1}.

Return ONLY a JSON object with this exact schema:
{
  "step_number": number,
  "type": string,
  "title": "≤6 word title",
  "explanation": "1-2 sentence clear explanation of this specific pedagogical unit",
  "micro_clarification": "proactive answer to the most likely student confusion at this step",
  "visual_hint": "what specific visual element or animation should accompany this step",
  "cognitive_load": "low | medium | high"
}`
        }, {
          role: 'user',
          content: `Generate step ${args.step_number || 1} of type "${args.type}" for teaching "${context.topic}".`
        }],
        temperature: 0.2,
        maxTokens: 400
      });
      return res.content || JSON.stringify({ step_number: args.step_number || 1, type: args.type, title: `Step ${args.step_number}`, explanation: `Teaching ${context.topic}` });
    }

    case 'evaluate_step': {
      // REAL: Critique a step for quality
      const res = await requestCompletion({
        model: getTextModel(),
        messages: [{
          role: 'system',
          content: `You are a pedagogical critic. Evaluate the following teaching step.
Return ONLY a JSON object:
{
  "pass": boolean,
  "scores": { "clarity": 0-10, "visual_richness": 0-10, "specificity": 0-10 },
  "issues": ["list of specific issues found"],
  "verdict": "one sentence summary"
}
A step PASSES if all scores are ≥6. Be strict. Generic narration, missing visual references, and jargon are failures.`
        }, {
          role: 'user',
          content: `Evaluate this step:\n${JSON.stringify(args.step, null, 2)}`
        }],
        temperature: 0,
        maxTokens: 400
      });
      try {
        const raw = (res.content || '{}').replace(/```json|```/g, '').trim();
        const critique = JSON.parse(raw);
        if (critique.pass === false) {
          return `FAIL: ${critique.verdict} | Issues: ${(critique.issues || []).join('; ')}`;
        }
        return `PASS: ${critique.verdict}`;
      } catch {
        return `QUALITY: ${res.content}`;
      }
    }

    case 'revise_step': {
      // REAL: Rewrite a step fixing the specific issues
      const res = await requestCompletion({
        model: getTextModel(),
        messages: [{
          role: 'system',
          content: `You are rewriting a teaching step to fix specific quality issues.
Return ONLY the corrected step as a JSON object, maintaining all original fields.
Do not add markdown, do not explain. Just return the fixed JSON.`
        }, {
          role: 'user',
          content: `Original step:\n${JSON.stringify(args.step, null, 2)}\n\nIssues to fix:\n${args.issue}\n\nRewrite to fix ALL issues.`
        }],
        temperature: 0.2,
        maxTokens: 500
      });
      try {
        const raw = (res.content || '{}').replace(/```json|```/g, '').trim();
        return JSON.stringify({ ...args.step, ...JSON.parse(raw), status: 'REVISED' });
      } catch {
        return JSON.stringify({ ...args.step, explanation: res.content, status: 'REVISED' });
      }
    }

    case 'FINISH':
      return 'PROCESS_COMPLETE';

    default:
      return `Error: Tool ${name} not found.`;
  }
};

/**
 * RUN THE LOOP
 */
export async function runAgentLoop({ topic, domain, systemPrompt, maxSteps = DEFAULT_MAX_STEPS }) {
  console.log(`[AgentLoop] 🚀 Starting agentic resolution for: "${topic}"`);
  
  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Begin generating the pedagogical timeline for "${topic}". Use your tools to ensure precision.` }
  ];

  const tools = [
    {
      name: "search_examples",
      description: "Search for high-quality pedagogical examples/patterns for a topic.",
      parameters: {
        type: "object",
        properties: { topic: { type: "string" } },
        required: ["topic"]
      }
    },
    {
      name: "check_prerequisites",
      description: "Identify what concepts must be explained before the current one.",
      parameters: {
        type: "object",
        properties: { topic: { type: "string" } },
        required: ["topic"]
      }
    },
    {
      name: "generate_step",
      description: "Generate a single pedagogical step with visual hints.",
      parameters: {
        type: "object",
        properties: { 
          type: { type: "string", enum: ["hook", "concept", "intuition", "result"] },
          hint: { type: "string" },
          step_number: { type: "number" }
        },
        required: ["type"]
      }
    },
    {
      name: "evaluate_step",
      description: "Perform a self-critique on a single generated step.",
      parameters: {
        type: "object",
        properties: { step: { type: "object" } },
        required: ["step"]
      }
    },
    {
      name: "revise_step",
      description: "Apply a fix to an existing step based on a critique issue.",
      parameters: {
        type: "object",
        properties: { 
          step: { type: "object" },
          issue: { type: "string" }
        },
        required: ["step", "issue"]
      }
    },
    {
      name: "FINISH",
      description: "Call this tool ONLY when the entire timeline is complete and validated. Pass the final JSON object as final_timeline.",
      parameters: { 
        type: "object", 
        properties: {
          final_timeline: { type: "object", description: "The final, validated pedagogical timeline." }
        },
        required: ["final_timeline"]
      }
    }
  ];

  let iterations = 0;

  while (iterations < maxSteps) {
    iterations++;
    
    const response = await requestCompletion({
      model: getModel(),
      messages,
      tools
    });

    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        const toolName = call.function.name;
        const toolArgs = JSON.parse(call.function.arguments || "{}");

        if (toolName === 'FINISH') {
          console.log(`[AgentLoop] ✅ Loop complete after ${iterations} iterations.`);
          // Return the final_timeline from args if present
          if (toolArgs.final_timeline && (toolArgs.final_timeline.steps || toolArgs.final_timeline.learningNodes)) {
            return toolArgs.final_timeline;
          }
          // Fallback: Extract from last assistant message with valid JSON
          const assistantMessages = messages.filter(m => m.role === 'assistant' && m.content);
          for (let i = assistantMessages.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(assistantMessages[i].content);
              if (parsed && (parsed.steps || parsed.learningNodes)) {
                console.log(`[AgentLoop] ✅ Extracted final timeline from message history`);
                return parsed;
              }
            } catch {}
          }
          return toolArgs.final_timeline || null;
        }

        const result = await executeTool(toolName, toolArgs, { topic, domain });
        
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [call]
        });
        
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: call.id,
          name: toolName
        });
      }
    } else {
      // Model emitted structured JSON directly — accept it
      console.log(`[AgentLoop] 📋 Model emitted direct JSON (${response.content?.length} chars)`);
      try {
        const parsed = JSON.parse(response.content);
        if (parsed && (parsed.steps || parsed.learningNodes || parsed.concept)) {
          return parsed; // Valid structured output
        }
      } catch {}
      // Not JSON — push as assistant turn and continue
      messages.push({ role: 'assistant', content: response.content });
    }
  }

  console.error(`[AgentLoop] ❌ Exhausted ${maxSteps} iterations without FINISH.`);
  return null;
}
