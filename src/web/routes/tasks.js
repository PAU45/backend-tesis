const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const { audit } = require('../../lib/audit');
const router = Router();

// Crear tarea
router.post('/', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][POST /tasks] user=', req.user?.sub, 'body=', req.body);
  const createError = require('http-errors');
  try {
    const { titulo, descripcion, id_column, id_board, id_grupo, prioridad, etiquetas, fechaVencimiento, estado, id_sprint, asignados } = req.body;
    if (!titulo || !id_column || !id_board || !id_grupo) return next(createError(400, 'Faltan datos'));
    req.params.grupoId = id_grupo;
  await requireGroupRole('lider')(req, res, async () => {
      const tarea = await prisma.task.create({
        data: { titulo, descripcion, id_column, id_board, id_grupo, prioridad, etiquetas, fechaVencimiento, estado, id_sprint },
      });
      // Asignar usuarios solo si son miembros válidos del grupo
      if (Array.isArray(asignados) && asignados.length > 0) {
        const miembros = await prisma.grupos_miembros.findMany({ where: { id_grupo: id_grupo } });
        const miembrosIds = miembros.map(m => m.id_usuario);
        const asignadosValidos = asignados.filter(id_usuario => miembrosIds.includes(Number(id_usuario)));
        if (asignadosValidos.length > 0) {
          await prisma.task_asignado.createMany({
            data: asignadosValidos.map(id_usuario => ({ id_task: tarea.id, id_usuario })),
            skipDuplicates: true,
          });
        }
      }
      // Audit: task created
      try {
        await audit({
          actorId: req.user?.sub,
          actorEmail: req.user?.email,
          action: 'tasks.create',
          resourceType: 'task',
          resourceId: tarea.id,
          details: { input: { titulo, descripcion, id_column, id_board, id_grupo, prioridad, etiquetas, fechaVencimiento, estado, id_sprint, asignados } },
          ip: req.auditMeta?.ip,
          userAgent: req.auditMeta?.userAgent,
        });
      } catch (e) {
        // non-fatal
      }
      res.status(201).json(tarea);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error creando tarea'));
  }
});


// Listar tareas con filtros y estadísticas para el dashboard
router.get('/', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][GET /tasks] user=', req.user?.sub, 'query=', req.query);
  const createError = require('http-errors');
  try {
    // Query params accepted:
    // id_board, id_column, id_grupo, estado, prioridad, etiqueta, id_sprint
    // assignedId / asignadoId (numeric) or assignedTo (username or email)
    // pagination: page, limit
    const { id_board, id_column, id_grupo, estado, prioridad, etiqueta, id_sprint, mine } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const skip = (page - 1) * limit;

    let asignadoIdRaw = req.query.asignadoId || req.query.assignedId || req.query.assignedTo || req.query.assignedToId;
    let asignadoId = asignadoIdRaw;


    // Si ?mine=true, forzar filtro por usuario autenticado
    if (mine === 'true') {
      asignadoId = req.user.sub;
    }

    // Si ?lider=true, filtrar solo tareas de grupos donde el usuario es líder
    if (req.query.lider === 'true') {
      const liderGrupos = await prisma.grupos_miembros.findMany({
        where: {
          id_usuario: req.user.sub,
          OR: [
            { is_leader: true },
            { rol_en_grupo: { in: ['líder', 'lider'] } }
          ]
        }
      });
      const liderGroupIds = liderGrupos.map(g => g.id_grupo);
      if (liderGroupIds.length === 0) {
        // No es líder en ningún grupo, devolver vacío
        return res.json({ data: { tasks: [], meta: { total: 0, page, limit, hasMore: false }, stats: { total: 0, completed: 0, pending: 0, percentCompleted: 0 } } });
      }
      where.id_grupo = { in: liderGroupIds };
    }

    // Resolve assignedTo text -> user id when necessary
    if (asignadoId && isNaN(Number(asignadoId))) {
      const lookup = String(asignadoId).trim();
      const user = await prisma.usuarios.findFirst({ where: { OR: [{ email: lookup }, { nombre: lookup }] } });
      if (user) asignadoId = String(user.id_usuario);
      else {
        // If frontend requested a specific assignedTo that doesn't exist, return empty set + stats 0
        return res.json({ data: { tasks: [], meta: { total: 0, page, limit, hasMore: false }, stats: { total: 0, completed: 0, pending: 0, percentCompleted: 0 } } });
      }
    }

    const where = {};
    if (id_board) where.id_board = Number(id_board);
    if (id_column) where.id_column = Number(id_column);
    if (id_grupo) where.id_grupo = Number(id_grupo);
    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad;
    if (id_sprint) where.id_sprint = Number(id_sprint);
    if (etiqueta) where.etiquetas = { contains: etiqueta };
    if (asignadoId) where.asignados = { some: { id_usuario: Number(asignadoId) } };

    // Permission: only tasks from groups where user is member (unless explicit id_grupo provided)
    const userId = req.user.sub;
    const grupos = await prisma.grupos_miembros.findMany({ where: { id_usuario: userId } });
    const ids = grupos.map(g => g.id_grupo);
    if (!where.id_grupo) where.id_grupo = { in: ids };

    // Count total matching (for stats and pagination)
    const total = await prisma.task.count({ where });

    // Incluir info de grupo y board en cada tarea
    const tasks = await prisma.task.findMany({
      where,
      include: {
        asignados: true,
        grupo: { select: { id_grupo: true, nombre: true } },
        board: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Compute simple stats used by dashboard
    const completedStates = ['done', 'completed', 'completada', 'completado'];
    const completed = await prisma.task.count({ where: { ...where, estado: { in: completedStates } } });
    const pending = Math.max(0, total - completed);
    const percentCompleted = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Log cantidad de resultados
    console.info('[KANBAN][GET /tasks] user=', req.user?.sub, 'filters=', req.query, 'results=', tasks.length);

    res.json({
      data: {
        tasks: Array.isArray(tasks) ? tasks : [],
        meta: { total, page, limit, hasMore: skip + tasks.length < total },
        stats: { total, completed, pending, percentCompleted },
      },
    });
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo tareas'));
  }
});

// Editar tarea
router.put('/:taskId', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][PUT /tasks/:taskId] user=', req.user?.sub, 'taskId=', req.params.taskId, 'body=', req.body);
  const createError = require('http-errors');
  try {
    const taskId = Number(req.params.taskId);
    const tarea = await prisma.task.findUnique({ where: { id: taskId } });
    if (!tarea) return next(createError(404, 'Tarea no encontrada'));
    req.params.grupoId = tarea.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const { titulo, descripcion, prioridad, etiquetas, fechaVencimiento, estado, id_sprint, asignados } = req.body;
      const before = tarea;
      const updated = await prisma.task.update({
        where: { id: taskId },
        data: { titulo, descripcion, prioridad, etiquetas, fechaVencimiento, estado, id_sprint },
      });
      // Actualizar asignados
      if (Array.isArray(asignados)) {
        await prisma.task_asignado.deleteMany({ where: { id_task: taskId } });
        await prisma.task_asignado.createMany({
          data: asignados.map(id_usuario => ({ id_task: taskId, id_usuario })),
          skipDuplicates: true,
        });
      }
      // Audit: task updated (include before/after)
      try {
        await audit({
          actorId: req.user?.sub,
          actorEmail: req.user?.email,
          action: 'tasks.update',
          resourceType: 'task',
          resourceId: taskId,
          details: { before, after: updated, assigned: asignados },
          ip: req.auditMeta?.ip,
          userAgent: req.auditMeta?.userAgent,
        });
      } catch (e) {
        // ignore audit failures
      }
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando tarea'));
  }
});

// Eliminar tarea
router.delete('/:taskId', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][DELETE /tasks/:taskId] user=', req.user?.sub, 'taskId=', req.params.taskId);
  const createError = require('http-errors');
  try {
    const taskId = Number(req.params.taskId);
    const tarea = await prisma.task.findUnique({ where: { id: taskId } });
    if (!tarea) return next(createError(404, 'Tarea no encontrada'));
    req.params.grupoId = tarea.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      await prisma.task.delete({ where: { id: taskId } });
      // Audit: task deleted
      try {
        await audit({
          actorId: req.user?.sub,
          actorEmail: req.user?.email,
          action: 'tasks.delete',
          resourceType: 'task',
          resourceId: taskId,
          details: { deleted: tarea },
          ip: req.auditMeta?.ip,
          userAgent: req.auditMeta?.userAgent,
        });
      } catch (e) {
        // ignore
      }
      res.json({ ok: true });
    });
  } catch (err) {
    next(createError(500, err.message || 'Error eliminando tarea'));
  }
});

// Mover tarea de columna (drag & drop)
router.patch('/:taskId/move', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][PATCH /tasks/:taskId/move] user=', req.user?.sub, 'taskId=', req.params.taskId, 'body=', req.body);
  const createError = require('http-errors');
  try {
    const taskId = Number(req.params.taskId);
    const { id_column } = req.body;
    const tarea = await prisma.task.findUnique({ where: { id: taskId } });
    if (!tarea) return next(createError(404, 'Tarea no encontrada'));
    req.params.grupoId = tarea.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const updated = await prisma.task.update({ where: { id: taskId }, data: { id_column } });
      // Audit: task moved
      try {
        await audit({
          actorId: req.user?.sub,
          actorEmail: req.user?.email,
          action: 'tasks.move',
          resourceType: 'task',
          resourceId: taskId,
          details: { from: tarea.id_column, to: id_column },
          ip: req.auditMeta?.ip,
          userAgent: req.auditMeta?.userAgent,
        });
      } catch (e) {
        // ignore
      }
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error moviendo tarea'));
  }
});

module.exports = { tasksRouter: router };
