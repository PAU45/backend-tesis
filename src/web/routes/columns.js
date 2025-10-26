const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const router = Router();

// Crear columna (solo líder)
router.post('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const { nombre, id_board, orden } = req.body;
    if (!nombre || !id_board) return next(createError(400, 'Faltan datos'));
    const board = await prisma.board.findUnique({ where: { id: id_board } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      const columna = await prisma.column.create({ data: { nombre, id_board, orden: orden || 0 } });
      res.status(201).json(columna);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error creando columna'));
  }
});

// Listar columnas por board (miembro o líder)
router.get('/board/:boardId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const boardId = Number(req.params.boardId);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('miembro')(req, res, async () => {
      const columnas = await prisma.column.findMany({ where: { id_board: boardId }, orderBy: { orden: 'asc' } });
      if (!columnas || columnas.length === 0) return next(createError(404, 'No se encontraron columnas'));
      res.json(columnas);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo columnas'));
  }
});

// Editar columna (solo líder)
router.put('/:columnId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const columnId = Number(req.params.columnId);
    const columna = await prisma.column.findUnique({ where: { id: columnId } });
    if (!columna) return next(createError(404, 'Columna no encontrada'));
    const board = await prisma.board.findUnique({ where: { id: columna.id_board } });
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      const { nombre, orden } = req.body;
      const updated = await prisma.column.update({ where: { id: columnId }, data: { nombre, orden } });
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando columna'));
  }
});

// Eliminar columna (solo líder)
router.delete('/:columnId', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const columnId = Number(req.params.columnId);
    const columna = await prisma.column.findUnique({ where: { id: columnId } });
    if (!columna) return next(createError(404, 'Columna no encontrada'));
    const board = await prisma.board.findUnique({ where: { id: columna.id_board } });
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      await prisma.column.delete({ where: { id: columnId } });
      res.json({ ok: true });
    });
  } catch (err) {
    next(createError(500, err.message || 'Error eliminando columna'));
  }
});

// Cambiar orden de columnas (solo líder)
router.patch('/reorder', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const { id_board, ordenes } = req.body; // ordenes: [{id, orden}]
    const board = await prisma.board.findUnique({ where: { id: id_board } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      const updates = await Promise.all(
        (ordenes || []).map(({ id, orden }) =>
          prisma.column.update({ where: { id }, data: { orden } })
        )
      );
      res.json(updates);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error reordenando columnas'));
  }
});

module.exports = { columnsRouter: router };
