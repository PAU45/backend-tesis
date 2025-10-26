require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function ensureOrgAndDept() {
  const org = await prisma.organizaciones.upsert({
    where: { id_org: 1 },
    update: {},
    create: { nombre: 'Org Demo', sector: 'Servicios', pais: 'PE', tamano: 10, fecha_creacion: new Date() },
  });

  const dep = await prisma.departamentos.upsert({
    where: { id_departamento: 1 },
    update: {},
    create: { id_org: org.id_org, nombre: 'Dirección', descripcion: 'Área administrativa' },
  });
  return { org, dep };
}

async function ensureRole(nombre_rol) {
  let role = await prisma.roles.findFirst({ where: { nombre_rol } });
  if (!role) {
    role = await prisma.roles.create({ data: { nombre_rol, descripcion: `${nombre_rol} role` } });
  }
  return role;
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin2@soulspace.test';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const nombre = process.env.ADMIN_NAME || 'Admin Secundario';

  const { org, dep } = await ensureOrgAndDept();
  const adminRole = await ensureRole('admin');

  let user = await prisma.usuarios.findUnique({ where: { email } });
  if (!user) {
    const password_hash = await bcrypt.hash(password, 10);
    user = await prisma.usuarios.create({
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
    console.log(`Usuario admin creado: ${email} (password=${password})`);
  } else {
    console.log(`Usuario ya existe: ${email} (id=${user.id_usuario})`);
  }

  // Asegurar asignación de rol admin
  const existingLink = await prisma.usuarios_roles.findFirst({ where: { id_usuario: user.id_usuario, id_rol: adminRole.id_rol } });
  if (!existingLink) {
    await prisma.usuarios_roles.create({ data: { id_usuario: user.id_usuario, id_rol: adminRole.id_rol, created_at: new Date() } });
  }

  console.log('\nCredenciales admin:');
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
