const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireRole } = require('../secure/requireRole');
const router = Router();

// GET /api/usuario or GET /api/users
// - If query.unassigned=true -> list users without org/dept (supports pagination & search)
// - Otherwise returns authenticated user's profile
router.get('/', requireAuth, async (req, res, next) => {
  const createError = require('http-errors');
  try {
    // If frontend calls /api/users?unassigned=true => list users for selector
    if (String(req.query.unassigned) === 'true') {
      // require supervisor/admin for this listing
      const roles = req.user?.roles || [];
      if (!roles.some(r => ['admin', 'supervisor'].includes(r))) return next(createError(403, 'Forbidden'));

      const q = String(req.query.query || '').trim();
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;

      const where = { AND: [{ id_org: null }, { id_departamento: null }] };
      if (q) {
        where.OR = [
          { nombre: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [total, users] = await Promise.all([
        prisma.usuarios.count({ where }),
        prisma.usuarios.findMany({ where, take: limit, skip: offset, select: { id_usuario: true, nombre: true, email: true, id_org: true, id_departamento: true } }),
      ]);

      return res.json({ data: { users: users.map(u => ({ id: u.id_usuario, name: u.nombre, email: u.email, organization_id: u.id_org, department_id: u.id_departamento })), meta: { total, limit, offset } } });
    }

    // Default: return profile for authenticated user
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
    const rolesLinks = await prisma.usuarios_roles.findMany({ where: { id_usuario: userId }, include: { rol: true } });
    const roles = rolesLinks.map((l) => l.rol?.nombre_rol).filter(Boolean);
    res.json({ id: user.id_usuario, nombre: user.nombre, email: user.email, edad: user.edad, zona_horaria: preferencias?.zona_horaria || null, idioma: preferencias?.idioma || null, roles });
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo perfil de usuario'));
  }
});

module.exports = { usuarioRouter: router };

// List users without org/department (for frontend selector)
router.get('/unassigned', requireAuth, requireRole(['admin', 'supervisor']), async (req, res, next) => {
  try {
    const users = await prisma.usuarios.findMany({ where: { OR: [{ id_org: null }, { id_departamento: null }] }, select: { id_usuario: true, nombre: true, email: true } });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// Get groups where a user participates
router.get('/:id/groups', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const memberships = await prisma.grupos_miembros.findMany({ where: { id_usuario: userId }, include: { grupo: true } });
    const groups = memberships.map(m => ({ id: m.grupo.id_grupo, name: m.grupo.nombre, position: m.rol_en_grupo, is_leader: m.is_leader }));
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});
