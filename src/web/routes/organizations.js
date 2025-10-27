const { Router } = require('express');
const createError = require('http-errors');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');

const router = Router();

// GET /api/organizations
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.query || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const where = {};
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, orgs] = await Promise.all([
      prisma.organizaciones.count({ where }),
      prisma.organizaciones.findMany({ where, take: limit, skip: offset, select: { id_org: true, nombre: true, fecha_creacion: true } }),
    ]);

    const data = orgs.map(o => ({ id: o.id_org, name: o.nombre, created_at: o.fecha_creacion }));
    res.json({ data: { organizations: data, meta: { total, limit, offset } } });
  } catch (err) {
    next(err);
  }
});

module.exports = { organizationsRouter: router };
