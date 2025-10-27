const { Router } = require('express');
const createError = require('http-errors');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');

const router = Router();

// GET /api/departments
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.query || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const organization_id = req.query.organization_id ? Number(req.query.organization_id) : null;

    const where = {};
    if (organization_id) where.id_org = organization_id;
    if (q) {
      where.nombre = { contains: q, mode: 'insensitive' };
    }

    const [total, deps] = await Promise.all([
      prisma.departamentos.count({ where }),
      prisma.departamentos.findMany({ where, take: limit, skip: offset, select: { id_departamento: true, id_org: true, nombre: true } }),
    ]);

    const data = deps.map(d => ({ id: d.id_departamento, organization_id: d.id_org, name: d.nombre }));
    res.json({ data: { departments: data, meta: { total, limit, offset } } });
  } catch (err) {
    next(err);
  }
});

module.exports = { departmentsRouter: router };
