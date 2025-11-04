const { PrismaClient } = require('@prisma/client');
(async function(){
  const p = new PrismaClient();
  try {
    const u = await p.usuarios.findUnique({ where: { email: 'supervisor@soulspace.test' } });
    console.log(JSON.stringify(u, null, 2));
  } catch (e) { console.error(e); }
  await p.$disconnect();
})();
