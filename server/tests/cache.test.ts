import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI BEFORE importing llmClient
vi.mock('openai', () => {
  return {
    default: class OpenAI {
      embeddings: any;
      chat: any;
      constructor() {
        this.embeddings = {
          create: vi.fn().mockImplementation(async ({ input }) => {
            let vec = [0, 0, 1];
            if (input.includes('apple')) vec = [1, 0, 0];
            if (input.includes('banana')) vec = [0, 1, 0];
            return { data: [{ embedding: vec }] };
          }),
        };
        this.chat = {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: 'AI Response' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            }),
          },
        };
      }
    },
  };
});

// Now import llmClient
import { requestCompletion } from '../utils/ai/llmClient.js';

vi.mock('../utils/ai/providerFactory.js', () => ({
  createProviderClient: vi.fn(),
  executeProviderRequest: vi.fn().mockResolvedValue({ content: 'AI Response', usage: { prompt_tokens: 10, completion_tokens: 5 } }),
  calculateCost: vi.fn().mockReturnValue({ costCents: 1 }),
  estimateCost: vi.fn().mockReturnValue(1),
}));

vi.mock('../../models/UsageLog.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
    aggregate: vi.fn().mockResolvedValue([]),
  },
}));

describe('Semantic Cache Isolation (P2)', () => {
  const messages = [{ role: 'user', content: 'What is an apple? (this is long enough now)' }];
  const model = 'test-model';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('should isolate cache hits between different users', async () => {
    const userA = `user-A-${Date.now()}`;
    const userB = `user-B-${Date.now()}`;

    // 1. User A asks a question -> Cache miss
    const resA1 = await requestCompletion({
      messages,
      model,
      userConfig: { userId: userA }
    });
    expect(resA1._meta.cached).toBeFalsy();
    
    // 2. User A asks the same question -> Cache hit
    const resA2 = await requestCompletion({
      messages,
      model,
      userConfig: { userId: userA }
    });
    expect(resA2._meta.cached).toBe(true);

    // 3. User B asks the SAME question -> Cache MISS (Isolation)
    const resB1 = await requestCompletion({
      messages,
      model,
      userConfig: { userId: userB }
    });
    expect(resB1._meta.cached).toBeFalsy();
  });
});
