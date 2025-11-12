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
const { organizationsRouter } = require('./routes/organizations');
const { departmentsRouter } = require('./routes/departments');
const { boardsRouter } = require('./routes/boards');
const { columnsRouter } = require('./routes/columns');
const { tasksRouter } = require('./routes/tasks');
const { sprintsRouter } = require('./routes/sprints');
const { adminAuditRouter } = require('./routes/adminAudit');

const router = Router();

router.use('/auth', authRouter);
router.use('/crud', crudRouter);

router.use('/usuario', usuarioRouter);
// Alias in English for frontend compatibility
router.use('/users', usuarioRouter);

router.use('/usuario/notificaciones', notificacionesRouter);

router.use('/usuario/privacidad', privacidadRouter);

router.use('/usuario/apariencia', aparienciaRouter);

router.use('/usuario/metas', metasRouter);

router.use('/usuario/perfil', perfilRouter);

router.use('/grupos', gruposRouter);
// English alias for frontend expecting /groups
router.use('/groups', gruposRouter);

router.use('/organizations', organizationsRouter);
router.use('/departments', departmentsRouter);

router.use('/boards', boardsRouter);

router.use('/columns', columnsRouter);

router.use('/tasks', tasksRouter);
// Compatibility alias: some frontends use /kanban/tasks
router.use('/kanban/tasks', tasksRouter);

// Compatibility alias: some frontends call /kanban/groups — forward to the existing grupos router
router.use('/kanban/groups', gruposRouter);

// === IA Gemini Chat ===
const iaRoutes = require('./routes/ia');
router.use('/api', iaRoutes);

// === IA Memoria ===
const iaMemoriaRoutes = require('./routes/ia-memoria');
router.use('/api', iaMemoriaRoutes);

router.use('/sprints', sprintsRouter);

router.use('/admin/audit', adminAuditRouter);

module.exports = { apiRouter: router };
