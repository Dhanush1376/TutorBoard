/**
 * TypeScript definitions for the AgentLoop pipeline
 */

export interface PipelineState {
  tokens_in: number;
  tokens_out: number;
  total_cost_cents: number;
  topic: string;
}

export interface LearnerProfile {
  level: string;
  confusionIndex: number;
  prior_mastery: Record<string, number>;
  learning_style: string;
  past_context: string;
  weak_areas: string[];
  history?: any[];
  reinforcementTopics?: string[];
}

export interface runStageParams {
  stageName: string;
  prompt: string;
  input: any;
  model?: string;
  onProgress: (stage: string, data?: any) => void;
  userConfig?: any;
  onStream?: (chunk: string) => void;
  signal?: AbortSignal;
  requiredKeys?: string[];
  pipelineState?: PipelineState;
  requestId?: string;
  responseSchema?: any;
}

export interface AgentLoopParams {
  topic: string;
  domain: string;
  model?: string;
  onProgress?: (stage: string, data?: any) => void;
  systemPrompt?: string;
  maxSteps?: number;
  planningResult?: any;
  userConfig?: any;
  learnerProfile?: LearnerProfile;
  file?: any;
  signal?: AbortSignal;
  socket?: any;
  requestId?: string;
}
