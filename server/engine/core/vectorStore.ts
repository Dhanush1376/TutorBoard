import { getEmbeddings } from '../../utils/ai/llmClient.js';
import crypto from 'crypto';

export interface MemoryEntry {
  ownerId: string;
  namespace: 'session' | 'project' | 'user' | 'global';
  referenceId?: string;
  content: string;
  metadata?: any;
}

class VectorStoreService {
  constructor() {
    console.info('[VectorStore] POSTGRES_URL not set. AI Semantic Memory is disabled.');
  }

  async addMemory(entry: MemoryEntry): Promise<boolean> {
    return false;
  }

  async searchMemory(queryText: string, options: any): Promise<any[]> {
    return [];
  }

  async getLatestMemories(ownerId: string, namespace: string, limit = 10): Promise<any[]> {
    return [];
  }

  async getRAGContext(queryText: string, options: any): Promise<string> {
    return '';
  }

  async addSession(sessionId: string, summary: any, metadata: any = {}) {
    return false;
  }

  async getContextForTopic(topic: string, limit = 3, userId: string | null = null) {
    return '';
  }

  async deleteMemoryByReference(referenceId: string): Promise<void> {}

  async clearOwnerMemory(ownerId: string): Promise<void> {}
}

export default new VectorStoreService();
