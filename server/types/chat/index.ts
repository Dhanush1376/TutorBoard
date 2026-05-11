export type ChatMode = 'quick' | 'deep' | 'test_me' | 'explain';
export type ExplanationMode = 'basic' | 'advanced';
export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';

export interface TeachingContext {
  currentTopic?: string;
  explanationMode?: ExplanationMode;
  learnerLevel?: LearnerLevel;
}

export interface PlannerPlan {
  content_type: string;
  complexity: string;
  tone: string;
  intent: string;
  sections: string[];
  use_table: boolean;
  use_formula: boolean;
  use_code_block: boolean;
  generate_artifact: boolean;
  artifact_type?: string;
  artifact_count?: number;
  artifact_types?: string[];
  canvas_type?: string;
  tools?: {
    web_search?: boolean;
    data_analysis?: boolean;
  };
}

export interface UserConfig {
  preferredModel?: string;
  // Add other fields as needed
}

export interface MessageMetadata {
  edited: boolean;
  regenerated: boolean;
  feedback: 'positive' | 'negative' | null;
  sources?: any[];
  thought?: string;
  versions: Array<{ text: string; subsequentMessages: string[] }>;
  activeVersionIndex: number;
}

export interface ChatMessage {
  _id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: MessageMetadata;
}
