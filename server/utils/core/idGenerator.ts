/**
 * idGenerator.ts — TutorBoard v6.0
 */

export function generateMessageId(prefix: string = 'msg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
