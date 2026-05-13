import { BaseRepository } from './base.repository.js';
import ChatMessage from '../models/ChatMessage.js';

class MessageRepository extends BaseRepository<any> {
  constructor() {
    super(ChatMessage);
  }

  /**
   * Update message metadata (feedback, versions, etc.)
   */
  async updateMetadata(messageId: string, metadata: Record<string, any>) {
    const update: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      update[`metadata.${key}`] = value;
    }
    return this.model.findByIdAndUpdate(messageId, { $set: update }, { returnDocument: 'after' });
  }

  /**
   * Soft delete or remove message
   */
  async deleteMessage(messageId: string) {
    return this.model.findByIdAndDelete(messageId);
  }

  /**
   * Truncate history after a certain message (useful for "Edit" feature)
   */
  async deleteMessagesAfter(sessionId: string, timestamp: Date) {
    return this.model.deleteMany({
      sessionId,
      timestamp: { $gt: timestamp }
    });
  }

  /**
   * Add a new version to an existing message (Regenerate flow)
   */
  async addVersion(messageId: string, content: string, metadata: any = {}) {
    const message = await this.model.findById(messageId);
    if (!message) throw new Error('Message not found');

    const versions = message.metadata?.versions || [];
    
    // If versions is empty, the current content becomes version 0
    if (versions.length === 0) {
      versions.push({
        content: message.content,
        text: message.content,
        timestamp: message.timestamp || new Date(),
        metadata: { ...message.metadata, versions: undefined, activeVersionIndex: undefined } 
      });
    }

    const newVersionIndex = versions.length;
    versions.push({
      content,
      text: content,
      timestamp: new Date(),
      metadata
    });

    return this.model.findByIdAndUpdate(messageId, {
      $set: {
        content,
        'metadata.versions': versions,
        'metadata.activeVersionIndex': newVersionIndex,
        'metadata.regenerated': true
      }
    }, { returnDocument: 'after' });
  }

  /**
   * Find by ID with session validation
   */
  async findInSession(messageId: string, sessionId: string) {
    return this.model.findOne({ _id: messageId, sessionId });
  }

  /**
   * Find the first message in a session chronologically
   */
  async findFirstInSession(sessionId: string) {
    return this.model.findOne({ sessionId }).sort({ timestamp: 1 });
  }
}

export default new MessageRepository();
