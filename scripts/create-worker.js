require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.WORKER_EMAIL || 'trabajador@soulspace.test';
  const password = process.env.WORKER_PASSWORD || 'worker123';
  const nombre = process.env.WORKER_NAME || 'Trabajador Demo';

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

  // Asegurar rol "usuario"
  // Buscar/asegurar rol "usuario" por nombre (no depender de ids hardcodeados)
  const rolUsuario = await prisma.roles.upsert({
    where: { nombre_rol: 'usuario' },
    update: { descripcion: 'Rol trabajador' },
    create: { nombre_rol: 'usuario', descripcion: 'Rol trabajador' },
  });

  // Crear usuario
  const existing = await prisma.usuarios.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario ya existe: ${email} (id=${existing.id_usuario})`);
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
    await prisma.usuarios_roles.create({ data: { id_usuario: user.id_usuario, id_rol: rolUsuario.id_rol, created_at: new Date() } }).catch(() => {});
    console.log(`Usuario creado: ${email} (password=${password})`);
  }

  // Mostrar credenciales
  console.log('\nCredenciales de acceso:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
