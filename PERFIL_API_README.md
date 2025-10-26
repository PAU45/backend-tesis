# Endpoints de Perfil Avanzado de Usuario

## Obtener perfil completo
- `GET /api/usuario/perfil`
- Respuesta:
```json
{
  "id_usuario": 1,
  "nombre": "Paulo",
  "email": "paulo@soulspace.com",
  "identificacion": "12345678",
  "foto_perfil": "https://.../foto.png",
  "edad": 25,
  "zona_horaria": "UTC-3 (Argentina, Chile)",
  "idioma": "Español",
  "id_departamento": 2,
  "cargo": "Desarrollador",
  "telefono": "555-1234",
  "fecha_ingreso": "2025-01-10T00:00:00.000Z",
  "preferencias": {
    "frecuencia_recordatorios": "Semanal",
    "intereses_bienestar": "Meditación, Ejercicio",
    "actividades_favoritas": "Ejercicio, Caminar",
    "sobre_mi": "Me gusta el bienestar y la tecnología."
  }
}
```

## Actualizar perfil completo
- `PUT /api/usuario/perfil`
- Body:
```json
{
  "nombre": "Paulo",
  "identificacion": "12345678",
  "edad": 25,
  "zona_horaria": "UTC-3 (Argentina, Chile)",
  "idioma": "Español",
  "id_departamento": 2,
  "cargo": "Desarrollador",
  "telefono": "555-1234",
  "fecha_ingreso": "2025-01-10",
  "frecuencia_recordatorios": "Semanal",
  "intereses_bienestar": "Meditación, Ejercicio",
  "actividades_favoritas": "Ejercicio, Caminar",
  "sobre_mi": "Me gusta el bienestar y la tecnología."
}
```
- Respuesta: `{ ...perfil actualizado... }`

## Subir foto de perfil
- `POST /api/usuario/perfil/foto`
- Body:
```json
{
  "foto_perfil": "https://.../foto.png" // o base64
}
```
- Respuesta:
```json
{ "ok": true, "foto_perfil": "https://.../foto.png" }
```

---

## Notas
- Todos los endpoints requieren el header `Authorization: Bearer <accessToken>`.
- Las respuestas están listas para mapear en formularios y componentes del frontend.
- Los errores vienen en formato `{ error: 'mensaje' }` y los OK en `{ ok: true }`.
