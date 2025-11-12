## Auditoría y Logs — Diseño e integración

Este documento describe la propuesta completa de auditoría para el backend: modelo de datos (Prisma), helper de auditoría, middleware de trazado, puntos de instrumentación (endpoints), políticas operativas (retención, redacción), ejemplos de uso y comandos para aplicar la migración.

Propósito
- Registrar acciones críticas y las operaciones de usuarios privilegiados (admin, supervisor).
- Proveer trazabilidad (quién hizo qué, cuándo y desde dónde) para auditoría, investigación y cumplimiento.
- Permitir búsquedas y exportaciones desde un panel de admin.

Requisitos funcionales
- Auditar: creación/edición/eliminación de grupos, añadido/remoção/promoción de miembros, cambios de roles, operaciones de administración (roles/permits), y eventos de seguridad (login fallo, 401 repetidos).
- Mantener detalles contextuales en JSON (sin incluir passwords o tokens).
- Permitir filtrado por actor, acción, recurso, nivel y rango temporal.

Diseño de la tabla (Prisma)
Agrega el siguiente modelo a `prisma/schema.prisma`:

```prisma
model audit_logs {
  id             String   @id @default(uuid())
  actor_id       Int?
  actor_email    String?
  action         String
  resource_type  String?
  resource_id    String?
  level          String   @default("info")
  details        Json?
  ip             String?
  user_agent     String?
  outcome        String?
  created_at     DateTime @default(now())

  @@index([actor_id])
  @@index([resource_type, resource_id])
  @@index([created_at])
}
```

Notas:
- `details` almacena contexto (payload, antes/después) en JSON. No guardar contraseñas ni tokens.
- Índices permiten búsquedas eficientes por actor/recurso y rango temporal.

Migración
1. Añade el modelo anterior a `prisma/schema.prisma`.
2. Ejecuta (PowerShell):

```powershell
npx prisma migrate dev --name add_audit_logs
```

3. Reinicia el servidor para que Prisma Client se regenere.

Helper de auditoría (JS)
Crear `src/lib/audit.js` y exportar `audit()` y `logger`:

```javascript
// src/lib/audit.js
const { prisma } = require('../prisma');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function audit({ actorId, actorEmail, action, resourceType, resourceId, level='info', details = {}, ip, userAgent, outcome='success' }) {
  try {
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.token;
    delete safeDetails.refreshToken;

    logger.info({ actorId, actorEmail, action, resourceType, resourceId, outcome, ip }, 'audit');

    await prisma.audit_logs.create({
      data: {
        actor_id: actorId ?? null,
        actor_email: actorEmail ?? null,
        action,
        resource_type: resourceType ?? null,
        resource_id: resourceId ? String(resourceId) : null,
        level,
        details: safeDetails,
        ip: ip ?? null,
        user_agent: userAgent ?? null,
        outcome,
      }
    });
  } catch (err) {
    logger.error({ err, actorId, action }, 'audit_failed');
  }
}

module.exports = { audit, logger };
```

Middleware de trazado (request id)
Agregar un middleware opcional para generar `requestId` y exponer `req.auditMeta`:

```javascript
// src/web/secure/requestLogger.js
const { audit, logger } = require('../../lib/audit');
const { randomUUID } = require('crypto');

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  if (req.headers['x-real-ip']) return req.headers['x-real-ip'];
  if (req.headers['cf-connecting-ip']) return req.headers['cf-connecting-ip'];
  return req.ip || req.connection?.remoteAddress || null;
}

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  req.requestId = req.headers['x-request-id'] || randomUUID();
  const ip = resolveClientIp(req);
  logger.info({ reqId: req.requestId, method: req.method, url: req.originalUrl, ip }, 'incoming_request');
  req.auditMeta = { ip, userAgent: req.headers['user-agent'] };

  res.on('finish', () => {
    const durationMilliseconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const durationMs = Math.round(durationMilliseconds * 1000) / 1000;
    const outcome = res.statusCode >= 400 ? 'failure' : 'success';
    const logPayload = { reqId: req.requestId, method: req.method, url: req.originalUrl, status: res.statusCode, durationMs, ip: req.auditMeta?.ip };

    logger.info(logPayload, 'request_completed');

    const shouldStoreSuccess = process.env.AUDIT_HTTP_SUCCESS === 'true';
    if (outcome === 'failure' || shouldStoreSuccess) {
      audit({
        actorId: req.user?.sub,
        actorEmail: req.user?.email,
        action: 'http.request',
        resourceType: 'http',
        resourceId: req.requestId,
        level: outcome === 'failure' ? (res.statusCode >= 500 ? 'error' : 'warn') : 'info',
        details: logPayload,
        ip: req.auditMeta?.ip,
        userAgent: req.auditMeta?.userAgent,
        outcome,
      }).catch((err) => logger.error({ err: err.message, reqId: req.requestId }, 'http_request_audit_failed'));
    }
  });

  next();
}

module.exports = { requestLogger };
```

Dónde instrumentar (endpoints clave)
- `POST /api/groups` -> después de crear grupo: `action:'groups.create'`.
- `POST /api/groups/:id/members` -> al completar la transacción: `action:'groups.members.add'` con `details.added` y `details.attempted`.
- `PATCH /api/groups/:g/members/:u` -> `action:'groups.members.update'` con antes/después.
- `DELETE /api/groups/:g/members/:u` -> `action:'groups.members.remove'` con snapshot del miembro eliminado.
- `POST /api/auth/login` -> `action:'auth.login'` (outcome success/failure). Nunca almacenar passwords en details.
- El middleware guarda automáticamente los códigos de estado >= 400 como eventos `http.request`. Si necesitas también almacenar éxitos 2xx/3xx, define `AUDIT_HTTP_SUCCESS=true` en el `.env`.

Ejemplo de uso dentro de un handler (pseudocódigo):

```javascript
const { audit } = require('../../lib/audit');

// después de crear `newGroup`
await audit({ actorId: req.user.sub, actorEmail: req.user.email, action: 'groups.create', resourceType: 'group', resourceId: newGroup.id_grupo, details: { payload: req.body }, ip: req.auditMeta.ip, userAgent: req.auditMeta.userAgent});
```

Endpoint admin para consultar logs (sugerencia)
- `GET /api/admin/audit` (protegido con `requireRole(['admin'])`) con filtros: actor_id, action, resource_type, date_from, date_to, page, limit.
- Devuelve `data: { logs: [...], meta: { total, limit, offset } }`.

Políticas operativas
- Retención:
  - Mantener logs en BD 90 días (hot). Archivar mensualmente a S3 y purgar antes de 1 año.
- Redacción/PII:
  - No almacenar tokens/contraseñas. El helper `audit()` elimina keys sensibles por defecto.
  - Opcional: enmascarar emails en `actor_email` si la política lo requiere (almacenar solo dominio o hash).
- Acceso:
  - Sólo rol `admin` o rol `auditor` (crear rol separado) puede ver/descargar logs. Accesos al panel de auditoría deben registrarse también.

Alertas y monitorización
- Reglas básicas para alertas:
  - >5 eventos críticos por el mismo actor en 1h -> notificar equipo de seguridad.
  - Bulk deletes (más de N) -> alerta inmediata.
  - >10 fallos de login desde la misma IP en 10 min -> bloquear IP temporalmente.
- Cómo implementarlo:
  - Con pino envía eventos a Logstash/ELK o a un sistema de alertas (CloudWatch, Datadog).
  - También puedes crear un job cron que busque eventos críticos y envíe notificaciones por correo/Slack.

Consultas útiles (SQL/Prisma)
- Últimos 100 eventos de admin:
  - Prisma: `await prisma.audit_logs.findMany({ where:{ actor_email: 'admin@soulspace.test' }, orderBy:{ created_at: 'desc' }, take:100 })`
- Contar acciones por actor en la última hora:
  - Prisma: `await prisma.audit_logs.count({ where: { actor_id: x, created_at: { gte: new Date(Date.now()-3600*1000) } } })`

Testing
- Agregar tests con jest+supertest:
  - Ver que `audit()` crea un registro en DB al llamar endpoints críticos.
  - Ver que `GET /api/admin/audit` solo responde a admin.

Integración paso a paso (resumen rápido)
1. Añadir el modelo `audit_logs` en `prisma/schema.prisma`.
2. `npx prisma migrate dev --name add_audit_logs`.
3. Crear `src/lib/audit.js` y `src/web/secure/requestLogger.js`.
4. Añadir `requestLogger` globalmente en `src/server.js` (antes de las rutas) y proteger `GET /api/admin/audit` con `requireRole(['admin'])`.
  - Para obtener la IP real detrás de un proxy, ajusta `TRUST_PROXY_HOPS` (por defecto 1) y deja `app.set('trust proxy', TRUST_PROXY_HOPS)` configurado en `src/server.js`.
5. Instrumentar endpoints claves en `src/web/routes/grupos.js` y `src/web/routes/auth.js` para llamar a `audit()`.

Ejemplos PowerShell y curl
- Login y obtener token (PowerShell):
```powershell
$body = @{ email = 'admin@soulspace.test'; password = 'admin123' } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $body -ContentType 'application/json'
$TOKEN = $resp.accessToken
```

- Llamada a endpoint admin logs (PowerShell):
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/audit?limit=50" -Headers @{ Authorization = "Bearer $TOKEN" }
```

Siguientes pasos sugeridos (implementación incremental)
1. Fase mínima: añadir modelo + helper + instrumentar 4 endpoints claves + endpoint `GET /api/admin/audit`.
2. Fase media: alertas, exportación a S3, UI de auditoría básica.
3. Fase completa: pipeline ELK, particionado/archivado, tests completos y CI.

Si quieres, implemento ahora la Fase mínima (añadir modelo, crear helper y endpoints instrumentados), ejecuto la migración local y te muestro ejemplos reales con token admin. ¿Procedo con la Fase mínima? 

Fin.

## CRUD sugerido para todas las tablas
Abajo tienes un catálogo práctico con la convención de endpoints CRUD que recomiendo exponer en la API para cada modelo del esquema (nombres de ruta sugeridos, payload mínimo, permisos y nombre de acción de auditoría a usar). Ajusta rutas y permisos según tus convenciones locales. La idea es estandarizar para poder auditar cada operación con `audit()`.

- Convenciones:
  - Listar: GET /api/{resource}
  - Obtener: GET /api/{resource}/{id}
  - Crear: POST /api/{resource}
  - Actualizar: PATCH /api/{resource}/{id}
  - Borrar: DELETE /api/{resource}/{id}
  - Permisos: por defecto `admin` o `supervisor` para objetos organizacionales; `owner` o recurso específico para operaciones de usuario.

Nota: sustituye `{id}` por el nombre de PK en la ruta si quieres (`/api/organizaciones/:id_org`). En los ejemplos uso nombres genéricos.

---

1) organizaciones
 - GET /api/organizaciones
 - GET /api/organizaciones/:id_org
 - POST /api/organizaciones  (body: { nombre, sector, pais, tamano })
 - PATCH /api/organizaciones/:id_org  (body: campos a actualizar)
 - DELETE /api/organizaciones/:id_org
 - Permisos: admin|supervisor
 - Audit action: `organizaciones.create|update|delete|read`

2) departamentos
 - GET /api/departamentos?organization_id=...
 - GET /api/departamentos/:id_departamento
 - POST /api/departamentos  (body: { id_org, nombre, descripcion })
 - PATCH /api/departamentos/:id_departamento
 - DELETE /api/departamentos/:id_departamento
 - Permisos: admin|supervisor
 - Audit action: `departamentos.create|update|delete|read`

3) usuarios
 - GET /api/users (filtros: query, unassigned=true)
 - GET /api/users/:id_usuario
 - POST /api/users (registro) (body: { nombre, email, password, id_org?, id_departamento?, ... })
 - PATCH /api/users/:id_usuario (body: campos permitidos)
 - DELETE /api/users/:id_usuario
 - Permisos: crear = admin|self(register), actualizar = owner|admin, borrar = admin
 - Audit action: `users.create|update|delete|read|auth.login`

4) roles
 - GET /api/roles
 - GET /api/roles/:id_rol
 - POST /api/roles { nombre_rol, descripcion }
 - PATCH /api/roles/:id_rol
 - DELETE /api/roles/:id_rol
 - Permisos: admin
 - Audit action: `roles.create|update|delete`

5) usuarios_roles
 - GET /api/usuarios_roles?user_id=...
 - POST /api/usuarios_roles { id_usuario, id_rol }
 - DELETE /api/usuarios_roles/:id_usuario_rol
 - Permisos: admin
 - Audit action: `usuarios_roles.assign|revoke`

6) sesiones
 - GET /api/sesiones?user_id=...
 - POST /api/sesiones (registro de sesión)
 - PATCH /api/sesiones/:id_sesion (cerrar sesión)
 - DELETE /api/sesiones/:id_sesion
 - Permisos: owner|admin
 - Audit action: `sesiones.create|end|revoke`

7) permisos, roles_permisos
 - CRUD similar a roles; mapear permisos a roles via `roles_permisos`
 - Permisos: admin
 - Audit action: `permisos.create|assign|revoke|delete`

8) auditoria (tabla legacy en schema: `auditoria`)
 - GET /api/auditoria (admin) — para compatibilidad con antiguo modelo
 - No exponer creación manual; escribir vía helper `audit()` nuevo o `auditoria` seed

9) preguntas_diarias / respuestas_diarias
 - Preguntas: GET/POST/PATCH/DELETE (admin)
 - Respuestas: GET /api/respuestas?user_id=..., POST /api/respuestas (user), PATCH/DELETE por owner o admin
 - Audit actions: `preguntas.create|respuestas.create|respuestas.update`

10) evaluaciones, registros_emocionales, progreso_bienestar, recomendaciones
 - Endpoints CRUD standard (create by user, admin read all)
 - Audit actions: `evaluaciones.create|registros.create|progreso.update|recomendaciones.create`

11) recursos_biblioteca
 - CRUD para contenidos: POST (admin), GET (public/admin), PATCH, DELETE
 - Audit action: `recursos.create|update|delete`

12) notificaciones
 - GET /api/notificaciones?user_id=..., POST (create notification by system/admin), PATCH (mark read), DELETE
 - Audit action: `notificaciones.create|send`

13) tareas, tareas_log, metas_bienestar
 - Tareas: CRUD por owner; admin puede gestionar todas
 - tareas_log: crear entries automáticamente al cambiar estado
 - Audit: `tareas.create|tareas.update|tareas.delete`

14) conversaciones_ia y mensajes_ia
 - GET convs, POST conv, GET mensajes, POST mensaje
 - Permisos: owner/admin
 - Audit action: `conversacion.create|mensaje.create` (no guardar contenido sensible en audit.details si proviene de usuario)

15) Kanban (board, column, task, task_asignado, sprint)
 - Boards: CRUD por grupo (requireGroupRole)
 - Columns: CRUD por board
 - Tasks: CRUD por board/column; asignar via task_asignado
 - Sprint: CRUD por board
 - Permisos: requireGroupRole (miembro/líder) y admin override
 - Audit actions: `board.create|task.create|task.assign|sprint.create|column.update`

16) sesiones_terapia
 - CRUD similar a sesiones, con acceso restringido a paciente/profesional y admin
 - Audit: `sesion_terapia.create|update|delete`

17) grupos_trabajo, grupos_miembros
 - Grupos: CRUD (POST /api/groups, GET /api/groups, GET /api/groups/:id, PATCH, DELETE)
 - Miembros: POST /api/groups/:id/members (bulk), PATCH /members/:userId, DELETE /members/:userId
 - Permisos: create/add = requireRole(['admin','supervisor']); detail = requireGroupRole('miembro') (admin/supervisor can view per audit policy)
 - Audit actions: `groups.create|groups.update|groups.delete|groups.members.add|groups.members.remove|groups.members.update`

18) llamadas, productividad_empleado, reportes_productividad, empleados_destacados
 - CRUD / reports endpoints (admin / supervisor)
 - Audit actions: `call.log|productivity.report|report.download`

19) preferencias_usuario, configuracion_notificaciones, privacidad_datos
 - GET/POST/PATCH (owner), admin read
 - Audit actions: `preferences.update|config.update|privacy.update`

20) indicadores_organizacion, descargas_reportes
 - GET/POST by admin/system; download events create descargas_reportes
 - Audit actions: `indicador.create|descarga.report`

21) audit_logs (nuevo modelo propuesto)
 - GET /api/admin/audit (admin only) -> paginated & filterable
 - No POST/DELETE por API pública; escribir exclusivamente vía helper `audit()`

---

Cómo integrar con `audit()`
- Para cada endpoint CRUD invoca `audit()` con:
  - action: `model.operation` (ej: `users.create`)
  - resourceType: model name
  - resourceId: id (si aplica)
  - details: { payload, before, after } (elimina keys sensibles)
  - actorId/actorEmail: desde `req.user`
  - ip/userAgent: desde `req.auditMeta`

Ejemplo rápido — crear organización:
```javascript
// after create
await audit({ actorId: req.user.sub, actorEmail: req.user.email, action: 'organizaciones.create', resourceType: 'organizaciones', resourceId: org.id_org, details: { payload: req.body }, ip: req.auditMeta.ip, userAgent: req.auditMeta.userAgent });
```

---

Si quieres que genere automáticamente los archivos de rutas CRUD (boilerplate) para cada modelo con express + prisma y con llamadas a `audit()` incluidas, puedo generarlos ahora en `src/web/routes/` y añadir tests básicos. ¿Lo genero automáticamente? Indica primero si quieres rutas públicas con los nombres propuestos o prefieres otra convención de rutas.

