require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async function(){
  try {
    const roles = await prisma.roles.findMany();
    console.log(roles.map(r => ({ id: r.id_rol, nombre: r.nombre_rol, descripcion: r.descripcion })));
  } catch (err) {
    console.error('Error listando roles:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
