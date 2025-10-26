const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const router = Router();

// GET /api/usuario/perfil - Perfil completo
router.get('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const user = await prisma.usuarios.findUnique({
      where: { id_usuario: userId },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        identificacion: true,
        foto_perfil: true,
        edad: true,
        zona_horaria: true,
        idioma: true,
        id_departamento: true,
        cargo: true,
        telefono: true,
        fecha_ingreso: true,
        preferencias: {
          select: {
            frecuencia_recordatorios: true,
            intereses_bienestar: true,
            actividades_favoritas: true,
            sobre_mi: true,
          }
        }
      },
    });
    if (!user) return next(createError(404, 'Perfil no encontrado'));
    res.json(user);
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo perfil'));
  }
});

// PUT /api/usuario/perfil - Actualizar perfil completo
router.put('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const {
      nombre, identificacion, edad, zona_horaria, idioma,
      id_departamento, cargo, telefono, fecha_ingreso,
      frecuencia_recordatorios, intereses_bienestar, actividades_favoritas, sobre_mi
    } = req.body;
    const existe = await prisma.usuarios.findUnique({ where: { id_usuario: userId } });
    if (!existe) return next(createError(404, 'Perfil no encontrado'));
    const user = await prisma.usuarios.update({
      where: { id_usuario: userId },
      data: {
        nombre, identificacion, edad, zona_horaria, idioma,
        id_departamento, cargo, telefono,
        fecha_ingreso: fecha_ingreso ? new Date(fecha_ingreso) : undefined,
        preferencias: {
          upsert: {
            create: { frecuencia_recordatorios, intereses_bienestar, actividades_favoritas, sobre_mi },
            update: { frecuencia_recordatorios, intereses_bienestar, actividades_favoritas, sobre_mi }
          }
        }
      },
    });
    res.json(user);
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando perfil'));
  }
});

// POST /api/usuario/perfil/foto - Subir foto de perfil (base64 o url)
router.post('/foto', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const { foto_perfil } = req.body; // base64 o url
    const existe = await prisma.usuarios.findUnique({ where: { id_usuario: userId } });
    if (!existe) return next(createError(404, 'Perfil no encontrado'));
    const user = await prisma.usuarios.update({
      where: { id_usuario: userId },
      data: { foto_perfil },
    });
    res.json({ ok: true, foto_perfil: user.foto_perfil });
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando foto de perfil'));
  }
});

module.exports = { perfilRouter: router };
