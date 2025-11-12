// scripts/add-lider-role.js
// Script para agregar el rol 'líder' a la tabla roles si no existe

const { prisma } = require('../src/prisma');

async function main() {
  const exists = await prisma.roles.findFirst({ where: { nombre_rol: 'líder' } });
  if (exists) {
    console.log('El rol "líder" ya existe.');
    return;
  }
  const nuevo = await prisma.roles.create({
    data: {
      nombre_rol: 'líder',
      descripcion: 'líder de grupo',
    },
  });
  console.log('Rol "líder" creado:', nuevo);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
