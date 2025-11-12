const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireGroupRole } = require('../secure/requireGroupRole');
const router = Router();

// Crear board (solo líder)
router.post('/', requireAuth, requireGroupRole('lider'), async (req, res, next) => {
  console.info('[KANBAN][POST /boards] user=', req.user?.sub, 'body=', req.body);
  const createError = require('http-errors');
  try {
    const { nombre, descripcion, id_grupo } = req.body;
    if (!nombre || !id_grupo) return next(createError(400, 'Faltan datos'));
    const board = await prisma.board.create({
      data: { nombre, descripcion, id_grupo },
    });
    res.status(201).json(board);
  } catch (err) {
    next(createError(500, err.message || 'Error creando board'));
  }
});

// Listar boards por grupo (miembro o líder)
router.get('/grupo/:grupoId', requireAuth, requireGroupRole('miembro'), async (req, res, next) => {
  try {
    const { grupoId } = req.params;
    const boards = await prisma.board.findMany({ where: { id_grupo: Number(grupoId) } });
    // Siempre devolver array (nunca null)
    res.json(Array.isArray(boards) ? boards : []);
    // Log resultado
    console.info('[KANBAN][GET /boards/grupo/:grupoId] user=', req.user?.sub, 'grupoId=', grupoId, 'results=', boards.length);
  } catch (err) {
    next(err);
  }
});
// ...el handler correcto ya está arriba, eliminamos este duplicado...

// Editar board (solo líder)
router.put('/:boardId', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][PUT /boards/:boardId] user=', req.user?.sub, 'boardId=', req.params.boardId, 'body=', req.body);
  const createError = require('http-errors');
  try {
    const boardId = Number(req.params.boardId);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    // Validar líder
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      const { nombre, descripcion } = req.body;
      const updated = await prisma.board.update({ where: { id: boardId }, data: { nombre, descripcion } });
      res.json(updated);
    });
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando board'));
  }
});

// Eliminar board (solo líder)
router.delete('/:boardId', requireAuth, async (req, res, next) => {
  console.info('[KANBAN][DELETE /boards/:boardId] user=', req.user?.sub, 'boardId=', req.params.boardId);
  const createError = require('http-errors');
  try {
    const boardId = Number(req.params.boardId);
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return next(createError(404, 'Board no encontrado'));
    req.params.grupoId = board.id_grupo;
    await requireGroupRole('lider')(req, res, async () => {
      await prisma.board.delete({ where: { id: boardId } });
      res.json({ ok: true });
    });
  } catch (err) {
    next(createError(500, err.message || 'Error eliminando board'));
  }
});

module.exports = { boardsRouter: router };
