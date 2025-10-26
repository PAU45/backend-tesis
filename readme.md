# SoulSpace Backend (Express + Prisma)

Backend profesional en JavaScript con Express, Prisma (SQLite en desarrollo), JWT para autenticación, middlewares de seguridad, seeders y CRUD genérico para todas las tablas del dominio.

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm (incluido con Node)

## Estructura del proyecto

- `src/server.js`: Servidor Express y middlewares.
- `src/web/router.js`: Router raíz de la API.
- `src/web/routes/auth.js`: Endpoints de autenticación (JWT + sesiones).
- `src/web/routes/crud.js`: CRUD genérico protegido para todas las tablas.
- `src/web/secure/requireAuth.js`: Middleware de autenticación (Bearer JWT).
- `src/prisma.js`: Cliente de Prisma.
- `prisma/schema.prisma`: Esquema de base de datos.
- `prisma/seed.js`: Seeder con datos base (roles, permisos, org, user admin, etc.).
- `.env` / `.env.example`: Variables de entorno.

Base de datos por defecto: SQLite (archivo `dev.db` en la raíz). Puedes migrar fácilmente a Postgres/MySQL cambiando `datasource` en `prisma/schema.prisma` y `DATABASE_URL` en `.env`.

## Configuración inicial (Windows PowerShell)

1) Clonar/copiar el proyecto (si aplica) y entrar a la carpeta:

```powershell
cd C:\backend
```

2) Instalar dependencias:

```powershell
npm install
```

3) Copiar el ejemplo de variables y ajustar secretos:

```powershell
Copy-Item .env.example .env -Force
```

Edita `.env` y cambia:
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- (Opcional) `PORT`

4) Crear/actualizar la base de datos desde Prisma:

```powershell
npm run db:push
```

5) Cargar datos de ejemplo (roles, permisos, org, admin, recursos):

```powershell
npm run db:seed
```

6) Levantar la API:

```powershell
npm start
```

La API quedará disponible en `http://localhost:3000` y la documentación Swagger mínima en `http://localhost:3000/docs`.

Endpoint de salud:
- `GET /health` → `{ ok: true }`

## Autenticación (JWT)

Flujo básico:
1. Registro o login → obtienes `accessToken` (15m) y `refreshToken` (7d).
2. Usa `Authorization: Bearer <accessToken>` en endpoints protegidos.
3. Cuando expire, usa `/api/auth/refresh` con el `refreshToken`.

Headers comunes:
- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>` (en rutas protegidas)

### Endpoints de Auth

- POST `/api/auth/register`
  - Body:
    ```json
    { "nombre": "Admin", "email": "admin@soulspace.test", "password": "admin123" }
    ```
  - Respuesta: `{ user, accessToken, refreshToken }`

- POST `/api/auth/login`
  - Body:
    ```json
    { "email": "admin@soulspace.test", "password": "admin123" }
    ```
  - Respuesta: `{ user, accessToken, refreshToken }`

- POST `/api/auth/refresh`
  - Body:
    ```json
    { "refreshToken": "<token>" }
    ```
  - Respuesta: `{ accessToken, refreshToken }`

- POST `/api/auth/logout`
  - Body:
    ```json
    { "refreshToken": "<token>" }
    ```
  - Respuesta: `{ ok: true }`

Nota: las sesiones de refresh se guardan en la tabla `sesiones`.

## CRUD genérico por recurso (protegido)

Ruta base: `/api/crud/:resource` (requiere `Authorization: Bearer <accessToken>`)

Operaciones:
- `GET /api/crud/:resource` → lista (máx 100)
- `GET /api/crud/:resource/:id` → detalle por ID
- `POST /api/crud/:resource` → crear (Body JSON)
- `PUT /api/crud/:resource/:id` → actualizar
- `DELETE /api/crud/:resource/:id` → eliminar

Recursos disponibles (mapean 1:1 a modelos Prisma):

- organizaciones
- departamentos
- usuarios
- roles
- usuarios_roles
- sesiones
- permisos
- roles_permisos
- auditoria
- preguntas_diarias
- respuestas_diarias
- evaluaciones
- registros_emocionales
- progreso_bienestar
- recomendaciones
- recursos_biblioteca
- notificaciones
- tareas
- metas_bienestar
- tareas_log
- conversaciones_ia
- mensajes_ia
- sesiones_terapia
- grupos_trabajo
- grupos_miembros
- llamadas
- productividad_empleado
- reportes_productividad
- empleados_destacados
- preferencias_usuario
- configuracion_notificaciones
- privacidad_datos
- indicadores_organizacion
- descargas_reportes

Ejemplos (PowerShell con Invoke-RestMethod):

- Login y guardar tokens:
```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" -ContentType 'application/json' -Body '{"email":"admin@soulspace.test","password":"admin123"}'
$access = $login.accessToken
$refresh = $login.refreshToken
```

- Crear organización:
```powershell
Invoke-RestMethod -Method Post \
  -Uri "http://localhost:3000/api/crud/organizaciones" \
  -Headers @{ Authorization = "Bearer $access" } \
  -ContentType 'application/json' \
  -Body '{"nombre":"Nueva Org","sector":"Salud"}'
```

- Listar organizaciones:
```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/crud/organizaciones" -Headers @{ Authorization = "Bearer $access" }
```

## Seguridad incluida

- `helmet`, `cors`
- `express-rate-limit` (200 req/15 min por IP)
- Logging (`morgan` + `pino-http`)
- JWT Access/Refresh, sesiones persistidas

Recomendado para producción:
- Usar Postgres o MySQL con usuario/contraseña gestionados y SSL.
- Rotación de secretos JWT vía variables de entorno seguras.
- Añadir validaciones con `zod` en los payloads de CRUD.
- Implementar RBAC: la BD ya tiene `roles`, `permisos`, `roles_permisos`, `usuarios_roles`. Puedes extender `requireAuth` para verificar permisos por recurso/acción antes de ejecutar el CRUD.

## Prisma

- Generar cliente:
```powershell
npm run db:generate
```

- Sincronizar esquema con BD (desarrollo):
```powershell
npm run db:push
```

- Ejecutar seeders:
```powershell
npm run db:seed
```

El esquema Prisma se generó desde el DBML provisto y cubre todas las tablas indicadas.

## Scripts npm

- `npm start` → arranca la API (`src/server.js`)
- `npm run dev` → arranca con hot-reload (nodemon)
- `npm run db:generate` → `prisma generate`
- `npm run db:push` → `prisma db push`
- `npm run db:seed` → ejecuta `prisma/seed.js`

## Troubleshooting

- Puerto en uso: cambia `PORT` en `.env`.
- Error JWT: asegúrate de configurar `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`.
- Error Prisma/SQLite bloqueado: cierra procesos que estén usando `dev.db` y reintenta.

## Próximos pasos sugeridos

- Añadir validación de entrada (zod) y sanitización en el CRUD.
- Añadir control de permisos por rol (RBAC) a nivel de `resource + acción`.
- Tests de integración (Jest/Supertest).
- Dockerfile y compose para BD externa.
