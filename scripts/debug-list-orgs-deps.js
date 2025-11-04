const { PrismaClient } = require('@prisma/client');
(async function(){
  const p = new PrismaClient();
  try {
    const orgs = await p.organizaciones.findMany({ include: { departamentos: true } });
    console.log('ORGANIZATIONS:', JSON.stringify(orgs, null, 2));
  } catch (e) { console.error(e); }
  await p.$disconnect();
})();
