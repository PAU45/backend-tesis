const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const router = Router();

// GET /api/usuario/metas - Objetivos de bienestar
router.get('/', requireAuth, async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const metas = await prisma.metas_bienestar.findUnique({
      where: { id_usuario: userId },
      select: {
        minutos_meditacion_diarios: true,
        tareas_completadas_dia: true,
        ejercicio_semanal_dias: true,
        horas_sueno_noche: true,
      },
    });
    if (!metas) return next(createError(404, 'Metas de bienestar no encontradas'));
    res.json(metas);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo metas de bienestar'));
  }
});

// PUT /api/usuario/metas - Actualizar objetivos de bienestar
router.put('/', requireAuth, async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const {
      minutos_meditacion_diarios = 5,
      tareas_completadas_dia = 1,
      ejercicio_semanal_dias = 1,
      horas_sueno_noche = 6,
    } = req.body;
    // Buscar registro existente
    const existente = await prisma.metas_bienestar.findUnique({ where: { id_usuario: userId } });
    let metas;
    if (existente) {
      metas = await prisma.metas_bienestar.update({
        where: { id_meta: existente.id_meta },
        data: { minutos_meditacion_diarios, tareas_completadas_dia, ejercicio_semanal_dias, horas_sueno_noche },
      });
    } else {
      metas = await prisma.metas_bienestar.create({
        data: { id_usuario: userId, minutos_meditacion_diarios, tareas_completadas_dia, ejercicio_semanal_dias, horas_sueno_noche },
      });
    }
    res.json(metas);
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando metas de bienestar'));
  }
});

module.exports = { metasRouter: router };
