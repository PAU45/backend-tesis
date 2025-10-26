# Endpoints de Configuración de Usuario

## Perfil de Usuario

### Obtener perfil
- `GET /api/usuario`
- Respuesta:
```json
{
  "id": 1,
  "nombre": "Paulo Silva",
  "email": "paulo@soulspace.com",
  "edad": 25,
  "zona_horaria": "UTC-3 (Argentina, Chile)",
  "idioma": "Español",
  "roles": ["usuario"]
}
```

### Actualizar perfil
- `PUT /api/usuario`
- Body:
```json
{
  "nombre": "Paulo Silva",
  "edad": 25,
  "zona_horaria": "UTC-3 (Argentina, Chile)",
  "idioma": "Español"
}
```
- Respuesta: `{ ...perfil actualizado... }`

---

## Notificaciones

### Obtener configuración de notificaciones
- `GET /api/usuario/notificaciones`
- Respuesta:
```json
{
  "recordatorio_meditacion": false,
  "recordatorio_tareas": false,
  "preguntas_diarias": false,
  "resumen_semanal": false,
  "hora_inicio": "08:00",
  "hora_fin": "21:00"
}
```

### Actualizar configuración de notificaciones
- `PUT /api/usuario/notificaciones`
- Body:
```json
{
  "recordatorio_meditacion": true,
  "recordatorio_tareas": true,
  "preguntas_diarias": false,
  "resumen_semanal": true,
  "hora_inicio": "08:00",
  "hora_fin": "21:00"
}
```
- Respuesta: `{ ...configuración actualizada... }`

---

## Preferencias de Apariencia

### Obtener preferencias de apariencia
- `GET /api/usuario/apariencia`
- Respuesta:
```json
{
  "tema": "oscuro",
  "color_acento": "#009688",
  "tamano_fuente": "normal"
}
```

### Actualizar preferencias de apariencia
- `PUT /api/usuario/apariencia`
- Body:
```json
{
  "tema": "oscuro",
  "color_acento": "#009688",
  "tamano_fuente": "normal"
}
```
- Respuesta: `{ ...preferencias actualizadas... }`

---

## Privacidad y Datos

### Obtener configuración de privacidad
- `GET /api/usuario/privacidad`
- Respuesta:
```json
{
  "compartir_datos_anonimos": false,
  "backup_automatico": false,
  "modo_offline": false
}
```

### Actualizar configuración de privacidad
- `PUT /api/usuario/privacidad`
- Body:
```json
{
  "compartir_datos_anonimos": true,
  "backup_automatico": true,
  "modo_offline": false
}
```
- Respuesta: `{ ...configuración actualizada... }`

---

## Metas de Bienestar

### Obtener metas de bienestar
- `GET /api/usuario/metas`
- Respuesta:
```json
{
  "minutos_meditacion_diarios": 5,
  "tareas_completadas_dia": 1,
  "ejercicio_semanal_dias": 1,
  "horas_sueno_noche": 6
}
```

### Actualizar metas de bienestar
- `PUT /api/usuario/metas`
- Body:
```json
{
  "minutos_meditacion_diarios": 10,
  "tareas_completadas_dia": 2,
  "ejercicio_semanal_dias": 3,
  "horas_sueno_noche": 7
}
```
- Respuesta: `{ ...metas actualizadas... }`

---

## Notas
- Todos los endpoints requieren el header `Authorization: Bearer <accessToken>`.
- Las respuestas están listas para mapear en formularios y switches del frontend.
- Los errores vienen en formato `{ error: 'mensaje' }` y los OK en `{ ok: true }`.
