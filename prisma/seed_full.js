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

  // Sample group
  const grupo = await prisma.grupos_trabajo.create({
    data: {
      id_org: org.id_org,
      nombre: 'Equipo TI',
      descripcion: 'Grupo de tecnología',
      progreso_pct: 0,
      estado: 'activo',
    },
  });

  await prisma.grupos_miembros.create({
    data: {
      id_grupo: grupo.id_grupo,
      id_usuario: admin.id_usuario,
      rol_en_grupo: 'admin',
      joined_at: new Date(),
    },
  });

  // Configuración de notificaciones y privacidad para el admin
  await prisma.configuracion_notificaciones.create({
    data: {
      id_usuario: admin.id_usuario,
      meditacion: true,
      tareas: true,
      preguntas_diarias: true,
      bienestar_recordatorios: true,
    },
  });

  // Intentar crear la fila de privacidad; si el campo `backup_automatico` no
  // existe en el modelo/DB, reintentar sin ese campo para mantener compatibilidad
  try {
    await prisma.privacidad_datos.create({
      data: {
        id_usuario: admin.id_usuario,
        compartir_con_investigadores: true,
        modo_offline: false,
        backup_automatico: true,
        fecha_aceptacion: new Date(),
      },
    });
  } catch (err) {
    console.warn('No se pudo insertar `backup_automatico` (campo ausente). Reintentando sin ese campo.');
    await prisma.privacidad_datos.create({
      data: {
        id_usuario: admin.id_usuario,
        compartir_con_investigadores: true,
        modo_offline: false,
        fecha_aceptacion: new Date(),
      },
    });
  }

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

  console.log('Seed full completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
