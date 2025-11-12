const { prisma } = require('../prisma');
const pino = require('pino');

// Centralized logger for audit trail (structured)
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Persists an audit event to database and outputs to log stream.
 * Sensitive fields (password/token) are removed automatically.
 */
async function audit({
  actorId,
  actorEmail,
  action,
  resourceType,
  resourceId,
  level = 'info',
  details = {},
  ip,
  userAgent,
  outcome = 'success',
}) {
  try {
    const safeDetails = { ...details };
    if (safeDetails.password) delete safeDetails.password;
    if (safeDetails.token) delete safeDetails.token;
    if (safeDetails.refreshToken) delete safeDetails.refreshToken;

    logger.info({ actorId, actorEmail, action, resourceType, resourceId, outcome, ip }, 'audit');

    await prisma.audit_logs.create({
      data: {
        actor_id: actorId ?? null,
        actor_email: actorEmail ?? null,
        action,
        resource_type: resourceType ?? null,
        resource_id: resourceId != null ? String(resourceId) : null,
        level,
        details: Object.keys(safeDetails).length ? safeDetails : undefined,
        ip: ip ?? null,
        user_agent: userAgent ?? null,
        outcome,
      },
    });
  } catch (err) {
    logger.error({ err: err.message, action, actorId }, 'audit_failed');
  }
}

module.exports = { audit, logger };
