require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const email = `unassigned${i}@local.test`;
    const existing = await prisma.usuarios.findUnique({ where: { email } });
    if (existing) {
      console.log(`Exists: ${email} (id=${existing.id_usuario})`);
      users.push(existing);
      continue;
    }
    const password_hash = await bcrypt.hash('worker123', 10);
    const u = await prisma.usuarios.create({
      data: {
        nombre: `Unassigned ${i}`,
        email,
        password_hash,
        estado: 'activo',
        // intentionally no id_org nor id_departamento
        fecha_creacion: new Date(),
      },
    });
    users.push(u);
    console.log(`Created: ${email} (id=${u.id_usuario})`);
  }

  console.log('\nSummary: created or found users:');
  users.forEach(u => console.log(`- ${u.email} id=${u.id_usuario}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
