const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');

const router = Router();

// Simple mapping resource -> prisma model name
const resources = {
  organizaciones: 'organizaciones',
  departamentos: 'departamentos',
  usuarios: 'usuarios',
  roles: 'roles',
  usuarios_roles: 'usuarios_roles',
  sesiones: 'sesiones',
  permisos: 'permisos',
  roles_permisos: 'roles_permisos',
  auditoria: 'auditoria',
  preguntas_diarias: 'preguntas_diarias',
  respuestas_diarias: 'respuestas_diarias',
  evaluaciones: 'evaluaciones',
  registros_emocionales: 'registros_emocionales',
  progreso_bienestar: 'progreso_bienestar',
  recomendaciones: 'recomendaciones',
  recursos_biblioteca: 'recursos_biblioteca',
  notificaciones: 'notificaciones',
  tareas: 'tareas',
  metas_bienestar: 'metas_bienestar',
  tareas_log: 'tareas_log',
  conversaciones_ia: 'conversaciones_ia',
  mensajes_ia: 'mensajes_ia',
  sesiones_terapia: 'sesiones_terapia',
  grupos_trabajo: 'grupos_trabajo',
  grupos_miembros: 'grupos_miembros',
  llamadas: 'llamadas',
  productividad_empleado: 'productividad_empleado',
  reportes_productividad: 'reportes_productividad',
  empleados_destacados: 'empleados_destacados',
  preferencias_usuario: 'preferencias_usuario',
  configuracion_notificaciones: 'configuracion_notificaciones',
  privacidad_datos: 'privacidad_datos',
  indicadores_organizacion: 'indicadores_organizacion',
  descargas_reportes: 'descargas_reportes',
};

router.use(requireAuth);

router.get('/:resource', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const model = resources[req.params.resource];
    if (!model || !prisma[model]) return next(createError(404, 'Recurso no encontrado'));
    const items = await prisma[model].findMany({ take: 100 });
    res.json(items);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo recurso'));
  }
});

router.get('/:resource/:id', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const model = resources[req.params.resource];
    const id = Number(req.params.id);
    if (!model || !prisma[model]) return next(createError(404, 'Recurso no encontrado'));
    const pk = await getPrimaryKeyField(model);
    const item = await prisma[model].findUnique({ where: { [pk]: id } });
    if (!item) return next(createError(404, 'No existe'));
    res.json(item);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo recurso'));
  }
});

router.post('/:resource', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const model = resources[req.params.resource];
    if (!model || !prisma[model]) return next(createError(404, 'Recurso no encontrado'));
    const created = await prisma[model].create({ data: req.body });
    res.status(201).json(created);
  } catch (err) {
    next(createError(500, err.message || 'Error creando recurso'));
  }
});

router.put('/:resource/:id', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const model = resources[req.params.resource];
    const id = Number(req.params.id);
    if (!model || !prisma[model]) return next(createError(404, 'Recurso no encontrado'));
    const pk = await getPrimaryKeyField(model);
    const updated = await prisma[model].update({ where: { [pk]: id }, data: req.body });
    res.json(updated);
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando recurso'));
  }
});

router.delete('/:resource/:id', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const model = resources[req.params.resource];
    const id = Number(req.params.id);
    if (!model || !prisma[model]) return next(createError(404, 'Recurso no encontrado'));
    const pk = await getPrimaryKeyField(model);
    await prisma[model].delete({ where: { [pk]: id } });
    res.status(204).send();
  } catch (err) {
    next(createError(500, err.message || 'Error eliminando recurso'));
  }
});

async function getPrimaryKeyField(modelName) {
  // Simplistic convention: find first id_* field from Prisma DMMF via query engine could be heavy.
  // Hardcode mapping for now for reliability.
  const map = {
    organizaciones: 'id_org',
    departamentos: 'id_departamento',
    usuarios: 'id_usuario',
    roles: 'id_rol',
    usuarios_roles: 'id_usuario_rol',
    sesiones: 'id_sesion',
    permisos: 'id_permiso',
    roles_permisos: 'id_rol_permiso',
    auditoria: 'id_auditoria',
    preguntas_diarias: 'id_pregunta',
    respuestas_diarias: 'id_respuesta',
    evaluaciones: 'id_evaluacion',
    registros_emocionales: 'id_registro',
    progreso_bienestar: 'id_progreso',
    recomendaciones: 'id_recomendacion',
    recursos_biblioteca: 'id_recurso',
    notificaciones: 'id_notificacion',
    tareas: 'id_tarea',
    metas_bienestar: 'id_meta',
    tareas_log: 'id_tarea_log',
    conversaciones_ia: 'id_conversacion',
    mensajes_ia: 'id_mensaje',
    sesiones_terapia: 'id_sesion',
    grupos_trabajo: 'id_grupo',
    grupos_miembros: 'id_grupo_miembro',
    llamadas: 'id_llamada',
    productividad_empleado: 'id_prod',
    reportes_productividad: 'id_reporte',
    empleados_destacados: 'id_destacado',
    preferencias_usuario: 'id_preferencia',
    configuracion_notificaciones: 'id_conf_notif',
    privacidad_datos: 'id_privacidad',
    indicadores_organizacion: 'id_indicador',
    descargas_reportes: 'id_descarga',
  };
  return map[modelName];
}

module.exports = { crudRouter: router };
