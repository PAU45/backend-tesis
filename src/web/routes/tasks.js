const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const router = Router();

// Crear tarea
router.post('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const { titulo, descripcion, id_column, id_board, id_grupo, prioridad, etiquetas, fechaVencimiento, estado, id_sprint, asignados } = req.body;
    if (!titulo || !id_column || !id_board || !id_grupo) return next(createError(400, 'Faltan datos'));
    req.params.grupoId = id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const tarea = await prisma.task.create({
        data: { titulo, descripcion, id_column, id_board, id_grupo, prioridad, etiquetas, fechaVencimiento, estado, id_sprint },
      });
      // Asignar usuarios
      if (Array.isArray(asignados) && asignados.length > 0) {
        await prisma.task_asignado.createMany({
          data: asignados.map(id_usuario => ({ id_task: tarea.id, id_usuario })),
          skipDuplicates: true,
        });
      }
      res.status(201).json(tarea);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error creando tarea'));
  }
});

// Listar tareas con filtros
router.get('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const { id_board, id_column, id_grupo, estado, prioridad, etiqueta, id_sprint, asignadoId } = req.query;
    let where = {};
    if (id_board) where.id_board = Number(id_board);
    if (id_column) where.id_column = Number(id_column);
    if (id_grupo) where.id_grupo = Number(id_grupo);
    if (estado) where.estado = estado;
    if (prioridad) where.prioridad = prioridad;
    if (id_sprint) where.id_sprint = Number(id_sprint);
    if (etiqueta) where.etiquetas = { contains: etiqueta };
    if (asignadoId) where.asignados = { some: { id_usuario: Number(asignadoId) } };
    // Permiso: solo tareas de grupos donde es miembro
    const userId = req.user.sub;
    const grupos = await prisma.grupos_miembros.findMany({ where: { id_usuario: userId } });
    const ids = grupos.map(g => g.id_grupo);
    where.id_grupo = where.id_grupo || { in: ids };
    const tareas = await prisma.task.findMany({
      where,
      include: { asignados: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!tareas || tareas.length === 0) return next(createError(404, 'No se encontraron tareas'));
    res.json(tareas);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo tareas'));
  }
});

// Editar tarea
router.put('/:taskId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const taskId = Number(req.params.taskId);
    const tarea = await prisma.task.findUnique({ where: { id: taskId } });
    if (!tarea) return next(createError(404, 'Tarea no encontrada'));
    req.params.grupoId = tarea.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const { titulo, descripcion, prioridad, etiquetas, fechaVencimiento, estado, id_sprint, asignados } = req.body;
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
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando tarea'));
  }
});

// Eliminar tarea
router.delete('/:taskId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const taskId = Number(req.params.taskId);
    const tarea = await prisma.task.findUnique({ where: { id: taskId } });
    if (!tarea) return next(createError(404, 'Tarea no encontrada'));
    req.params.grupoId = tarea.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      await prisma.task.delete({ where: { id: taskId } });
      res.json({ ok: true });
    });
  } catch (err) {
    next(createError(500, err.message || 'Error eliminando tarea'));
  }
});

// Mover tarea de columna (drag & drop)
router.patch('/:taskId/move', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const taskId = Number(req.params.taskId);
    const { id_column } = req.body;
    const tarea = await prisma.task.findUnique({ where: { id: taskId } });
    if (!tarea) return next(createError(404, 'Tarea no encontrada'));
    req.params.grupoId = tarea.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const updated = await prisma.task.update({ where: { id: taskId }, data: { id_column } });
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error moviendo tarea'));
  }
});

module.exports = { tasksRouter: router };
