const { randomUUID } = require('crypto');
const { audit, logger } = require('../../lib/audit');

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  if (req.headers['x-real-ip']) return req.headers['x-real-ip'];
  if (req.headers['cf-connecting-ip']) return req.headers['cf-connecting-ip'];
  return req.ip || req.connection?.remoteAddress || null;
}

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  try {
    req.requestId = req.headers['x-request-id'] || randomUUID();
    const ip = resolveClientIp(req);
    logger.info({ reqId: req.requestId, method: req.method, url: req.originalUrl, ip }, 'incoming_request');
    req.auditMeta = {
      ip,
      userAgent: req.headers['user-agent'] || null,
    };
  } catch (err) {
    logger.error({ err: err.message }, 'request_logger_error');
  }

  res.on('finish', () => {
    try {
  const durationMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const durationMs = Math.round(durationMilliseconds * 1000) / 1000;
      const outcome = res.statusCode >= 400 ? 'failure' : 'success';
      const logPayload = {
        reqId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
  durationMs,
        ip: req.auditMeta?.ip,
      };

      logger.info(logPayload, 'request_completed');

      const shouldStoreSuccess = process.env.AUDIT_HTTP_SUCCESS === 'true';
      const shouldPersist = outcome === 'failure' || shouldStoreSuccess;

      if (shouldPersist) {
        audit({
          actorId: req.user?.sub,
          actorEmail: req.user?.email,
          action: 'http.request',
          resourceType: 'http',
          resourceId: req.requestId,
          level: outcome === 'failure' ? (res.statusCode >= 500 ? 'error' : 'warn') : 'info',
          details: logPayload,
          ip: req.auditMeta?.ip,
          userAgent: req.auditMeta?.userAgent,
          outcome,
        }).catch((err) => {
          logger.error({ err: err.message, reqId: req.requestId }, 'http_request_audit_failed');
        });
      }
    } catch (err) {
      logger.error({ err: err.message, reqId: req.requestId }, 'request_finish_error');
    }
  });

  next();
}

module.exports = { requestLogger };
