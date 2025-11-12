const { Router } = require('express');
const { prisma } = require('../../prisma');
const { requireAuth } = require('../secure/requireAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = Router();

// GET /api/usuario/perfil - Perfil completo
router.get('/', requireAuth, async (req, res, next) => {
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
        fecha_nacimiento: true,
        id_departamento: true,
        cargo: true,
        telefono: true,
        fecha_creacion: true,
        preferencias: {
          select: {
            frecuencia_recordatorios: true,
            intereses_bienestar: true,
            actividades_favoritas: true,
            sobre_mi: true,
            idioma: true,
            pais: true,
            zona_horaria: true,
            tema: true,
            color_principal: true,
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
router.put('/', requireAuth, async (req, res, next) => {
  const createError = require('http-errors');
  try {
    const userId = req.user.sub;
    const {
      nombre, identificacion, fecha_nacimiento, zona_horaria, idioma,
      id_departamento, cargo, telefono, fecha_nacimiento_raw,
      frecuencia_recordatorios, intereses_bienestar, actividades_favoritas, sobre_mi, pais, tema, color_principal
    } = req.body;
    // Debug: log incoming payload (truncated) to help diagnose why profile fields
    // might not be saved. Keep size reasonable to avoid leaking large data.
    try {
      const bodyStr = req.body ? JSON.stringify(req.body) : '';
      console.info('[perfil:put] user=', userId, 'body=', bodyStr ? (bodyStr.length > 1000 ? bodyStr.slice(0, 1000) + '... (truncated)' : bodyStr) : '(empty)');
    } catch (e) {
      console.info('[perfil:put] could not stringify request body', e && e.message ? e.message : e);
    }
    const existe = await prisma.usuarios.findUnique({ where: { id_usuario: userId } });
    if (!existe) return next(createError(404, 'Perfil no encontrado'));
    // Update user basic fields first
    const user = await prisma.usuarios.update({
      where: { id_usuario: userId },
      data: {
        nombre,
        identificacion,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : undefined,
        id_departamento,
        cargo,
        telefono,
      },
    });

    // Then upsert preferencias_usuario separately (id_usuario is not unique PK)
    try {
      // Sanitize / map incoming preference fields to the Prisma model
      const prefData = {};
      if (typeof frecuencia_recordatorios === 'string') prefData.frecuencia_recordatorios = frecuencia_recordatorios;
      // Map actividades_favoritas (array) into a string field in the DB and also set intereses_bienestar if needed
      if (Array.isArray(actividades_favoritas) && actividades_favoritas.length > 0) {
        const joined = actividades_favoritas.join(', ');
        prefData.actividades_favoritas = joined;
        prefData.intereses_bienestar = typeof intereses_bienestar === 'string' && intereses_bienestar.trim() ? intereses_bienestar : joined;
      } else if (typeof actividades_favoritas === 'string' && actividades_favoritas.trim()) {
        // frontend may send a joined string already
        prefData.actividades_favoritas = actividades_favoritas;
        if (!prefData.intereses_bienestar) prefData.intereses_bienestar = actividades_favoritas;
      } else if (typeof intereses_bienestar === 'string') {
        prefData.intereses_bienestar = intereses_bienestar;
      }
      if (typeof zona_horaria === 'string') prefData.zona_horaria = zona_horaria;
      if (typeof idioma === 'string') prefData.idioma = idioma;
      if (typeof pais === 'string') prefData.pais = pais;
      if (typeof tema === 'string') prefData.tema = tema;
      if (typeof color_principal === 'string') prefData.color_principal = color_principal;
      // Ensure sobre_mi is included before persisting
      if (typeof sobre_mi === 'string') prefData.sobre_mi = sobre_mi;

      // Debug: show the mapped prefData we're about to persist
      try {
        const pd = JSON.stringify(prefData);
        console.info('[perfil:put] prefData=', pd.length > 1000 ? pd.slice(0, 1000) + '... (truncated)' : pd);
      } catch (e) {
        console.info('[perfil:put] could not stringify prefData', e && e.message ? e.message : e);
      }

      const existingPref = await prisma.preferencias_usuario.findFirst({ where: { id_usuario: userId } });
      if (existingPref) {
        // Only update fields that exist in the model
        if (Object.keys(prefData).length > 0) {
          const updated = await prisma.preferencias_usuario.update({
            where: { id_preferencia: existingPref.id_preferencia },
            data: prefData,
          });
          console.info('[perfil:put] preferencias_usuario updated id=', existingPref.id_preferencia);
        }
      } else {
        const created = await prisma.preferencias_usuario.create({
          data: Object.assign({ id_usuario: userId }, prefData),
        });
        console.info('[perfil:put] preferencias_usuario created id=', created.id_preferencia);
      }
    } catch (e) {
      // log but don't fail the whole update
      console.error('Error upserting preferencias_usuario', e && e.message ? e.message : e);
    }

    // Return the updated user including preferencias merged
    const refreshed = await prisma.usuarios.findUnique({
      where: { id_usuario: userId },
      include: { preferencias: true },
    });
    res.json(refreshed);
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando perfil'));
  }
});

// POST /api/usuario/perfil/foto - Subir foto de perfil (base64 o url)
// Support multipart uploads (field 'photo'), external URL in JSON { url }, or base64 in JSON { foto_perfil }
// Use project root uploads folder so static serving at /uploads matches saved files
const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
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

router.post('/foto', requireAuth, upload.single('photo'), async (req, res, next) => {
  const createError = require('http-errors');
  // Temporary debug logs: print Content-Type and whether file/body is present
  try {
    console.info('[upload-foto] headers.content-type=', req.headers['content-type']);
    console.info('[upload-foto] ip=', req.ip || req.connection?.remoteAddress, 'hasBody=', !!req.body, 'hasFile=', !!req.file);
    if (req.file) console.info('[upload-foto] file=', { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, filename: req.file.filename });
  } catch (e) {
    // ignore logging errors
  }
  try {
    const userId = req.user.sub;
    const existe = await prisma.usuarios.findUnique({ where: { id_usuario: userId } });
    if (!existe) return next(createError(404, 'Perfil no encontrado'));

    // 1) External URL via JSON body { url: 'https://...' }
    if (req.body && req.body.url) {
      const url = String(req.body.url).trim();
      const user = await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: url } });
      return res.json({ ok: true, foto_perfil: user.foto_perfil });
    }

    // 2) Base64 payload in JSON { foto_perfil: 'data:image/png;base64,...' }
    if (req.body && req.body.foto_perfil && typeof req.body.foto_perfil === 'string' && req.body.foto_perfil.startsWith('data:')) {
      const b64 = req.body.foto_perfil;
      const matches = b64.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!matches) return next(createError(400, 'Invalid base64 image'));
      const mime = matches[1];
      const data = matches[2];
      const ext = mime.split('/')[1] || 'png';
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const filepath = path.join(avatarsDir, filename);
      fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
      const relativeUrl = `/uploads/avatars/${filename}`;
      const absoluteUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;

      // remove old local file if present. If existe.foto_perfil is an absolute URL
      // that points to our host, delete the local file based on pathname.
      if (existe.foto_perfil) {
        try {
          if (String(existe.foto_perfil).startsWith('http')) {
            const parsed = new URL(existe.foto_perfil);
            if (parsed.host === req.get('host')) {
              const oldRelative = parsed.pathname.replace(/^\//, '');
              const oldPath = path.join(process.cwd(), oldRelative);
              fs.unlink(oldPath, () => {});
            }
          } else {
            const oldRelative = String(existe.foto_perfil).replace(/^\//, '');
            const oldPath = path.join(process.cwd(), oldRelative);
            fs.unlink(oldPath, () => {});
          }
        } catch (e) {
          // ignore deletion errors
        }
      }

      const user = await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: absoluteUrl } });
      return res.json({ ok: true, foto_perfil: user.foto_perfil });
    }

    // 3) Multipart file upload (handled by multer)
    if (req.file) {
      const relativeUrl = `/uploads/avatars/${req.file.filename}`;
      const absoluteUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;

      // remove old local file if present
      if (existe.foto_perfil) {
        try {
          if (String(existe.foto_perfil).startsWith('http')) {
            const parsed = new URL(existe.foto_perfil);
            if (parsed.host === req.get('host')) {
              const oldRelative = parsed.pathname.replace(/^\//, '');
              const oldPath = path.join(process.cwd(), oldRelative);
              fs.unlink(oldPath, () => {});
            }
          } else {
            const oldRelative = String(existe.foto_perfil).replace(/^\//, '');
            const oldPath = path.join(process.cwd(), oldRelative);
            fs.unlink(oldPath, () => {});
          }
        } catch (e) {
          // ignore deletion errors
        }
      }

      const user = await prisma.usuarios.update({ where: { id_usuario: userId }, data: { foto_perfil: absoluteUrl } });
      return res.json({ ok: true, foto_perfil: user.foto_perfil });
    }

    return next(createError(400, 'No image provided'));
  } catch (err) {
    next(createError(500, err.message || 'Error actualizando foto de perfil'));
  }
});

module.exports = { perfilRouter: router };
