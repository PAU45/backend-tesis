const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const { requireRole } = require('../secure/requireRole');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
        identificacion: true,
        foto_perfil: true,
        id_org: true,
        id_departamento: true,
        cargo: true,
        telefono: true,
        fecha_nacimiento: true,
        fecha_creacion: true,
        fecha_actualizacion: true,
      },
    });
    if (!user) return next(createError(404, 'Usuario no encontrado'));
    // Preferencias: id_preferencia is the PK, so use findFirst by id_usuario
    const preferencias = await prisma.preferencias_usuario.findFirst({
      where: { id_usuario: userId },
      select: { zona_horaria: true, idioma: true },
    });
    // Roles
    const rolesLinks = await prisma.usuarios_roles.findMany({ where: { id_usuario: userId }, include: { rol: true } });
    const roles = rolesLinks.map((l) => l.rol?.nombre_rol).filter(Boolean);
    // Grupos
    const memberships = await prisma.grupos_miembros.findMany({ where: { id_usuario: userId }, include: { grupo: true } });
    const groups = memberships.map(m => ({ id: m.grupo.id_grupo, name: m.grupo.nombre, position: m.rol_en_grupo, is_leader: m.is_leader }));
    // Compute age (edad) from fecha_nacimiento if available
    let edad = null;
    try {
      if (user.fecha_nacimiento) {
        const dob = new Date(user.fecha_nacimiento);
        const now = new Date();
        let years = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years -= 1;
        edad = years;
      }
    } catch (e) {
      // ignore parse errors
    }

    res.json({
      id: user.id_usuario,
      nombre: user.nombre,
      email: user.email,
      identificacion: user.identificacion || null,
      foto_perfil: user.foto_perfil || null,
      organization_id: user.id_org || null,
      department_id: user.id_departamento || null,
      cargo: user.cargo || null,
      telefono: user.telefono || null,
      fecha_nacimiento: user.fecha_nacimiento || null,
      edad,
      zona_horaria: preferencias?.zona_horaria || null,
      idioma: preferencias?.idioma || null,
      roles,
      groups,
    });
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

// Upload or set profile photo
// Ensure uploads folder is at project root so express.static('/uploads') matches files
const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'), false);
    cb(null, true);
  }
});

router.post('/:id/photo', requireAuth, upload.single('photo'), async (req, res, next) => {
  // Temporary debug logs to help frontend/server debugging
  try {
    console.info('[upload-photo] headers.content-type=', req.headers['content-type']);
    console.info('[upload-photo] ip=', req.ip || req.connection?.remoteAddress, 'hasBody=', !!req.body, 'hasFile=', !!req.file);
    if (req.file) console.info('[upload-photo] file=', { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, filename: req.file.filename });
  } catch (e) {
    // ignore
  }

  try {
    const userId = Number(req.params.id);
    // allow only owner or admin
    if (Number(req.user.sub) !== userId && !(req.user.roles || []).includes('admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Accept external URL in JSON body
    if (req.body && req.body.url) {
      const url = String(req.body.url).trim();
      await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: url } });
      return res.json({ foto_perfil: url });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const relativeUrl = `/uploads/avatars/${req.file.filename}`;
    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;

    // Optionally remove old file if it was local or if it was an absolute URL pointing to our host
    const user = await prisma.usuarios.findUnique({ where: { id_usuario: userId } });
    if (user?.foto_perfil) {
      try {
        if (String(user.foto_perfil).startsWith('http')) {
          const parsed = new URL(user.foto_perfil);
          if (parsed.host === req.get('host')) {
            const oldRelative = parsed.pathname.replace(/^\//, '');
            const oldPath = path.join(process.cwd(), oldRelative);
            fs.unlink(oldPath, () => {});
          }
        } else {
          const oldRelative = String(user.foto_perfil).replace(/^\//, '');
          const oldPath = path.join(process.cwd(), oldRelative);
          fs.unlink(oldPath, () => {});
        }
      } catch (e) {
        // ignore deletion errors
      }
    }

    await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: absoluteUrl } });
    res.json({ foto_perfil: absoluteUrl });
  } catch (err) {
    next(err);
  }
});

// -- Additional CRUD helpers for profile photo
// GET /:id/photo - return current profile photo URL for a user (owner or admin)
router.get('/:id/photo', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (Number(req.user.sub) !== userId && !(req.user.roles || []).includes('admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await prisma.usuarios.findUnique({ where: { id_usuario: userId }, select: { foto_perfil: true } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ foto_perfil: user.foto_perfil || null });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id/photo - delete user's profile photo if local and clear DB field
router.delete('/:id/photo', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (Number(req.user.sub) !== userId && !(req.user.roles || []).includes('admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = await prisma.usuarios.findUnique({ where: { id_usuario: userId }, select: { foto_perfil: true } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.foto_perfil) {
      try {
        if (String(user.foto_perfil).startsWith('http')) {
          const parsed = new URL(user.foto_perfil);
          if (parsed.host === req.get('host')) {
            const oldRelative = parsed.pathname.replace(/^\//, '');
            const oldPath = path.join(process.cwd(), oldRelative);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
        } else {
          const oldRelative = String(user.foto_perfil).replace(/^\//, '');
          const oldPath = path.join(process.cwd(), oldRelative);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      } catch (e) {
        // ignore
      }
    }
    await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: null } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /:id/photos - list avatar files (owner or admin)
router.get('/:id/photos', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (Number(req.user.sub) !== userId && !(req.user.roles || []).includes('admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const files = fs.existsSync(avatarsDir) ? fs.readdirSync(avatarsDir).filter(f => !f.startsWith('.')) : [];
    const host = req.get('host');
    const protocol = req.protocol;
    const items = files.map(fname => ({ filename: fname, url: `${protocol}://${host}/uploads/avatars/${fname}` }));
    res.json({ files: items });
  } catch (err) {
    next(err);
  }
});

// PUT /:id/photo - replace photo (same behavior as POST)
router.put('/:id/photo', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    // reuse POST logic flow (duplicate minimal steps)
    const userId = Number(req.params.id);
    if (Number(req.user.sub) !== userId && !(req.user.roles || []).includes('admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.body && req.body.url) {
      const url = String(req.body.url).trim();
      await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: url } });
      return res.json({ foto_perfil: url });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const relativeUrl = `/uploads/avatars/${req.file.filename}`;
    const absoluteUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;
    const user = await prisma.usuarios.findUnique({ where: { id_usuario: userId } });
    if (user?.foto_perfil) {
      try {
        if (String(user.foto_perfil).startsWith('http')) {
          const parsed = new URL(user.foto_perfil);
          if (parsed.host === req.get('host')) {
            const oldRelative = parsed.pathname.replace(/^\//, '');
            const oldPath = path.join(process.cwd(), oldRelative);
            fs.unlink(oldPath, () => {});
          }
        } else {
          const oldRelative = String(user.foto_perfil).replace(/^\//, '');
          const oldPath = path.join(process.cwd(), oldRelative);
          fs.unlink(oldPath, () => {});
        }
      } catch (e) {}
    }
    await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: absoluteUrl } });
    res.json({ foto_perfil: absoluteUrl });
  } catch (err) {
    next(err);
  }
});
