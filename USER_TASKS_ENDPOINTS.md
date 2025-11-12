
# Guía rápida para Frontend: Endpoints, headers y ejemplos

## ¿Qué endpoints usar?

- Perfil: `GET /api/usuario` (y `PUT /api/usuario` para actualizar)
- Notificaciones: `GET/PUT /api/usuario/notificaciones`
- Apariencia: `GET/PUT /api/usuario/apariencia`
- Privacidad: `GET/PUT /api/usuario/privacidad`
- Metas: `GET/PUT /api/usuario/metas`
- Tareas (Kanban):
  - `GET /api/tasks` (alias: `/api/kanban/tasks`)
    - Query: `assignedTo` (nombre/email), `assignedId`, `id_board`, `id_column`, `id_grupo`, `estado`, `prioridad`, `etiqueta`, `id_sprint`, `page`, `limit`
    - Ejemplo: `/api/kanban/tasks?assignedTo=paulin4&page=1&limit=50`
    - Respuesta: `{ data: { tasks: [...], meta: { total, page, limit, hasMore }, stats: { total, completed, pending, percentCompleted } } }`
  - `POST /api/tasks` (crear), `PUT /api/tasks/:taskId` (editar), `DELETE /api/tasks/:taskId` (eliminar), `PATCH /api/tasks/:taskId/move` (mover columna)

## Headers obligatorios y recomendados

- `Authorization: Bearer <accessToken>` (siempre, salvo login/register)
- `x-request-id: <uuid>` (recomendado en operaciones críticas para correlación en logs/auditoría)

## Ejemplo de fetch (JS)

```js
fetch('/api/kanban/tasks?assignedTo=paulin4&page=1&limit=50', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'x-request-id': 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  }
}).then(r => r.json()).then(console.log);
```

## Ejemplo de PowerShell

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/kanban/tasks?assignedTo=paulin4' -Headers @{ Authorization = "Bearer $TOKEN"; 'x-request-id' = 'xxxx-uuid' }
```

## ¿Qué hacer ante errores?

- 404: revisa que la ruta existe y está bien escrita (`/api/tasks` o `/api/kanban/tasks`)
- 500 con `"next is not defined"`: bug en backend, handler debe declarar el parámetro `next`. Reportar con requestId, hora y URL usada.

## Auditoría y correlación

- El backend registra eventos críticos (crear/editar/borrar tareas, etc.) y errores HTTP >=400 en la tabla `audit_logs`.
- El header `x-request-id` permite buscar la acción exacta en `/api/admin/audit` (requiere rol admin/auditor).
- Para ver logs: `GET /api/admin/audit?limit=50&page=1&actor_email=...`

---

# Endpoints de Usuario y Tareas — Referencia para Frontend

Este documento reúne todos los endpoints relacionados con la configuración y las tareas del usuario en la API, ejemplos de uso, cabeceras requeridas, formatos de respuesta y notas sobre auditoría.

Nota rápida: la API monta rutas bajo `/api`. Todas las rutas descritas abajo deben invocarse prefijando `/api` (por ejemplo `GET /api/usuario`).

## Autenticación y cabeceras comunes
- Todas las rutas de usuario requieren header: `Authorization: Bearer <accessToken>` (salvo registro/login).
- Opcional: `x-request-id: <uuid>` para correlación; si no se envía, el backend genera uno.
- Para obtener la IP real detrás de proxies, el backend respeta `x-forwarded-for` y `x-real-ip` si `TRUST_PROXY_HOPS` está configurado.

## Formato de respuestas de errores
- Errores: `{ "error": "mensaje" }` o `{ "error": "mensaje", "code": 400 }` según contexto.
- Rutas exitosas usualmente devuelven `{ ok: true }` o el recurso creado/recuperado.

---

## Perfil de Usuario

### Obtener perfil
- Método: GET
- Ruta: /api/usuario
- Permisos: token válido (owner)
- Respuesta (ejemplo):
```
{
  "user": { "id": 1, "nombre": "Paulo Silva", "email": "paulo@soulspace.com" },
  "roles": ["usuario"]
}
```
- Audit: la lectura no genera por defecto un evento `audit()` (solo acciones administrativas). Si necesitas trazabilidad, backend puede registrar `audit()` en lecturas sensibles.

### Actualizar perfil
- Método: PUT
- Ruta: /api/usuario
- Body: (JSON con campos actualizables)
```
{
  "nombre": "Paulo Silva",
  "edad": 25,
  "zona_horaria": "UTC-3",
  "idioma": "es"
}
```
- Respuesta: objeto del perfil actualizado.
- Audit: backend debería llamar `audit()` con `action: 'users.update'`, `resourceType: 'usuarios'`, `resourceId: id_usuario`, `details: { payload, before, after }`.

---

## Notificaciones

### Obtener configuración de notificaciones
- Método: GET
- Ruta: /api/usuario/notificaciones
- Respuesta (ejemplo):
```
{
  "recordatorio_meditacion": false,
  "recordatorio_tareas": false,
  "preguntas_diarias": false,
  "resumen_semanal": false,
  "hora_inicio": "08:00",
  "hora_fin": "21:00"
}
```
- Audit: lectura opcional. Cambios deben producir `audit()` con `action: 'preferences.update'` o `notificaciones.update` según convención.

### Actualizar configuración de notificaciones
- Método: PUT
- Ruta: /api/usuario/notificaciones
- Body: objeto con flags y horarios (ver ejemplo arriba)
- Respuesta: configuración actualizada
- Audit: `action: 'notificaciones.update'`, `resourceType: 'configuracion_notificaciones'`

---

## Preferencias de Apariencia

### Obtener preferencias de apariencia
- Método: GET
- Ruta: /api/usuario/apariencia
- Respuesta:
```
{ "tema": "oscuro", "color_acento": "#009688", "tamano_fuente": "normal" }
```

### Actualizar preferencias de apariencia
- Método: PUT
- Ruta: /api/usuario/apariencia
- Body: idem
- Audit: `action: 'preferences.update'` o `action: 'apariencia.update'` según convención

---

## Privacidad y Datos

### Obtener configuración de privacidad
- Método: GET
- Ruta: /api/usuario/privacidad
- Respuesta (ejemplo):
```
{ "compartir_datos_anonimos": false, "backup_automatico": false, "modo_offline": false }
```

### Actualizar configuración de privacidad
- Método: PUT
- Ruta: /api/usuario/privacidad
- Body: campos booleanos de configuración
- Audit: `action: 'privacy.update'` o `privacy.update` (resourceType: `privacidad_datos`)

---

## Metas de Bienestar

### Obtener metas de bienestar
- Método: GET
- Ruta: /api/usuario/metas
- Respuesta (ejemplo):
```
{ "minutos_meditacion_diarios": 5, "tareas_completadas_dia": 1, "ejercicio_semanal_dias": 1, "horas_sueno_noche": 6 }
```

### Actualizar metas de bienestar
- Método: PUT
- Ruta: /api/usuario/metas
- Body: campos numéricos
- Audit: `action: 'metas.update'` o `metas.update`

---

## Acciones relacionadas con Tareas (Kanban / Tasks)

> Nota: las rutas de Kanban, boards, columnas y tareas están bajo `/api/boards`, `/api/columns` y `/api/tasks`. Las operaciones sobre tareas importantes deben registrar `audit()` con `action: 'task.create'|'task.update'|'task.delete'`.

- Crear tarea: POST /api/tasks  (body: { titulo, descripcion, id_board, id_column, asignados: [...] })
- Actualizar tarea: PATCH /api/tasks/:taskId
- Marcar completada: PATCH /api/tasks/:taskId (body: { estado: 'done' })
- Asignar: POST /api/tasks/:taskId/assign (o PATCH con campo asignados)

Audit: cada cambio crítico debe llamar `audit()` con detalles antes/después.

---

## Grupos y miembros (resumen)

Rutas en `src/web/routes/grupos.js` (montadas como `/api/groups` y `/api/grupos`):

- Listar grupos: GET /api/groups?mine=true|false
- Obtener grupo: GET /api/groups/:grupoId (requiere ser miembro o role apropiado)
- Crear grupo: POST /api/groups  (roles: admin|supervisor)  -> `action: 'groups.create'`
- Añadir miembros (bulk): POST /api/groups/:grupoId/members (roles: admin|supervisor) -> `action: 'groups.members.add'` (detalles: requested, added)
- Actualizar miembro: PATCH /api/groups/:grupoId/members/:userId -> `groups.members.update` (before/after)
- Eliminar miembro: DELETE /api/groups/:grupoId/members/:userId -> `groups.members.remove` (snapshot)

---

## Auditoría desde Frontend

### Endpoint admin para ver logs
- Método: GET
- Ruta: /api/admin/audit
- Permisos: token válido con `roles` que incluya `admin` o `auditor`.
- Filtros disponibles (query string):
  - `actor_id` (int)
  - `actor_email` (string)
  - `action` (string, partial match)
  - `resource_type` (string, partial match)
  - `level` (info|warn|error)
  - `outcome` (success|failure)
  - `date_from` (ISO date)
  - `date_to` (ISO date)
  - `page` (int), `limit` (int, max 200)

- Respuesta (ejemplo):
```
{
  "data": {
    "logs": [ { "id": "uuid", "actor_id": 1, "action": "auth.login", "details": { ... }, "created_at": "..." } ],
    "meta": { "total": 123, "page": 1, "limit": 50, "hasMore": true }
  }
}
```

### Buenas prácticas para frontend
- En solicitudes críticas (crear/editar/borrar) incluye `x-request-id` para correlación con los logs si quieres trazar una acción desde UI hasta DB/log.
- Maneja 401 devolviendo al login; maneja 403 mostrando mensaje de permiso insuficiente y un enlace al equipo de soporte.
- Si el frontend implementa un panel de auditoría, debe filtrar por `action`, `actor_email` y rango de fechas para evitar páginas largas.

---

## HTTP-level auditing (recolección automática de requests)

- El backend registra con pino todos los requests entrantes y, por defecto, persiste eventos HTTP con status >= 400 como `http.request` en `audit_logs`.
- Si quieres que también se almacenen éxitos 2xx/3xx, pedir al equipo de ops que añada `AUDIT_HTTP_SUCCESS=true` al `.env` del entorno.
- Cada registro contiene: `requestId` (resourceId), `method`, `url`, `status`, `durationMs`, `ip`.

---

## Ejemplos rápidos (PowerShell)

- Login y obtener token:
```powershell
$body = @{ email = 'admin@soulspace.test'; password = 'admin123' } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $body -ContentType 'application/json'
$TOKEN = $resp.accessToken
```

- Obtener perfil (con token):
```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/usuario' -Headers @{ Authorization = "Bearer $TOKEN" }
```

- Llamada al admin audit (con token admin):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/audit?limit=50" -Headers @{ Authorization = "Bearer $TOKEN" }
```

---

## Mapeo de acciones a `audit()`
- users.create / users.update / users.delete
- auth.login (outcome success/failure)
- groups.create / groups.members.add / groups.members.update / groups.members.remove
- preferences.update / notificaciones.update / privacidad.update / metas.update
- task.create / task.update / task.delete
- http.request (automático para 4xx/5xx; 2xx optional)

---

## Notas finales
- No registrar contraseñas ni tokens en `details` (el helper `audit()` elimina `password`, `token`, `refreshToken` por defecto).
- Si necesitáis formatos distintos para UI (por ejemplo convertir `created_at` a zona horaria del usuario), hacedlo en frontend al renderizar.
- Si queréis, genero una colección Postman / OpenAPI parcial con estas rutas para que el equipo frontend la importe.
