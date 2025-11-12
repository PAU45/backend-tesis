require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ORG_ID = 5;
const DEP_ID = 10;

async function main() {
  const testUserId = process.env.TEST_USER_ID ? Number(process.env.TEST_USER_ID) : undefined;
  let user;

  if (testUserId) {
    user = await prisma.usuarios.findUnique({ where: { id_usuario: testUserId } });
    if (!user) {
      console.error(`No se encontró usuario con id_usuario=${testUserId}`);
      process.exit(1);
    }
  } else {
    user = await prisma.usuarios.findFirst({ where: { id_org: ORG_ID, id_departamento: DEP_ID } });
    if (!user) {
      console.error(`No se encontró ningún usuario con id_org=${ORG_ID} y id_departamento=${DEP_ID}. Puedes crear uno o setear TEST_USER_ID en el entorno.`);
      process.exit(1);
    }
  }

  console.log('Usando usuario:', { id_usuario: user.id_usuario, email: user.email, id_org: user.id_org, id_departamento: user.id_departamento });

  const groupData = {
    name: `Grupo de prueba - ${Date.now()}`,
    description: 'Grupo creado por script de pruebas',
    id_org: ORG_ID,
    id_departamento: DEP_ID,
    leader_id: user.id_usuario,
    visibility: 'private',
    created_by: user.id_usuario,
  };

  // El modelo en prisma usa nombres en español internamente; mapear a los campos reales
  const created = await prisma.grupos_trabajo.create({
    data: {
      nombre: groupData.name,
      descripcion: groupData.description,
      id_org: groupData.id_org,
      id_departamento: groupData.id_departamento,
      leader_id: groupData.leader_id,
      visibility: groupData.visibility,
      created_by: groupData.created_by,
    },
  });

  console.log('Grupo creado:', { id_grupo: created.id_grupo, nombre: created.nombre });

  // Opcional: si se provee TEST_TOKEN intentamos hacer un GET a la API local para comprobar que aparece
  const token = process.env.TEST_TOKEN;
  if (token) {
    try {
      if (typeof fetch !== 'function') {
        console.warn('fetch no disponible en este runtime. Si tienes Node >=18 fetch existe; de lo contrario ejecuta manualmente el GET con PowerShell o curl.');
      } else {
        const url = 'http://localhost:3000/api/groups?mine=true';
        console.log('Intentando GET', url);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.text();
        console.log('GET status=', res.status);
        try {
          console.log('GET body=', JSON.parse(body));
        } catch (e) {
          console.log('GET body (raw)=', body);
        }
      }
    } catch (e) {
      console.error('Error intentando GET a la API local:', e);
    }
  } else {
    console.log('No se proporcionó TEST_TOKEN; para verificar el GET ejecuta el siguiente comando (PowerShell):\n');
    console.log("Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/groups?mine=true' -Headers @{ Authorization = 'Bearer TOKEN' }");
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
