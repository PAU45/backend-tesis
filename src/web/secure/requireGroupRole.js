// src/web/secure/requireGroupRole.js
const { prisma } = require('../../prisma');

// Middleware: requireGroupRole('miembro') o requireGroupRole('lider')
function requireGroupRole(requiredRole = 'miembro') {
  return async (req, res, next) => {
    const userId = req.user.sub;
    const groupId = Number(req.params.grupoId || req.body.id_grupo || req.query.grupoId);
    if (!groupId) return res.status(400).json({ error: 'Falta id de grupo' });
    const miembro = await prisma.grupos_miembros.findFirst({
      where: { id_grupo: groupId, id_usuario: userId },
    });
    if (!miembro) return res.status(403).json({ error: 'No eres miembro de este grupo' });
    if (requiredRole === 'lider' && miembro.rol_en_grupo !== 'lider') {
      return res.status(403).json({ error: 'Solo líderes pueden realizar esta acción' });
    }
    req.groupRole = miembro.rol_en_grupo;
    next();
  };
}

module.exports = { requireGroupRole };
