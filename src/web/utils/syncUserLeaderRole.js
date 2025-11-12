// utils/syncUserLeaderRole.js
// Sincroniza el rol 'líder' en usuarios_roles según si el usuario es líder de algún grupo

const { prisma } = require('../../prisma');

async function syncUserLeaderRole(userId, tx = prisma) {
  // ¿Es líder de algún grupo?
  const lidera = await tx.grupos_trabajo.count({ where: { leader_id: userId } });
  const lideraMiembro = await tx.grupos_miembros.count({ where: { id_usuario: userId, is_leader: true } });
  // Si el usuario es líder en algún grupo (como owner o como miembro marcado líder)
  const isLeader = lidera > 0 || lideraMiembro > 0;

  // Buscar id del rol 'líder'
  const rol = await tx.roles.findFirst({ where: { nombre_rol: 'líder' } });
  if (!rol) return; // No existe el rol

  const tieneRol = await tx.usuarios_roles.findFirst({ where: { id_usuario: userId, id_rol: rol.id_rol } });

  if (isLeader && !tieneRol) {
    // Agregar rol líder
    await tx.usuarios_roles.create({ data: { id_usuario: userId, id_rol: rol.id_rol } });
  } else if (!isLeader && tieneRol) {
    // Quitar rol líder
    await tx.usuarios_roles.delete({ where: { id_usuario_id_rol: { id_usuario: userId, id_rol: rol.id_rol } } });
  }
}

module.exports = { syncUserLeaderRole };
