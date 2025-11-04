## Grupos de Trabajo — API (Backend)

Este documento resume los endpoints disponibles en el backend para gestionar "Grupos de Trabajo", payloads de ejemplo, reglas de negocio y cómo integrarlo desde el frontend.

Base URL (desarrollo): http://localhost:3000/api

Nota: el backend expone rutas en español y alias en inglés donde aplica:
- `/api/grupos`  (routes en español)
- `/api/groups`  (alias en inglés, apunta al mismo router)

Autenticación
- JWT Bearer en header `Authorization: Bearer <token>`.
- Obtener token con `POST /api/auth/login`.
- Sólo usuarios con rol `supervisor` o `admin` pueden crear/editar/administrar grupos y acceder a `GET /api/users?unassigned=true`.

Credenciales seed (dev):
- supervisor: `supervisor@soulspace.test` / `supervisor123` (si se ejecutaron los scripts de seed)

Endpoints principales

1) POST /api/groups  (alias: /api/grupos)
- Propósito: crear un grupo.
- Permisos: `admin|supervisor`.
- Request body (ejemplo):
```json
{
  "name": "Desarrollo Frontend",
  "description": "Proyecto X",
  "id_org": 1,
  "id_departamento": 2,
  "leader_id": 12,
  "visibility": "org"
}
```
- Response 201:
```json
{ "group": { "id_grupo": 42, "nombre": "Desarrollo Frontend", "id_org": 1 } }
```

2) GET /api/groups  (alias: /api/grupos)
- Propósito: listar grupos con filtros simples.
- Query params: `id_org`, `id_departamento`, `mine=true`.
- Response 200:
```json
{ "groups": [ { "id_grupo": 1, "nombre": "...", "members_count": 6 } ] }
```

3) GET /api/groups/:id  (alias: /api/grupos/:id)
- Propósito: detalle de grupo (incluye miembros y usuario).
- Permisos: requiere autenticación; `requireGroupRole` aplica para accesos restringidos.
- Response 200:
```json
{ "group": { "id_grupo":1, "nombre":"...", "miembros": [ { "id_usuario":10, "rol_en_grupo":"Dev", "usuario": { "id_usuario":10, "nombre":"Ana" } } ] } }
```

4) POST /api/groups/:id/members  (alias: /api/grupos/:id/members)
- Propósito: añadir miembros en bulk (transaccional).
- Permisos: `admin|supervisor`.
- Body (ejemplo):
```json
{
  "members": [
    { "user_id": 10, "position": "Frontend", "set_org_and_dept": true },
    { "user_id": 11, "position": "QA", "set_org_and_dept": false }
  ],
  "force": false
}
```
- Semántica:
  - `set_org_and_dept` por miembro: si true, backend actualizará `usuarios.id_org` y `usuarios.id_departamento` al valor del grupo o a los valores pasados en el miembro.
  - Si el usuario ya tiene org/dept diferente y `force` no está true => devuelve 409.
  - Operación atómica: si falla para un miembro, NO se aplica nada.
  - Límite: max 200 miembros por petición.
- Response 200:
```json
{ "added": [ { "user_id": 10, "position": "Frontend" } ] }
```

5) PATCH /api/groups/:groupId/members/:userId
- Propósito: actualizar metadata del miembro (position/is_leader y opcional set_org_and_dept).
- Body ejemplo: `{ "position":"Lead", "is_leader":true, "set_org_and_dept":true }`
- Response 200: `{ "member": { ... } }`

6) DELETE /api/groups/:groupId/members/:userId
- Propósito: remover miembro.
- Nota: por defecto NO borra `usuarios.id_org` ni `usuarios.id_departamento`.

Endpoints auxiliares
- GET /api/users?unassigned=true&limit=50&query=... -> usuarios con BOTH `id_org IS NULL` AND `id_departamento IS NULL`. (Requiere rol `supervisor|admin`.)
- GET /api/organizations?query=...&limit=50 -> lista organizaciones (devuelve `data.organizations`).
- GET /api/departments?organization_id=...&query=... -> lista departamentos (devuelve `data.departments`).

Formatos paginados
```json
{ "data": { "users": [ ... ], "meta": { "total": 12, "limit": 50, "offset": 0 } } }
```

Errores y códigos
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 409 Conflict
- 413 Payload Too Large

Ejemplos PowerShell
```powershell
# TOKEN retrieval
$body = @{ email = 'supervisor@soulspace.test'; password = 'supervisor123' } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $body -ContentType 'application/json'
$TOKEN = $resp.accessToken

# List unassigned
Invoke-RestMethod -Uri "http://localhost:3000/api/users?unassigned=true&limit=50" -Headers @{ Authorization = "Bearer $TOKEN" }

# Create group
$group = @{ name='hola'; description='test'; id_org=1; id_departamento=1 } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/api/groups' -Method POST -Body $group -Headers @{ Authorization = "Bearer $TOKEN" } -ContentType 'application/json'
```

Curl ejemplo añadir miembros:
```bash
curl -X POST http://localhost:3000/api/groups/42/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"members":[{"user_id":3,"position":"Dev","set_org_and_dept":true}]}'
```

Operaciones y recomendaciones
- Revisar que el frontend no añada doble `/api` al construir URLs.
- Usar los scripts de seed en `scripts/` para asegurarse datos: `create-supervisor.js`, `seed-unassigned.js`.
- Añadir tests que verifiquen atomicidad y conflictos.

Si quieres, genero también un OpenAPI fragment o una colección Postman.

Fin.
