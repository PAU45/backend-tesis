const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireRole } = require('../secure/requireRole');
const { audit } = require('../../lib/audit');

const router = Router();

router.get('/', requireAuth, requireRole(['admin', 'auditor']), async (req, res, next) => {
  try {
    const {
      actor_id: actorIdParam,
      actor_email: actorEmail,
      action,
      resource_type: resourceType,
      level,
      outcome,
      date_from: dateFrom,
      date_to: dateTo,
      page: pageParam = '1',
      limit: limitParam = '50',
    } = req.query;

    const page = Number.parseInt(pageParam, 10) > 0 ? Number.parseInt(pageParam, 10) : 1;
    const limitRaw = Number.parseInt(limitParam, 10) > 0 ? Number.parseInt(limitParam, 10) : 50;
    const limit = Math.min(limitRaw, 200);
    const skip = (page - 1) * limit;

    const where = {};

    if (actorIdParam) {
      const parsedActorId = Number.parseInt(actorIdParam, 10);
      if (!Number.isNaN(parsedActorId)) where.actor_id = parsedActorId;
    }

    if (actorEmail) where.actor_email = actorEmail;
    if (action) where.action = { contains: action };
    if (resourceType) where.resource_type = { contains: resourceType };
    if (level) where.level = level;
    if (outcome) where.outcome = outcome;

    const createdAtRange = {};
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!Number.isNaN(fromDate.getTime())) createdAtRange.gte = fromDate;
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!Number.isNaN(toDate.getTime())) createdAtRange.lte = toDate;
    }
    if (Object.keys(createdAtRange).length > 0) where.created_at = createdAtRange;

    const [logs, total] = await prisma.$transaction([
      prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.audit_logs.count({ where }),
    ]);

    await audit({
      actorId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'audit.view',
      resourceType: 'audit_logs',
      details: {
        filters: {
          actorId: where.actor_id,
          actorEmail,
          action,
          resourceType,
          level,
          outcome,
          dateFrom,
          dateTo,
        },
        page,
        limit,
        total,
      },
      ip: req.auditMeta?.ip,
      userAgent: req.auditMeta?.userAgent,
    });

    res.json({
      data: {
        logs,
        meta: {
          total,
          page,
          limit,
          hasMore: skip + logs.length < total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = { adminAuditRouter: router };
