require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const prisma = new PrismaClient();

const GROUP_ID = 17;
const USER_ID = 6;
const API_URL = 'http://localhost:3000/api';
const TOKEN = process.env.TEST_TOKEN;

async function main() {
  if (!TOKEN) {
    console.error('Debes definir TEST_TOKEN en el entorno (JWT válido para el usuario 6)');
    process.exit(1);
  }

  // Paso 1: Crear board
  const boardRes = await fetch(`${API_URL}/boards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nombre: 'Tablero Demo',
      descripcion: 'Tablero de prueba',
      id_grupo: GROUP_ID,
    }),
  });
  const board = await boardRes.json();
  if (!board.id) {
    console.error('No se pudo crear el board:', board);
    process.exit(1);
  }
  console.log('Board creado:', board);

  // Paso 2: Crear columna
  const columnRes = await fetch(`${API_URL}/columns`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nombre: 'Pendientes',
      id_board: board.id,
      orden: 1,
    }),
  });
  const column = await columnRes.json();
  if (!column.id) {
    console.error('No se pudo crear la columna:', column);
    process.exit(1);
  }
  console.log('Columna creada:', column);

  // Paso 3: Crear tarea
  const taskRes = await fetch(`${API_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      titulo: 'Tarea de prueba',
      descripcion: 'Primera tarea',
      id_column: column.id,
      id_board: board.id,
      id_grupo: GROUP_ID,
      prioridad: 'media',
    }),
  });
  const task = await taskRes.json();
  if (!task.id) {
    console.error('No se pudo crear la tarea:', task);
    process.exit(1);
  }
  console.log('Tarea creada:', task);

  // Paso 4: Mostrar resumen
  console.log('\nListo. Refresca el frontend y deberías ver el board, columna y tarea en el Kanban.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
