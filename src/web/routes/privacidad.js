const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const router = Router();

// GET /api/usuario/privacidad - Preferencias de privacidad y datos
router.get('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
      let priv = await prisma.privacidad_datos.findFirst({
        where: { id_usuario: userId },
        select: {
          compartir_con_investigadores: true,
          modo_offline: true,
          fecha_aceptacion: true
        },
      });
      if (!priv) {
        priv = await prisma.privacidad_datos.create({
          data: {
            id_usuario: userId,
            compartir_con_investigadores: false,
            modo_offline: false,
            fecha_aceptacion: new Date()
          }
        });
      }
      res.json(priv);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo configuración de privacidad'));
  }
});

// PUT /api/usuario/privacidad - Actualizar preferencias de privacidad
router.put('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    // Función para normalizar valores a booleano
    function toBool(val) {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val === 'true' || val === '1';
      if (typeof val === 'number') return val === 1;
      return false;
    }

    const {
      compartir_con_investigadores = false,
      modo_offline = false,
      backup_automatico = false
    } = req.body;

    const data = {
      compartir_con_investigadores: toBool(compartir_con_investigadores),
      modo_offline: toBool(modo_offline),
      backup_automatico: toBool(backup_automatico),
      fecha_aceptacion: new Date()
    };

    // Buscar registro existente
    const existente = await prisma.privacidad_datos.findFirst({ where: { id_usuario: userId } });
    let priv;
    if (existente) {
      priv = await prisma.privacidad_datos.update({
        where: { id_privacidad: existente.id_privacidad },
        data
      });
    } else {
      priv = await prisma.privacidad_datos.create({
        data: {
          id_usuario: userId,
          ...data
        }
      });
    }
    res.json(priv);
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando configuración de privacidad'));
  }
});

module.exports = { privacidadRouter: router };
