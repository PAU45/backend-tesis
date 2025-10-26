const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const router = Router();

// GET /api/usuario/apariencia - Preferencias de apariencia
router.get('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const pref = await prisma.preferencias_usuario.findUnique({
      where: { id_usuario: userId },
      select: {
        tema: true,
        color_acento: true,
        tamano_fuente: true,
      },
    });
    if (!pref) return next(createError(404, 'Preferencias de apariencia no encontradas'));
    res.json(pref);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo preferencias de apariencia'));
  }
});

// PUT /api/usuario/apariencia - Actualizar preferencias de apariencia
router.put('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const {
      tema = 'claro',
      color_acento = '#009688',
      tamano_fuente = 'normal',
    } = req.body;
    // Buscar registro existente
    const existente = await prisma.preferencias_usuario.findUnique({ where: { id_usuario: userId } });
    let pref;
    if (existente) {
      pref = await prisma.preferencias_usuario.update({
        where: { id_preferencia: existente.id_preferencia },
        data: { tema, color_acento, tamano_fuente },
      });
    } else {
      pref = await prisma.preferencias_usuario.create({
        data: { id_usuario: userId, tema, color_acento, tamano_fuente },
      });
    }
    res.json(pref);
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando preferencias de apariencia'));
  }
});

module.exports = { aparienciaRouter: router };
