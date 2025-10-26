const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const router = Router();

// Crear sprint (solo líder)
router.post('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const { id_board, nombre, fechaInicio, fechaFin, estado } = req.body;
    if (!id_board || !nombre || !fechaInicio || !fechaFin) return next(createError(400, 'Faltan datos'));
    const board = await prisma.board.findUnique({ where: { id: id_board } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      const sprint = await prisma.sprint.create({ data: { id_board, nombre, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin), estado } });
      res.status(201).json(sprint);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error creando sprint'));
  }
});

// Listar sprints por board (miembro o líder)
router.get('/board/:boardId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const boardId = Number(req.params.boardId);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const sprints = await prisma.sprint.findMany({ where: { id_board: boardId }, orderBy: { fechaInicio: 'asc' } });
      if (!sprints || sprints.length === 0) return next(createError(404, 'No se encontraron sprints'));
      res.json(sprints);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo sprints'));
  }
});

// Editar sprint (solo líder)
router.put('/:sprintId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const sprintId = Number(req.params.sprintId);
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) return next(createError(404, 'Sprint no encontrado'));
    const board = await prisma.board.findUnique({ where: { id: sprint.id_board } });
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      const { nombre, fechaInicio, fechaFin, estado } = req.body;
      const updated = await prisma.sprint.update({ where: { id: sprintId }, data: { nombre, fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined, fechaFin: fechaFin ? new Date(fechaFin) : undefined, estado } });
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando sprint'));
  }
});

// Eliminar sprint (solo líder)
router.delete('/:sprintId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const sprintId = Number(req.params.sprintId);
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) return next(createError(404, 'Sprint no encontrado'));
    const board = await prisma.board.findUnique({ where: { id: sprint.id_board } });
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      await prisma.sprint.delete({ where: { id: sprintId } });
      res.json({ ok: true });
    });
  } catch (err) {
    next(createError(500, err.message || 'Error eliminando sprint'));
  }
});

// Asignar tareas a sprint (solo líder)
router.patch('/:sprintId/assign-tasks', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const sprintId = Number(req.params.sprintId);
    const { taskIds } = req.body; // [id]
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) return next(createError(404, 'Sprint no encontrado'));
    const board = await prisma.board.findUnique({ where: { id: sprint.id_board } });
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      await prisma.task.updateMany({ where: { id: { in: taskIds }, id_board: board.id }, data: { id_sprint: sprintId } });
      res.json({ ok: true });
    });
  } catch (err) {
    next(createError(500, err.message || 'Error asignando tareas a sprint'));
  }
});

module.exports = { sprintsRouter: router };
