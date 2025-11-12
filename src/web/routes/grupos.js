const { Router } = require('express');
const createError = require('http-errors');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const { requireRole } = require('../secure/requireRole');
const { audit } = require('../../lib/audit');

const router = Router();

// Listar grupos (con filtros simples)
router.get('/', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][GET /grupos] user=', req.user?.sub, 'query=', req.query);
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
  console.info('[KANBAN][POST /grupos] user=', req.user?.sub, 'body=', req.body);
  try {
    const { name, description, id_org, id_departamento, leader_id, visibility } = req.body;
    if (!name) return next(createError(400, 'name requerido'));
    if (!id_org) return next(createError(400, 'organization_id requerido'));
    if (!id_departamento) {
      return res.status(400).json({
        error: 'El campo id_departamento es obligatorio. Debe enviar un valor válido para crear el grupo.'
      });
    }
    // Validar que el departamento exista
    const depto = await prisma.departamentos.findUnique({ where: { id_departamento: Number(id_departamento) } });
    if (!depto) {
      return res.status(400).json({
        error: `El departamento con id_departamento=${id_departamento} no existe. Debe enviar un id válido.`
      });
    }

    const group = await prisma.grupos_trabajo.create({
      data: {
        nombre: name,
        descripcion: description,
        id_org: Number(id_org),
        id_departamento: Number(id_departamento),
        leader_id: leader_id || null,
        visibility: visibility ? String(visibility).toLowerCase() : undefined,
        created_by: Number(req.user.sub),
      },
    });
    // Sincronizar líder en grupos_miembros y rol
    if (leader_id) {
      const existing = await prisma.grupos_miembros.findFirst({ where: { id_grupo: group.id_grupo, id_usuario: leader_id } });
      if (existing) {
        await prisma.grupos_miembros.update({ where: { id_grupo_miembro: existing.id_grupo_miembro }, data: { rol_en_grupo: 'líder', is_leader: true } });
      } else {
        await prisma.grupos_miembros.create({ data: { id_grupo: group.id_grupo, id_usuario: leader_id, rol_en_grupo: 'líder', is_leader: true, joined_at: new Date() } });
      }
      // Sincronizar rol líder
      const { syncUserLeaderRole } = require('../utils/syncUserLeaderRole');
      await syncUserLeaderRole(leader_id, prisma);
    }
    await audit({
      actorId: Number(req.user.sub),
      actorEmail: req.user.email,
      action: 'groups.create',
      resourceType: 'grupos_trabajo',
      resourceId: group.id_grupo,
      details: { payload: { name, description, id_org, id_departamento, leader_id, visibility } },
      ip: req.auditMeta?.ip,
      userAgent: req.auditMeta?.userAgent,
    });
    res.status(201).json({ group });
  } catch (err) {
    try {
      console.error('[GRUPOS] Error creating group', { err: err && err.stack ? err.stack : err, body: req.body });
    } catch (e) {
      console.error('[GRUPOS] Error logging failure', e);
    }
    next(err);
  }
});

// Detalle de un grupo (incluye miembros)
router.get('/:grupoId', requireAuth, requireGroupRole('miembro'), async (req, res, next) => {
  console.info('[KANBAN][GET /grupos/:grupoId] user=', req.user?.sub, 'grupoId=', req.params.grupoId);
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
  console.info('[KANBAN][POST /grupos/:grupoId/members] user=', req.user?.sub, 'grupoId=', req.params.grupoId, 'body=', req.body);
  try {
    const grupoId = Number(req.params.grupoId);
    const { members = [], force = false } = req.body;
    if (!Array.isArray(members) || members.length === 0) return next(createError(400, 'members required'));
    if (members.length > 200) return next(createError(413, 'Too many members'));


    const { syncUsersOrgDept } = require('../../utils/syncUserOrgDept');
    const userIds = members.map(m => m.user_id);

    const result = await prisma.$transaction(async (tx) => {
      try {
        console.log('[GRUPOS] Iniciando transacción para agregar miembros:', { grupoId, userIds, members });
      } catch (e) {
        process.stdout.write('[GRUPOS] Iniciando transacción para agregar miembros:' + JSON.stringify({ grupoId, userIds, members }) + '\n');
      }
      const group = await tx.grupos_trabajo.findUnique({ where: { id_grupo: grupoId } });
      if (!group) {
        try {
          console.error('[GRUPOS] Grupo no encontrado:', grupoId);
        } catch (e) {
          process.stderr.write('[GRUPOS] Grupo no encontrado:' + grupoId + '\n');
        }
        throw createError(404, 'Group not found');
      }

      // Sincronizar organización y departamento de todos los usuarios agregados dentro de la transacción
      await syncUsersOrgDept(tx, grupoId, userIds);

      const added = [];
      for (const m of members) {
        const user = await tx.usuarios.findUnique({ where: { id_usuario: m.user_id } });
        if (!user) {
          try {
            console.error('[GRUPOS] Usuario no encontrado:', m.user_id);
          } catch (e) {
            process.stderr.write('[GRUPOS] Usuario no encontrado:' + m.user_id + '\n');
          }
          throw createError(404, `User ${m.user_id} not found`);
        }

        // idempotent add
        const existing = await tx.grupos_miembros.findFirst({ where: { id_grupo: grupoId, id_usuario: user.id_usuario } });
        if (existing) {
          try {
            console.log('[GRUPOS] Actualizando miembro existente:', { id_grupo_miembro: existing.id_grupo_miembro, user_id: user.id_usuario });
          } catch (e) {
            process.stdout.write('[GRUPOS] Actualizando miembro existente:' + JSON.stringify({ id_grupo_miembro: existing.id_grupo_miembro, user_id: user.id_usuario }) + '\n');
          }
          await tx.grupos_miembros.update({ where: { id_grupo_miembro: existing.id_grupo_miembro }, data: { rol_en_grupo: m.position ?? existing.rol_en_grupo, is_leader: m.is_leader ?? existing.is_leader } });
        } else {
          try {
            console.log('[GRUPOS] Creando nuevo miembro:', { grupoId, user_id: user.id_usuario });
          } catch (e) {
            process.stdout.write('[GRUPOS] Creando nuevo miembro:' + JSON.stringify({ grupoId, user_id: user.id_usuario }) + '\n');
          }
          await tx.grupos_miembros.create({ data: { id_grupo: grupoId, id_usuario: user.id_usuario, rol_en_grupo: m.position ?? user.cargo, is_leader: m.is_leader || false, joined_at: new Date() } });
        }

        added.push({ user_id: user.id_usuario, position: m.position });
      }

      try {
        console.log('[GRUPOS] Miembros agregados:', added);
      } catch (e) {
        process.stdout.write('[GRUPOS] Miembros agregados:' + JSON.stringify(added) + '\n');
      }
      return added;
    });

    await audit({
      actorId: Number(req.user.sub),
      actorEmail: req.user.email,
      action: 'groups.members.add',
      resourceType: 'grupos_trabajo',
      resourceId: grupoId,
      details: { requested: members, added: result },
      ip: req.auditMeta?.ip,
      userAgent: req.auditMeta?.userAgent,
    });

    // Sincronizar rol líder para todos los miembros agregados
    const { syncUserLeaderRole } = require('../utils/syncUserLeaderRole');
    for (const m of members) {
      if (m.is_leader) {
        await syncUserLeaderRole(m.user_id, prisma);
      }
    }
    res.json({ added: result });
  } catch (err) {
    next(err);
  }
});

// Patch member
router.patch('/:grupoId/members/:userId', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  console.info('[KANBAN][PATCH /grupos/:grupoId/members/:userId] user=', req.user?.sub, 'grupoId=', req.params.grupoId, 'userId=', req.params.userId, 'body=', req.body);
  try {
    const grupoId = Number(req.params.grupoId);
    const userId = Number(req.params.userId);
    const { position, is_leader, set_org_and_dept, organization_id, department_id, force } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.grupos_miembros.findFirst({ where: { id_grupo: grupoId, id_usuario: userId } });
      if (!member) throw createError(404, 'Member not found');

      const before = { ...member };

      if (set_org_and_dept) {
        const user = await tx.usuarios.findUnique({ where: { id_usuario: userId } });
        const grupo = await tx.grupos_trabajo.findUnique({ where: { id_grupo: grupoId } });
        const targetOrg = organization_id ?? grupo.id_org;
        const targetDept = department_id ?? grupo.id_departamento;
        if (!force && ((user.id_org && user.id_org !== targetOrg) || (user.id_departamento && user.id_departamento !== targetDept))) {
          throw createError(409, 'User has different org/dept');
        }
        await tx.usuarios.update({ where: { id_usuario: userId }, data: { id_org: targetOrg, id_departamento: targetDept } });
      }

      const updated = await tx.grupos_miembros.update({ where: { id_grupo_miembro: member.id_grupo_miembro }, data: { rol_en_grupo: position ?? member.rol_en_grupo, is_leader: is_leader ?? member.is_leader } });
      return { before, after: updated };
    });

    await audit({
      actorId: Number(req.user.sub),
      actorEmail: req.user.email,
      action: 'groups.members.update',
      resourceType: 'grupos_trabajo',
      resourceId: grupoId,
      details: { memberId: userId, before: result.before, after: result.after },
      ip: req.auditMeta?.ip,
      userAgent: req.auditMeta?.userAgent,
    });

    // Sincronizar rol líder si cambia is_leader
    if (typeof is_leader !== 'undefined') {
      const { syncUserLeaderRole } = require('../utils/syncUserLeaderRole');
      await syncUserLeaderRole(userId, prisma);
    }
    res.json({ member: result.after });
  } catch (err) {
    next(err);
  }
});

// Delete member
router.delete('/:grupoId/members/:userId', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  console.info('[KANBAN][DELETE /grupos/:grupoId/members/:userId] user=', req.user?.sub, 'grupoId=', req.params.grupoId, 'userId=', req.params.userId);
  try {
    const grupoId = Number(req.params.grupoId);
    const userId = Number(req.params.userId);
    const member = await prisma.grupos_miembros.findFirst({ where: { id_grupo: grupoId, id_usuario: userId } });
    if (!member) return res.status(200).json({ ok: true, deleted: false });

    await prisma.grupos_miembros.delete({ where: { id_grupo_miembro: member.id_grupo_miembro } });

    await audit({
      actorId: Number(req.user.sub),
      actorEmail: req.user.email,
      action: 'groups.members.remove',
      resourceType: 'grupos_trabajo',
      resourceId: grupoId,
      details: { memberId: userId, snapshot: member },
      ip: req.auditMeta?.ip,
      userAgent: req.auditMeta?.userAgent,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { gruposRouter: router };
