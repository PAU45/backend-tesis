const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const router = Router();

// GET /api/usuario - Perfil y preferencias del usuario autenticado
router.get('/', requireAuth, async (req, res) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    // Datos personales
    const user = await prisma.usuarios.findUnique({
      where: { id_usuario: userId },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        edad: true,
      },
    });
    if (!user) return next(createError(404, 'Usuario no encontrado'));
    // Preferencias
    const preferencias = await prisma.preferencias_usuario.findUnique({
      where: { id_usuario: userId },
      select: {
        zona_horaria: true,
        idioma: true,
      },
    });
    // Roles
    const rolesLinks = await prisma.usuarios_roles.findMany({
      where: { id_usuario: userId },
      include: { rol: true },
    });
    const roles = rolesLinks.map((l) => l.rol?.nombre_rol).filter(Boolean);
    res.json({
      id: user.id_usuario,
      nombre: user.nombre,
      email: user.email,
      edad: user.edad,
      zona_horaria: preferencias?.zona_horaria || null,
      idioma: preferencias?.idioma || null,
      roles,
    });
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo perfil de usuario'));
  }
});

module.exports = { usuarioRouter: router };
