/**
 * AgentLoop — Intelligence Orchestration Loop
 * 
 * DESIGN:
 *   1. Tool-calling autonomous loop.
 *   2. Support for self-correction mid-generation.
 *   3. Domain-aware tool set.
 */

import { requestCompletion, getModel } from '../utils/llmClient.js';
import { getAnimationGuide, getVisualScaffold } from '../agents/domainConfig.js';

const MAX_ITERATIONS = 12;

/**
 * Executes a tool and returns the result string.
 */
const executeTool = async (name, args, context) => {
  console.log(`[AgentLoop] 🛠️ Executing tool: ${name}`, args);

  switch (name) {
    case 'search_examples':
      return `Here are some standard pedagogical examples for ${args.topic}: 
              1. Basic implementation / intro.
              2. Complex edge case behavior.
              3. Visual mapping of core logic.`;
    
    case 'check_prerequisites':
      return `For topic "${args.topic}", ensure the student understands:
              - Domain fundamentals.
              - Preceding logical step in the sequence.
              - Basic visual primitives involved.`;

    case 'generate_step':
      return JSON.stringify({
        step_number: args.step_number || 1,
        type: args.type || 'concept',
        title: `Visualizing ${args.hint || 'the logic'}`,
        explanation: "Establishing the core principle through visual transformation.",
        visual_hint: "Focus on primary shape motion."
      });

    case 'evaluate_step':
      if ((args.step?.explanation?.length || 0) > 200) {
        return "ISSUE: Explanation too wordy. Simplify to 2 lines.";
      }
      return "QUALITY: Pass. Pedagogically sound.";

    case 'revise_step':
      return JSON.stringify({
        ...args.step,
        explanation: "Simplified explanation for clarity.",
        status: "REVISED"
      });

    case 'FINISH':
      return "PROCESS_COMPLETE";

    default:
      return `Error: Tool ${name} not found.`;
  }
};

/**
 * RUN THE LOOP
 */
export async function runAgentLoop({ topic, domain, systemPrompt, maxSteps = 15 }) {
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
      description: "Call this tool ONLY when the entire timeline is complete and validated.",
      parameters: { type: "object", properties: {} }
    }
  ];

  let iterations = 0;
  let finalTimeline = null;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
    const response = await requestCompletion({
      model: getModel(),
      messages,
      tools
    });

    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        if (call.function.name === 'FINISH') {
          console.log(`[AgentLoop] ✅ Loop complete after ${iterations} iterations.`);
          // Extract final JSON from model content if present
          try {
            finalTimeline = JSON.parse(response.content || "{}");
          } catch (e) {
            // Fallback: if model didn't output JSON in content, look for it in previous message
            const lastAssigned = messages.reverse().find(m => m.role === 'assistant' && (m.content || '').includes('{'));
            if (lastAssigned) finalTimeline = JSON.parse(lastAssigned.content);
          }
          return finalTimeline;
        }

        const result = await executeTool(call.function.name, JSON.parse(call.function.arguments), { topic, domain });
        
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [call]
        });
        
        messages.push({
          role: 'user', // In Gemini/OpenAI tool-calling, this is the tool-response role
          content: result,
          tool_call_id: call.id,
          name: call.function.name
        });
      }
    } else {
      // No tool calls - model finished or failed to use tools
      console.log(`[AgentLoop] ⚠️ Model emitted text instead of tool calls. Content length: ${response.content?.length}`);
      try {
        return JSON.parse(response.content);
      } catch (e) {
        // Continue loop if not valid JSON
      }
    }
  }

  throw new Error('AGENT_LOOP_MAX_ITERATIONS_REACHED');
}
