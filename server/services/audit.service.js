import AuditEvent from '../models/AuditEvent.js';

/**
 * @param {any} req
 * @param {string} type
 * @param {{ actorId?: any, targetUserId?: any, target?: string, outcome?: 'success'|'failure', meta?: any }} [opts]
 *
 * Record a security event. Never throws (an audit write must not break the
 * request it describes) and never stores secrets: callers pass ids and flags.
 */
export async function audit(req, type, { actorId, targetUserId, target = '', outcome = 'success', meta = {} } = {}) {
  try {
    await AuditEvent.create({
      type,
      actorId: actorId ?? req?.user?._id ?? null,
      targetUserId: targetUserId ?? null,
      target,
      outcome,
      ip: req?.ip || '',
      requestId: req?.id || req?.requestId || '',
      meta,
    });
  } catch (err) {
    console.warn(`[Audit] failed to record ${type}: ${err.message}`);
  }
}
