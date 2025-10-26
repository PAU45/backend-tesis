# API Kanban Backend - Endpoints y Ejemplos

## Autenticación

Todas las rutas protegidas requieren el header:
```
Authorization: Bearer <accessToken>
```

---

## Grupos

### Listar grupos del usuario
- `GET /api/grupos`
- Respuesta:
```json
[
  { "id_grupo": 1, "nombre": "Equipo Alpha" },
  { "id_grupo": 2, "nombre": "Equipo Beta" }
]
```

### Detalles de grupo (miembros, líderes)
- `GET /api/grupos/:grupoId`
- Respuesta:
```json
{
  "id_grupo": 1,
  "nombre": "Equipo Alpha",
  "miembros": [
    { "id_grupo_miembro": 1, "rol_en_grupo": "lider", "usuario": { "id_usuario": 1, "nombre": "Paulo" } },
    { "id_grupo_miembro": 2, "rol_en_grupo": "miembro", "usuario": { "id_usuario": 2, "nombre": "Ana" } }
  ]
}
```

---

## Tableros (Boards)

### Crear tablero (solo líder)
- `POST /api/boards`
- Body:
```json
{ "nombre": "Tablero 1", "descripcion": "Proyectos", "id_grupo": 1 }
```
- Respuesta:
```json
{ "id": 1, "nombre": "Tablero 1", "descripcion": "Proyectos", "id_grupo": 1 }
```

### Listar tableros por grupo
- `GET /api/boards/grupo/:grupoId`
- Respuesta:
```json
[
  { "id": 1, "nombre": "Tablero 1" },
  { "id": 2, "nombre": "Tablero 2" }
]
```

### Editar tablero
- `PUT /api/boards/:boardId`
- Body: `{ "nombre": "Nuevo nombre", "descripcion": "Nueva desc" }`
- Respuesta: `{ ...board actualizado... }`

### Eliminar tablero
- `DELETE /api/boards/:boardId`
- Respuesta: `{ "ok": true }`

---

## Columnas (Columns)

### Crear columna (solo líder)
- `POST /api/columns`
- Body: `{ "nombre": "Pendiente", "id_board": 1, "orden": 1 }`
- Respuesta: `{ "id": 1, "nombre": "Pendiente" }`

### Listar columnas por board
- `GET /api/columns/board/:boardId`
- Respuesta:
```json
[
  { "id": 1, "nombre": "Pendiente", "orden": 1 },
  { "id": 2, "nombre": "En progreso", "orden": 2 }
]
```

### Editar columna
- `PUT /api/columns/:columnId`
- Body: `{ "nombre": "Hecho", "orden": 3 }`
- Respuesta: `{ ...columna actualizada... }`

### Eliminar columna
- `DELETE /api/columns/:columnId`
- Respuesta: `{ "ok": true }`

### Reordenar columnas
- `PATCH /api/columns/reorder`
- Body: `{ "id_board": 1, "ordenes": [ { "id": 1, "orden": 2 }, { "id": 2, "orden": 1 } ] }`
- Respuesta: `[ ...columnas actualizadas... ]`

---

## Tareas (Tasks)

### Crear tarea
- `POST /api/tasks`
- Body:
```json
{
  "titulo": "Revisar docs",
  "descripcion": "Leer documentación",
  "id_column": 1,
  "id_board": 1,
  "id_grupo": 1,
  "prioridad": "alta",
  "etiquetas": "importante,backend",
  "fechaVencimiento": "2025-10-30T23:59:00.000Z",
  "estado": "pendiente",
  "id_sprint": 1,
  "asignados": [2, 3]
}
```
- Respuesta: `{ "id": 1, "titulo": "Revisar docs" }`

### Listar tareas con filtros
- `GET /api/tasks?id_board=1&estado=pendiente&asignadoId=2`
- Respuesta:
```json
[
  {
    "id": 1,
    "titulo": "Revisar docs",
    "estado": "pendiente",
    "asignados": [
      { "id_task": 1, "id_usuario": 2 },
      { "id_task": 1, "id_usuario": 3 }
    ]
  }
]
```

### Editar tarea
- `PUT /api/tasks/:taskId`
- Body: `{ "titulo": "Nuevo título", "asignados": [2] }`
- Respuesta: `{ ...tarea actualizada... }`

### Eliminar tarea
- `DELETE /api/tasks/:taskId`
- Respuesta: `{ "ok": true }`

### Mover tarea de columna
- `PATCH /api/tasks/:taskId/move`
- Body: `{ "id_column": 2 }`
- Respuesta: `{ ...tarea actualizada... }`

---

## Sprints

### Crear sprint (solo líder)
- `POST /api/sprints`
- Body:
```json
{
  "id_board": 1,
  "nombre": "Sprint 1",
  "fechaInicio": "2025-10-21",
  "fechaFin": "2025-10-28",
  "estado": "activo"
}
```
- Respuesta: `{ "id": 1, "nombre": "Sprint 1" }`

### Listar sprints por board
- `GET /api/sprints/board/:boardId`
- Respuesta:
```json
[
  { "id": 1, "nombre": "Sprint 1" },
  { "id": 2, "nombre": "Sprint 2" }
]
```

### Editar sprint
- `PUT /api/sprints/:sprintId`
- Body: `{ "nombre": "Sprint 1 actualizado", "estado": "finalizado" }`
- Respuesta: `{ ...sprint actualizado... }`

### Eliminar sprint
- `DELETE /api/sprints/:sprintId`
- Respuesta: `{ "ok": true }`

### Asignar tareas a sprint
- `PATCH /api/sprints/:sprintId/assign-tasks`
- Body: `{ "taskIds": [1, 2, 3] }`
- Respuesta: `{ "ok": true }`

---

## Ejemplo de uso en frontend (fetch/axios)

```js
// Listar boards de un grupo
const res = await fetch('/api/boards/grupo/1', {
  headers: { Authorization: 'Bearer ' + accessToken }
});
const boards = await res.json();

// Crear tarea
await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
  body: JSON.stringify({
    titulo: 'Nueva tarea',
    id_column: 1,
    id_board: 1,
    id_grupo: 1,
    asignados: [2, 3]
  })
});
```

---

## Notas para el frontend
- Siempre enviar el header `Authorization: Bearer <accessToken>` en todas las rutas protegidas.
- Los IDs (`id_grupo`, `id_board`, `id_column`, etc.) se obtienen de las respuestas de los endpoints de grupos, boards y columns.
- Los endpoints devuelven arrays u objetos listos para mapear en el frontend.
- Los errores vienen en formato `{ error: 'mensaje' }` y los OK en `{ ok: true }`.
