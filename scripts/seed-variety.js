require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Create a few organizations with multiple departments for variety
  const orgs = [
    { nombre: 'Globex Corporation', sector: 'Manufactura', pais: 'US', tamano: 500 },
    { nombre: 'Innova Labs', sector: 'Investigación', pais: 'ES', tamano: 120 },
    { nombre: 'GreenFoods', sector: 'Alimentos', pais: 'PE', tamano: 60 },
  ];

  const createdOrgs = [];
  for (const o of orgs) {
    // `nombre` isn't a unique key in the schema, so use findFirst/create
    let org = await prisma.organizaciones.findFirst({ where: { nombre: o.nombre } });
    if (!org) {
      org = await prisma.organizaciones.create({ data: { nombre: o.nombre, sector: o.sector, pais: o.pais, tamano: o.tamano, fecha_creacion: new Date() } });
    } else {
      // ensure metadata updated
      org = await prisma.organizaciones.update({ where: { id_org: org.id_org }, data: { sector: o.sector, pais: o.pais, tamano: o.tamano } });
    }
    createdOrgs.push(org);
  }

  // Departments per organization
  const departments = {
    'Globex Corporation': ['Producción', 'Calidad', 'Logística', 'RRHH'],
    'Innova Labs': ['I+D', 'Data Science', 'Regulación', 'Comercial'],
    'GreenFoods': ['Producción', 'Ventas', 'Marketing', 'Sostenibilidad'],
  };

  const createdDeps = [];
  for (const org of createdOrgs) {
    const list = departments[org.nombre] || ['General'];
    for (const dname of list) {
      let dep = await prisma.departamentos.findFirst({ where: { id_org: org.id_org, nombre: dname } });
      if (!dep) {
        dep = await prisma.departamentos.create({ data: { id_org: org.id_org, nombre: dname, descripcion: dname } });
      } else {
        dep = await prisma.departamentos.update({ where: { id_departamento: dep.id_departamento }, data: { nombre: dname } });
      }
      createdDeps.push(dep);
    }
  }

  console.log('Created/ensured organizations and departments:');
  createdOrgs.forEach(o => console.log(`- Org: ${o.nombre} (id=${o.id_org})`));
  createdDeps.forEach(d => console.log(`- Dept: ${d.nombre} (id=${d.id_departamento}) org=${d.id_org}`));

  // Create additional unassigned users (no id_org, no id_departamento)
  const unassignedEmails = [];
  for (let i = 6; i <= 15; i++) unassignedEmails.push(`unassigned${i}@local.test`);

  const createdUsers = [];
  const password_hash = await bcrypt.hash('worker123', 10);
  for (const email of unassignedEmails) {
    const existing = await prisma.usuarios.findUnique({ where: { email } });
    if (existing) {
      createdUsers.push(existing);
      console.log(`Exists: ${email} (id=${existing.id_usuario})`);
      continue;
    }
    const u = await prisma.usuarios.create({
      data: {
        nombre: email.split('@')[0].replace('.', ' '),
        email,
        password_hash,
        estado: 'activo',
        fecha_creacion: new Date(),
      },
    });
    createdUsers.push(u);
    console.log(`Created user: ${email} (id=${u.id_usuario})`);
  }

  console.log('\nSummary:');
  console.log(`Organizations ensured: ${createdOrgs.length}`);
  console.log(`Departments ensured: ${createdDeps.length}`);
  console.log(`Unassigned users created or found: ${createdUsers.length}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
