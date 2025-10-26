require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || process.env.SUPERVISOR_EMAIL || 'supervisor@soulspace.test';
  const password = process.argv[3] || process.env.SUPERVISOR_PASSWORD || 'supervisor123';
  const nombre = process.argv[4] || process.env.SUPERVISOR_NAME || 'Supervisor Demo';

  // Asegurar organización y departamento por defecto
  const org = await prisma.organizaciones.upsert({
    where: { id_org: 1 },
    update: {},
    create: { nombre: 'Org Demo', sector: 'Servicios', pais: 'PE', tamano: 10, fecha_creacion: new Date() },
  });

  const dep = await prisma.departamentos.upsert({
    where: { id_departamento: 1 },
    update: {},
    create: { id_org: org.id_org, nombre: 'Operaciones', descripcion: 'Operativos' },
  });

  // Asegurar rol "supervisor" por nombre
  const rolSupervisor = await prisma.roles.upsert({
    where: { nombre_rol: 'supervisor' },
    update: { descripcion: 'supervisor role' },
    create: { nombre_rol: 'supervisor', descripcion: 'supervisor role' },
  });

  // Crear usuario supervisor
  const existing = await prisma.usuarios.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario ya existe: ${email} (id=${existing.id_usuario})`);
    // Asegurar asignación de rol si no existe
    const rel = await prisma.usuarios_roles.findFirst({ where: { id_usuario: existing.id_usuario, id_rol: rolSupervisor.id_rol } });
    if (!rel) {
      await prisma.usuarios_roles.create({ data: { id_usuario: existing.id_usuario, id_rol: rolSupervisor.id_rol, created_at: new Date() } }).catch(() => {});
      console.log(`Rol 'supervisor' asignado al usuario id=${existing.id_usuario}`);
    } else {
      console.log(`Usuario ya tenía el rol 'supervisor'`);
    }
  } else {
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.usuarios.create({
      data: {
        nombre,
        email,
        password_hash,
        estado: 'activo',
        id_org: org.id_org,
        id_departamento: dep.id_departamento,
        fecha_creacion: new Date(),
      },
    });
    await prisma.usuarios_roles.create({ data: { id_usuario: user.id_usuario, id_rol: rolSupervisor.id_rol, created_at: new Date() } }).catch(() => {});
    console.log(`Usuario supervisor creado: ${email} (password=${password}) (id=${user.id_usuario})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
