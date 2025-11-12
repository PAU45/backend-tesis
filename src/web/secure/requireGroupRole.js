// src/web/secure/requireGroupRole.js
const { prisma } = require('../../prisma');

// Middleware: requireGroupRole('miembro') o requireGroupRole('lider')
function requireGroupRole(requiredRole = 'miembro') {
  return async (req, res, next) => {
    const userId = req.user.sub;
    const groupId = Number(req.params.grupoId || req.body.id_grupo || req.query.grupoId);
    if (!groupId) return res.status(400).json({ error: 'Falta id de grupo' });
    // Allow privileged roles to bypass membership check
    const rolesRaw = req.user?.roles || req.user?.role || [];
    const roles = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
    if (roles.includes('admin') || roles.includes('supervisor')) {
      // privileged user: allow access without being a member
      req.groupRole = 'privileged';
      return next();
    }

    const miembro = await prisma.grupos_miembros.findFirst({
      where: { id_grupo: groupId, id_usuario: userId },
    });
    if (!miembro) return res.status(403).json({ error: 'No eres miembro de este grupo' });
    if (requiredRole === 'lider') {
      // Verifica si el usuario es líder explícito del grupo (grupos_trabajo.leader_id)
      const grupo = await prisma.grupos_trabajo.findUnique({ where: { id_grupo: groupId } });
      if (!grupo || grupo.leader_id !== userId) {
        return res.status(403).json({ error: 'Solo líderes pueden realizar esta acción' });
      }
      req.groupRole = 'lider';
      return next();
    }
    req.groupRole = miembro.rol_en_grupo;
    next();
  };
}

module.exports = { requireGroupRole };
