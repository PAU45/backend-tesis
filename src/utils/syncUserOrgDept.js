// utils/syncUserOrgDept.js
// Sincroniza id_org e id_departamento de los usuarios según el grupo
// tx: instancia de transacción Prisma
async function syncUsersOrgDept(tx, groupId, userIds) {
  try {
    console.log('[SYNC] Iniciando syncUsersOrgDept', { groupId, userIds });
  } catch (e) {
    process.stdout.write('[SYNC] Iniciando syncUsersOrgDept:' + JSON.stringify({ groupId, userIds }) + '\n');
  }

  const group = await tx.grupos_trabajo.findUnique({ where: { id_grupo: groupId } });
  if (!group) {
    try {
      console.error('[SYNC] Grupo no encontrado para sync:', groupId);
    } catch (e) {
      process.stderr.write('[SYNC] Grupo no encontrado para sync:' + groupId + '\n');
    }
    throw new Error('Grupo no encontrado');
  }
  const updates = [];
  for (const userId of userIds) {
    try {
      console.log('[SYNC] Actualizando usuario:', { userId, id_org: group.id_org, id_departamento: group.id_departamento });
    } catch (e) {
      process.stdout.write('[SYNC] Actualizando usuario:' + JSON.stringify({ userId, id_org: group.id_org, id_departamento: group.id_departamento }) + '\n');
    }
    updates.push(
      tx.usuarios.update({
        where: { id_usuario: userId },
        data: {
          id_org: group.id_org,
          id_departamento: group.id_departamento
        }
      })
    );
  }
  await Promise.all(updates);
  try {
    console.log('[SYNC] Finalizó syncUsersOrgDept para usuarios:', userIds);
  } catch (e) {
    process.stdout.write('[SYNC] Finalizó syncUsersOrgDept para usuarios:' + JSON.stringify(userIds) + '\n');
  }
}
module.exports = { syncUsersOrgDept };
