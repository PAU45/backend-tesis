require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nombre = process.argv[2] || process.env.ROLE_NAME || 'supervisor';
  try {
    const role = await prisma.roles.upsert({
      where: { nombre_rol: nombre },
      update: { descripcion: `${nombre} role` },
      create: { nombre_rol: nombre, descripcion: `${nombre} role` },
    });
    console.log(`Role asegurado: ${role.nombre_rol} (id=${role.id_rol})`);
  } catch (err) {
    console.error('Error creando/asegurando rol:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
