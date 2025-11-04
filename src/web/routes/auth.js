const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');

const router = Router();

async function getUserRoles(userId) {
  const links = await prisma.usuarios_roles.findMany({
    where: { id_usuario: userId },
    include: { rol: true },
  });
  return links.map((l) => l.rol?.nombre_rol).filter(Boolean);
}

function signTokens(user, roles = []) {
  const payload = { sub: user.id_usuario, email: user.email, org: user.id_org, roles };
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET || 'dev',
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: user.id_usuario },
    process.env.JWT_REFRESH_SECRET || 'dev',
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

router.post('/register', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const { nombre, email, password } = req.body;
    if (!email || !password) return next(createError(400, 'email y password requeridos'));

    const exists = await prisma.usuarios.findUnique({ where: { email } });
    if (exists) return next(createError(409, 'Email ya registrado'));

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.usuarios.create({ data: { nombre, email, password_hash, estado: 'activo' } });
    const roles = await getUserRoles(user.id_usuario);
    const tokens = signTokens(user, roles);

    await prisma.sesiones.create({ data: { id_usuario: user.id_usuario, token: tokens.refreshToken, estado: 'activa', fecha_inicio: new Date() } });

    res.status(201).json({ user: { id: user.id_usuario, email: user.email, nombre: user.nombre }, roles, ...tokens });
  } catch (err) {
    next(createError(500, err.message || 'Error registrando usuario'));
  }
});

router.post('/login', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const { email, password } = req.body;
    const user = await prisma.usuarios.findUnique({ where: { email } });
    if (!user) return next(createError(401, 'Credenciales inválidas'));

    const ok = await bcrypt.compare(password || '', user.password_hash || '');
    if (!ok) return next(createError(401, 'Credenciales inválidas'));

    const roles = await getUserRoles(user.id_usuario);
    const tokens = signTokens(user, roles);
    await prisma.sesiones.create({ data: { id_usuario: user.id_usuario, token: tokens.refreshToken, estado: 'activa', fecha_inicio: new Date() } });

    res.json({ user: { id: user.id_usuario, email: user.email, nombre: user.nombre }, roles, ...tokens });
  } catch (err) {
    next(createError(500, err.message || 'Error en login'));
  }
});

router.post('/refresh', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(createError(400, 'Falta refreshToken'));
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dev');
    const session = await prisma.sesiones.findFirst({ where: { id_usuario: payload.sub, token: refreshToken, estado: 'activa' } });
    if (!session) return next(createError(401, 'Token inválido'));

    const user = await prisma.usuarios.findUnique({ where: { id_usuario: payload.sub } });
    const roles = await getUserRoles(user.id_usuario);
    const tokens = signTokens(user, roles);

    res.json({ roles, ...tokens });
  } catch (err) {
    next(createError(401, err.message || 'Refresh no válido'));
  }
});

router.post('/logout', async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.sesiones.updateMany({ where: { token: refreshToken }, data: { estado: 'caducada', fecha_fin: new Date() } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(createError(500, err.message || 'Error en logout'));
  }
});

module.exports = { authRouter: router };

// Info del usuario autenticado (id, email, roles)
router.get('/me', requireAuth, async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const userId = req.user?.sub;
    if (!userId) return next(createError(401, 'No autorizado'));
    const user = await prisma.usuarios.findUnique({ where: { id_usuario: Number(userId) } });
    if (!user) return next(createError(404, 'Usuario no encontrado'));
    const roles = await getUserRoles(user.id_usuario);
    res.json({ user: { id: user.id_usuario, email: user.email, nombre: user.nombre }, roles });
  } catch (err) {
    next(createError(500, err.message || 'Error obteniendo perfil'));
  }
});
