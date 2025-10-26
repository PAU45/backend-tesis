const { Router } = require('express');
const createError = require('http-errors');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const { requireRole } = require('../secure/requireRole');

const router = Router();

// Listar grupos (con filtros simples)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { id_org, id_departamento, mine } = req.query;
    const where = {};
    if (id_org) where.id_org = Number(id_org);
    if (id_departamento) where.id_departamento = Number(id_departamento);

    // if mine=true, list groups where user is member
    if (mine === 'true') {
      const userId = Number(req.user.sub);
      const grupos = await prisma.grupos_miembros.findMany({ where: { id_usuario: userId }, include: { grupo: true } });
      return res.json({ groups: grupos.map(g => g.grupo) });
    }

    const groups = await prisma.grupos_trabajo.findMany({ where, take: 200 });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

// Crear grupo
router.post('/', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const { name, description, id_org, id_departamento, leader_id, visibility } = req.body;
    if (!name) return next(createError(400, 'name requerido'));

    const group = await prisma.grupos_trabajo.create({
      data: {
        nombre: name,
        descripcion: description,
        id_org: id_org || req.user.org,
        leader_id: leader_id || null,
        visibility: visibility ? String(visibility).toLowerCase() : undefined,
        created_by: Number(req.user.sub),
      },
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
});

// Detalle de un grupo (incluye miembros)
router.get('/:grupoId', requireAuth, requireGroupRole('miembro'), async (req, res, next) => {
  try {
    const grupoId = Number(req.params.grupoId);
    const grupo = await prisma.grupos_trabajo.findUnique({
      where: { id_grupo: grupoId },
      include: { miembros: { include: { usuario: true } } },
    });
    if (!grupo) return next(createError(404, 'Grupo no encontrado'));
    res.json({ group: grupo });
  } catch (err) {
    next(err);
  }
});

// Añadir miembros (bulk) con transacción atómica
router.post('/:grupoId/members', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const grupoId = Number(req.params.grupoId);
    const { members = [], force = false } = req.body;
    if (!Array.isArray(members) || members.length === 0) return next(createError(400, 'members required'));
    if (members.length > 200) return next(createError(413, 'Too many members'));

    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.grupos_trabajo.findUnique({ where: { id_grupo: grupoId } });
      if (!group) throw createError(404, 'Group not found');

      const added = [];
      for (const m of members) {
        const user = await tx.usuarios.findUnique({ where: { id_usuario: m.user_id } });
        if (!user) throw createError(404, `User ${m.user_id} not found`);

        if (m.set_org_and_dept) {
          const targetOrg = m.organization_id ?? group.id_org;
          const targetDept = m.department_id ?? group.id_departamento;
          if (!force && ((user.id_org && user.id_org !== targetOrg) || (user.id_departamento && user.id_departamento !== targetDept))) {
            throw createError(409, `User ${m.user_id} has different org/dept`);
          }
          await tx.usuarios.update({ where: { id_usuario: user.id_usuario }, data: { id_org: targetOrg, id_departamento: targetDept } });
        }

        // idempotent add
        const existing = await tx.grupos_miembros.findFirst({ where: { id_grupo: grupoId, id_usuario: user.id_usuario } });
        if (existing) {
          await tx.grupos_miembros.update({ where: { id_grupo_miembro: existing.id_grupo_miembro }, data: { rol_en_grupo: m.position ?? existing.rol_en_grupo, is_leader: m.is_leader ?? existing.is_leader } });
        } else {
          await tx.grupos_miembros.create({ data: { id_grupo: grupoId, id_usuario: user.id_usuario, rol_en_grupo: m.position ?? user.cargo, is_leader: m.is_leader || false, joined_at: new Date() } });
        }

        added.push({ user_id: user.id_usuario, position: m.position });
      }

      // auditoria
      await tx.auditoria.create({ data: { id_usuario: Number(req.user.sub), accion: 'add_members', tabla_afectada: 'grupos_miembros', id_registro_afectado: String(grupoId), detalle: JSON.stringify(members), fecha_hora: new Date() } }).catch(() => {});

      return added;
    });

    res.json({ added: result });
  } catch (err) {
    next(err);
  }
});

// Patch member
router.patch('/:grupoId/members/:userId', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const grupoId = Number(req.params.grupoId);
    const userId = Number(req.params.userId);
    const { position, is_leader, set_org_and_dept, organization_id, department_id, force } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.grupos_miembros.findFirst({ where: { id_grupo: grupoId, id_usuario: userId } });
      if (!member) throw createError(404, 'Member not found');

      if (set_org_and_dept) {
        const user = await tx.usuarios.findUnique({ where: { id_usuario: userId } });
        const targetOrg = organization_id ?? (await tx.grupos_trabajo.findUnique({ where: { id_grupo: grupoId } })).id_org;
        const targetDept = department_id ?? null;
        if (!force && ((user.id_org && user.id_org !== targetOrg) || (user.id_departamento && user.id_departamento !== targetDept))) {
          throw createError(409, 'User has different org/dept');
        }
        await tx.usuarios.update({ where: { id_usuario: userId }, data: { id_org: targetOrg, id_departamento: targetDept } });
      }

      const updated = await tx.grupos_miembros.update({ where: { id_grupo_miembro: member.id_grupo_miembro }, data: { rol_en_grupo: position ?? member.rol_en_grupo, is_leader: is_leader ?? member.is_leader } });
      return updated;
    });

    res.json({ member: result });
  } catch (err) {
    next(err);
  }
});

// Delete member
router.delete('/:grupoId/members/:userId', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const grupoId = Number(req.params.grupoId);
    const userId = Number(req.params.userId);
    await prisma.grupos_miembros.deleteMany({ where: { id_grupo: grupoId, id_usuario: userId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { gruposRouter: router };
