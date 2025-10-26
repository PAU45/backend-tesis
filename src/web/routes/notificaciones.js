const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const router = Router();

// GET /api/usuario/notificaciones - Preferencias de notificaciones del usuario
router.get('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    let config = await prisma.configuracion_notificaciones.findFirst({
      where: { id_usuario: userId },
      select: {
        meditacion: true,
        tareas: true,
        preguntas_diarias: true,
        bienestar_recordatorios: true
      },
    });
    if (!config) {
      // Si no existe, lo crea con valores por defecto
      config = await prisma.configuracion_notificaciones.create({
        data: {
          id_usuario: userId,
          meditacion: false,
          tareas: false,
          preguntas_diarias: false,
          bienestar_recordatorios: false
        }
      });
    }
    res.json(config);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo configuración de notificaciones'));
  }
});

// PUT /api/usuario/notificaciones - Actualizar preferencias
router.put('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    // Función para convertir cualquier valor a booleano
    function toBool(val) {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val === 'true' || val === '1';
      if (typeof val === 'number') return val === 1;
      return false;
    }

    const {
      meditacion = false,
      tareas = false,
      preguntas_diarias = false,
      bienestar_recordatorios = false
    } = req.body;

    // Convertir todos los valores a booleano
    const data = {
      meditacion: toBool(meditacion),
      tareas: toBool(tareas),
      preguntas_diarias: toBool(preguntas_diarias),
      bienestar_recordatorios: toBool(bienestar_recordatorios)
    };

    // Buscar registro existente
    const existente = await prisma.configuracion_notificaciones.findFirst({ where: { id_usuario: userId } });
    let config;
    if (existente) {
      config = await prisma.configuracion_notificaciones.update({
        where: { id_conf_notif: existente.id_conf_notif },
        data
      });
    } else {
      config = await prisma.configuracion_notificaciones.create({
        data: {
          id_usuario: userId,
          ...data
        }
      });
    }
    res.json(config);
  } catch (err) {
    console.error('Error en PUT /api/usuario/notificaciones:', err);
    next(createError(500, err.message || 'Error actualizando configuración de notificaciones'));
  }
});

module.exports = { notificacionesRouter: router };
