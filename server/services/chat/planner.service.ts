import { requestCompletion, getTextModel } from '../../utils/ai/llmClient.js';
import { AppError, ErrorCode } from '../../shared/errors.js';
import PromptDefender from '../../utils/ai/promptDefender.js';
import { container } from '../../core/container.js';

export interface StrategicPlan {
  educational_intent: string;
  teaching_mode: 'explain' | 'visualize' | 'simulate' | 'immersive' | 'whiteboard' | 'coding' | 'quiz';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  tone: 'teaching' | 'storytelling' | 'intuitive' | 'technical';
  sections: string[];
  tools: {
    web_search: boolean;
    rag: boolean;
    code_execution: boolean;
  };
  visualization: {
    generate: boolean;
    type: 'd3' | 'physics' | 'cinematic' | 'simulator' | 'none';
    necessity: 'none' | 'optional' | 'required';
  };
  artifacts: {
    generate: boolean;
    type: 'code' | 'ui' | 'document' | 'table' | 'diagram' | 'none';
  };
  confidence: number;
  _meta?: {
    cached?: boolean;
  };
}

const STRATEGIC_PLANNER_PROMPT = `
You are the Strategic Planner for TutorBoard AI. 
Analyze the user's message and create a comprehensive execution plan for the tutoring pipeline.

### CONTEXT
User Message:
{{PROTECTED_QUERY}}

### OBJECTIVE
Determine the best pedagogical approach, tool requirements, and visual strategy.

### OUTPUT SCHEMA (Strict JSON)
{
  "educational_intent": "string",
  "teaching_mode": "explain|visualize|simulate|immersive|whiteboard|coding|quiz",
  "complexity": "beginner|intermediate|advanced",
  "tone": "teaching|storytelling|intuitive|technical",
  "sections": ["introduction", "core_explanation", "..."],
  "tools": {
    "web_search": boolean,
    "rag": boolean,
    "code_execution": boolean
  },
  "visualization": {
    "generate": boolean,
    "type": "d3|physics|cinematic|simulator|none",
    "necessity": "none|optional|required"
  },
  "artifacts": {
    "generate": boolean,
    "type": "code|ui|document|table|diagram|none"
  },
  "confidence": 0-1
}

### RULES
1. If the query is about recent events or specific current versions, set web_search to true.
2. If the query involves algorithms, data structures, or math processes, set visualization.generate to true and necessity to required.
3. Keep sections focused (max 5).
`;

class PlannerService {
  private readonly CACHE_TTL = 3600; // 1 hour

  async generatePlan(query: string, userConfig?: any, requestId?: string): Promise<StrategicPlan> {
    const normalizedQuery = query.toLowerCase().trim().replace(/[?!.]+$/, '');
    const cacheKey = `ai:plan:v1:${Buffer.from(normalizedQuery).toString('base64').substring(0, 32)}`;

    const fetcher = async () => {
      const protectedQuery = PromptDefender.protect(query);
      const prompt = STRATEGIC_PLANNER_PROMPT.replace('{{PROTECTED_QUERY}}', protectedQuery);

      try {
        const res = await requestCompletion({
          model: 'google/gemini-2.0-flash-lite',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          responseMimeType: 'application/json',
          taskType: 'planning',
          userConfig,
          requestId,
        });

        if (res.error) {
          console.warn('[PlannerService] Planning failed, using fallback strategy');
          return this.getFallbackPlan(query);
        }

        const plan: StrategicPlan = JSON.parse(res.content || '{}');
        if (!plan.educational_intent || !plan.teaching_mode) throw new Error('Invalid plan format from AI');
        
        return plan;
      } catch (err) {
        console.error('[PlannerService] Processing error:', err);
        return this.getFallbackPlan(query);
      }
    };

    if (container.has('redis-service')) {
      try {
        return await container.resolve<any>('redis-service').getOrSet(cacheKey, fetcher, this.CACHE_TTL);
      } catch (err) {
        return fetcher();
      }
    }
    return fetcher();
  }

  private getFallbackPlan(query: string): StrategicPlan {
    const q = query.toLowerCase();
    return {
      educational_intent: 'general inquiry',
      teaching_mode: 'explain',
      complexity: 'intermediate',
      tone: 'teaching',
      sections: ['introduction', 'core_explanation', 'summary'],
      tools: {
        web_search: /\b(latest|news|current)\b/i.test(q),
        rag: true,
        code_execution: /\b(run|execute|test)\b/i.test(q),
      },
      visualization: { generate: false, type: 'none', necessity: 'none' },
      artifacts: { generate: false, type: 'none' },
      confidence: 0.1,
    };
  }
}

export default new PlannerService();
