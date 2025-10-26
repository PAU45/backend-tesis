const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Roles
  const roles = ['admin', 'rrhh', 'supervisor', 'usuario', 'psicologo'];
  for (const nombre_rol of roles) {
    await prisma.roles.upsert({
      where: { nombre_rol },
      update: { nombre_rol },
      create: { nombre_rol, descripcion: `${nombre_rol} role` },
    });
  }

  // Permissions basic CRUD as example
  const acciones = ['crear', 'leer', 'actualizar', 'eliminar'];
  const recursos = ['usuarios', 'organizaciones', 'tareas'];
  for (const recurso of recursos) {
    for (const accion of acciones) {
      await prisma.permisos.create({ data: { recurso, accion } }).catch(() => {});
    }
  }

  // Organization and department
  const org = await prisma.organizaciones.create({
    data: { nombre: 'Acme Corp', sector: 'Tecnología', pais: 'PE', tamano: 100, fecha_creacion: new Date() },
  });

  const dep = await prisma.departamentos.create({ data: { id_org: org.id_org, nombre: 'TI', descripcion: 'Tecnología' } });

  // Admin user
  const password_hash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuarios.upsert({
    where: { email: 'admin@soulspace.test' },
    update: {},
    create: {
      nombre: 'Admin',
      email: 'admin@soulspace.test',
      password_hash,
      estado: 'activo',
      id_org: org.id_org,
      id_departamento: dep.id_departamento,
      fecha_creacion: new Date(),
    },
  });

  await prisma.usuarios_roles.create({ data: { id_usuario: admin.id_usuario, id_rol: 1, created_at: new Date() } }).catch(() => {});

  // Sample content
  await prisma.recursos_biblioteca.create({
    data: {
      titulo: 'Introducción al Mindfulness',
      tipo: 'artículo',
      url: 'https://example.com/mindfulness',
      categoria: 'mindfulness',
      descripcion: 'Guía básica',
      estado: 'publicado',
      created_at: new Date(),
    },
  });

  // A daily question
  await prisma.preguntas_diarias.create({ data: { titulo: '¿Cómo te sientes hoy?', tipo: 'slider', opciones: '[1,2,3,4,5]', estado: 'activa' } });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
