/**
 * dto/index.ts — TutorBoard Data Transfer Objects
 * 
 * Wire format definitions for API responses.
 * Prevents raw MongoDB documents from leaking to the frontend.
 * 
 * Usage:
 *   import { toSessionDTO, toMessageDTO } from '../dto/index.js';
 *   res.json(toSessionDTO(session));
 */

// ── Session DTO ───────────────────────────────────────────────────────────────

export interface SessionDTO {
  id: string;
  title: string;
  mode: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toSessionDTO(doc: any): SessionDTO {
  return {
    id: doc._id?.toString() || doc.id,
    title: doc.title || 'New Chat',
    mode: doc.mode || null,
    messageCount: doc.messages?.length || 0,
    lastMessageAt: doc.messages?.length
      ? doc.messages[doc.messages.length - 1]?.timestamp?.toISOString?.() || null
      : null,
    createdAt: doc.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

// ── Message DTO ───────────────────────────────────────────────────────────────

export interface MessageDTO {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    hasCanvas?: boolean;
    canvasType?: string;
    feedback?: 'positive' | 'negative' | null;
    versions?: number;
    activeVersionIndex?: number;
    edited?: boolean;
  };
  sources?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

export function toMessageDTO(msg: any): MessageDTO {
  return {
    id: msg.id || msg._id?.toString(),
    role: msg.role,
    content: msg.content || '',
    timestamp: msg.timestamp?.toISOString?.() || new Date().toISOString(),
    metadata: msg.metadata ? {
      model: msg.metadata.model,
      tokens: msg.metadata.tokens,
      hasCanvas: msg.metadata.hasCanvas,
      canvasType: msg.metadata.canvasType,
      feedback: msg.metadata.feedback || null,
      versions: msg.metadata.versions?.length || 0,
      activeVersionIndex: msg.metadata.activeVersionIndex ?? 0,
      edited: msg.metadata.edited || false,
    } : undefined,
    sources: msg.metadata?.sources?.map((s: any) => ({
      title: s.title || s.name || '',
      url: s.url || s.link || '',
      snippet: s.snippet || s.description || '',
    })) || undefined,
  };
}

// ── User DTO ──────────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isGuest: boolean;
  provider?: string;
  createdAt: string;
}

export function toUserDTO(doc: any): UserDTO {
  return {
    id: doc._id?.toString() || doc.id,
    name: doc.name || 'User',
    email: doc.email || '',
    avatar: doc.avatar || doc.profileImage || undefined,
    isGuest: doc.isGuest || false,
    provider: doc.googleId ? 'google' : doc.githubId ? 'github' : 'email',
    createdAt: doc.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}

// ── Timeline / Teaching DTO ───────────────────────────────────────────────────

export interface TimelineStepDTO {
  index: number;
  title: string;
  narration: string;
  objects: any[];
  connections: any[];
  motion: any[];
}

export interface TimelineDTO {
  sessionId: string;
  topic: string;
  domain: string;
  steps: TimelineStepDTO[];
  totalSteps: number;
  metadata: {
    model: string;
    totalTokens: number;
    generationTimeMs: number;
  };
}

export function toTimelineDTO(data: any): TimelineDTO {
  return {
    sessionId: data.sessionId || '',
    topic: data.topic || '',
    domain: data.domain || 'general',
    steps: (data.steps || []).map((step: any, i: number) => ({
      index: i,
      title: step.stepTitle || step.title || `Step ${i + 1}`,
      narration: step.narration || step.explanation || '',
      objects: step.objects || step.elements || [],
      connections: step.connections || [],
      motion: step.motion || [],
    })),
    totalSteps: data.steps?.length || 0,
    metadata: {
      model: data._meta?.model || 'unknown',
      totalTokens: data._meta?.totalTokens || 0,
      generationTimeMs: data._meta?.generationTimeMs || 0,
    },
  };
}
