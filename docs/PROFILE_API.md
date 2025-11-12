# Especificación API - Perfil de Usuario

Documento para el equipo frontend/backend con todo lo necesario para integrar el formulario de perfil de forma consistente.

## Resumen rápido (qué pedimos al backend)
- Contrato de endpoints: GET/PUT `/api/usuario/perfil` y POST `/api/usuario/perfil/foto` (métodos, headers, body, response).
- Forma exacta de autenticación: ¿Bearer JWT en Authorization o cookies de sesión? ¿refresh token flow?
- Política CORS / preflight: orígenes permitidos, métodos, headers, allow-credentials.
- Formato de errores (shape JSON) y códigos usados.
- Reglas de subida de archivos: field name, max 2 MB, mime types permitidos, respuesta.
- Ejemplos concretos (request y response) y token/usuario de pruebas en staging.

---

## Endpoints mínimos

1) GET /api/usuario/perfil
- Método: GET
- Headers: `Authorization: Bearer <token>` (o cookies si se usan sesiones)
- Response (200) ejemplo:

```json
{
  "id_usuario": 6,
  "nombre": "paulin",
  "identificacion": "1312321",
  "email": "paulin4@local.test",
  "foto_perfil": "http://localhost:3000/uploads/avatars/1762775693360-933.jpg",
  "id_departamento": 10,
  "cargo": "Coordinador",
  "telefono": "+51987654321",
  "fecha_nacimiento": "1990-10-26T00:00:00.000Z",
  "preferencias": {
    "id_preferencia": 12,
    "id_usuario": 6,
    "idioma": "es",
    "pais": "Peru",
    "zona_horaria": "America/Lima",
    "tema": "dark",
    "color_principal": "#0ea5a4",
    "frecuencia_recordatorios": "weekly",
    "intereses_bienestar": "music, exercise",
    "actividades_favoritas": "meditation, exercise",
    "sobre_mi": "Me gusta meditar y hacer ejercicio."
  }
}
```

2) PUT /api/usuario/perfil
- Método: PUT
- Headers: `Authorization: Bearer <token>` + `Content-Type: application/json`
- Body: JSON con los campos a actualizar. El backend acepta partial updates (se actualizan los campos provistos). Recomendamos enviar solo los campos cambiados o el objeto completo.
- Campos recomendados (nombres exactos que recomendamos usar):
  - `nombre` (string)
  - `identificacion` (string)
  - `email` (string, opcional)
  - `fecha_nacimiento` (string ISO YYYY-MM-DD)
  - `id_departamento` (int)
  - `cargo` (string)
  - `telefono` (string)
  - `frecuencia_recordatorios` (string): 'daily'|'weekly'|'monthly'|'never'
  - `intereses_bienestar` (string)
  - `actividades_favoritas` (array[string] o string) — recomendamos array[string]
  - `sobre_mi` (string)
  - `zona_horaria` (string, ej. 'America/Lima')
  - `idioma` (string, 'es'|'en')
  - `pais` (string)
  - `tema`, `color_principal` (string)

Ejemplo request:

```json
{
  "nombre": "paulin",
  "identificacion": "1312321",
  "fecha_nacimiento": "1990-10-26",
  "frecuencia_recordatorios": "weekly",
  "intereses_bienestar": "music, exercise",
  "actividades_favoritas": ["meditation","exercise"],
  "sobre_mi": "Un poco sobre mí...",
  "zona_horaria": "America/Lima",
  "idioma": "es"
}
```

Ejemplo response (200): devuelve el usuario actualizado (preferible la misma forma que GET)

3) POST /api/usuario/perfil/foto
- Soporta tres modos:
  1) multipart/form-data con campo `photo` (archivo). *NO* establecer `Content-Type` manualmente desde frontend; dejar que el navegador lo haga con el boundary.
  2) JSON `{ "url": "https://..." }` — guardar URL externa.
  3) JSON `{ "foto_perfil": "data:image/png;base64,..." }` — base64.
- Headers para multipart: `Authorization: Bearer <token>` (no Content-Type manual)
- Constraints:
  - Campo: `photo` (confirmar)
  - Máximo: 2 MB (confirmar)
  - Tipos permitidos: `image/*` (confirmar exactos: `image/jpeg`, `image/png`, `image/webp`?, etc.)
- Respuesta success (200): ejemplo

```json
{ "ok": true, "foto_perfil": "http://host/uploads/avatars/12345.jpg" }
```

---

## Autenticación
- Confirmar si usan `Authorization: Bearer <token>` (JWT) o sesiones por cookie.
- Si usan cookies: indicar el nombre exacto de la cookie y si el frontend debe usar `credentials: 'include'`.
- Si usan JWT: confirmar header exacto y si hay refresh flow (`POST /auth/refresh`). Proveer un token de prueba en staging.

## CORS y preflight
- Indicar orígenes permitidos (dev/staging/prod). Recomendar permitir `http://localhost:5173` en dev.
- Confirmar que el servidor responde a OPTIONS con:
  - `Access-Control-Allow-Origin: <origin>` o `*`
  - `Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS, DELETE`
  - `Access-Control-Allow-Headers: Authorization, Content-Type, Accept`
  - `Access-Control-Allow-Credentials: true|false` (si usan cookies debe ser true)

## Formato de errores
- Indicar la forma estándar de error JSON (ej. `{ "error": "mensaje" }` o `{ "success": false, "message": "", "errors": [] }`).
- Ejemplos recomendados:
  - 400 Bad Request: `{ "error": "Invalid request body" }`
  - 401 Unauthorized: `{ "error": "Unauthorized" }`
  - 403 Forbidden: `{ "error": "Forbidden" }`
  - 413 Payload Too Large (photo > 2MB): `{ "error": "File too large" }`
  - 500 Internal: `{ "error": "Internal server error" }`

## Naming & Transformaciones
- Preferencia: frontend envía nombres en español como arriba (nombre, fecha_nacimiento, sobre_mi, actividades_favoritas). Si el frontend usa nombres en inglés, que tenga una función `buildPerfilPayload` que haga el mapeo.
- `actividades_favoritas` puede ser array[string] o string; backend actual guarda como `String` (coma separada). Recomendamos aceptar array en el request y que backend haga `join(', ')`.

## Ejemplos prácticos

- CURL PUT:

```bash
curl -X PUT 'http://localhost:3000/api/usuario/perfil' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"paulin","fecha_nacimiento":"1990-10-26","actividades_favoritas":["meditation","exercise"]}'
```

- Fetch PUT (browser):

```js
fetch('http://localhost:3000/api/usuario/perfil', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <TOKEN>' },
  body: JSON.stringify({ nombre: 'paulin', fecha_nacimiento: '1990-10-26', actividades_favoritas: ['meditation','exercise'] }),
  credentials: 'include' // solo si backend usa cookies
}).then(r => r.json()).then(console.log).catch(console.error);
```

- Fetch multipart upload (browser):

```js
const fd = new FormData();
fd.append('photo', fileInput.files[0]);
fetch('http://localhost:3000/api/usuario/perfil/foto', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <TOKEN>' }, // NO Content-Type
  body: fd,
  credentials: 'include'
}).then(r => r.json()).then(console.log).catch(console.error);
```

## Checklist QA (lo que debe probar backend y frontend)
- GET /usuario/perfil devuelve datos correctos y `preferencias`.
- PUT /usuario/perfil con cambios devuelve 200 y los cambios se reflejan en GET.
- POST foto con multipart <2MB devuelve URL y la UI la muestra.
- POST foto >2MB devuelve 413/400 con mensaje claro.
- OPTIONS preflight responde con `Access-Control-Allow-*` correctos para el origen dev.
- Petición sin Authorization devuelve 401.

## Plantilla de mensaje para el equipo backend (copiar/pegar)

Hola equipo backend — necesito confirmar varios detalles para integrar el formulario de perfil del frontend correctamente. Por favor confirmen o devuelvan ejemplos concretos para los siguientes puntos:

1) Endpoints y ejemplos

GET /api/usuario/perfil
- Método: GET
- Ejemplo response (JSON) completo (incluyendo `preferencias`)

PUT /api/usuario/perfil
- Método: PUT
- Esquema de request: ¿qué campos esperan y cuáles son obligatorios? (ej.: `nombre`, `identificacion`, `email`, `fecha_nacimiento` YYYY-MM-DD, `id_departamento`, `cargo`, `telefono`, `frecuencia_recordatorios`, `intereses_bienestar`, `actividades_favoritas` (array o string), `sobre_mi`, `zona_horaria`, `idioma`, `pais`, `tema`, `color_principal`).
- ¿PUT es parcial (puedo enviar solo los campos que cambian) o debe enviarse todo el recurso?
- Ejemplo request JSON y ejemplo response JSON.

POST /api/usuario/perfil/foto
- Métodos soportados y ejemplos para multipart/form-data (`photo`), JSON `{ url }` y JSON `{ foto_perfil: 'data:...' }`.
- ¿Cuál es la respuesta exitosa (ej. devuelve `foto_perfil` URL)?
- Constraints: limite tamaño (confirmar 2 MB), mimetypes permitidos (confirmar `image/jpeg`, `image/png`, ...).

2) Autenticación y sesiones
- ¿Usan `Authorization: Bearer <token>` (JWT) o cookies de sesión? Si usan cookies, indicar el nombre exacto y confirmar `credentials: 'include'`.
- ¿Hay endpoint de refresh (ej. `/auth/refresh`)? Formato y ejemplo.
- Proveer token/usuario de prueba en staging.

3) CORS y preflight
- ¿Qué orígenes permitirán (dev/staging/prod)? Por favor confirmar que `http://localhost:5173` está permitido en dev.
- Confirmar headers/methods permitidos y `Access-Control-Allow-Credentials`.

4) Errores y formatos
- Indicar forma estándar de error JSON y ejemplos para 400/401/403/413/500.

5) Otros
- ¿El backend acepta `actividades_favoritas` como array? ¿Lo guardan como string? Recomendamos aceptar array.
- Fecha: confirmar formato (ISO YYYY-MM-DD) y zona (se convierte a UTC?).
- Límites de longitud para `sobre_mi` y `nombre` si existen.
- Envíen si tienen Swagger/OpenAPI o Postman collection.

Gracias — con esta información actualizamos el frontend y entregamos tests para integración.

---

Si quieres, puedo:
- Crear `docs/PROFILE_API.md` en el repo (hecho).
- Generar un snippet TypeScript `buildPerfilPayload` y `saveProfile` para el frontend.
- Buscar en el repo frontend las llamadas actuales y proponer correcciones.

Fin del documento.
