const { Router } = require('express');

const { authRouter } = require('./routes/auth');
const { crudRouter } = require('./routes/crud');

const { usuarioRouter } = require('./routes/usuario');
const { notificacionesRouter } = require('./routes/notificaciones');
const { privacidadRouter } = require('./routes/privacidad');
const { aparienciaRouter } = require('./routes/apariencia');

const { metasRouter } = require('./routes/metas');
const { perfilRouter } = require('./routes/perfil');
const { gruposRouter } = require('./routes/grupos');
const { boardsRouter } = require('./routes/boards');
const { columnsRouter } = require('./routes/columns');
const { tasksRouter } = require('./routes/tasks');
const { sprintsRouter } = require('./routes/sprints');

const router = Router();

router.use('/auth', authRouter);
router.use('/crud', crudRouter);

router.use('/usuario', usuarioRouter);

router.use('/usuario/notificaciones', notificacionesRouter);

router.use('/usuario/privacidad', privacidadRouter);

router.use('/usuario/apariencia', aparienciaRouter);

router.use('/usuario/metas', metasRouter);

router.use('/usuario/perfil', perfilRouter);

router.use('/grupos', gruposRouter);

router.use('/boards', boardsRouter);

router.use('/columns', columnsRouter);

router.use('/tasks', tasksRouter);

router.use('/sprints', sprintsRouter);

module.exports = { apiRouter: router };
