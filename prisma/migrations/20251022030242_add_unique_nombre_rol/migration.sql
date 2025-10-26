-- CreateTable
CREATE TABLE "organizaciones" (
    "id_org" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT,
    "sector" TEXT,
    "pais" TEXT,
    "tamano" INTEGER,
    "fecha_creacion" DATETIME
);

-- CreateTable
CREATE TABLE "departamentos" (
    "id_departamento" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_org" INTEGER NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    CONSTRAINT "departamentos_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "estado" TEXT,
    "id_org" INTEGER,
    "id_departamento" INTEGER,
    "cargo" TEXT,
    "telefono" TEXT,
    "fecha_nacimiento" DATETIME,
    "fecha_creacion" DATETIME,
    "fecha_actualizacion" DATETIME,
    CONSTRAINT "usuarios_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "usuarios_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "departamentos" ("id_departamento") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id_rol" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre_rol" TEXT,
    "descripcion" TEXT
);

-- CreateTable
CREATE TABLE "usuarios_roles" (
    "id_usuario_rol" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "created_at" DATETIME,
    CONSTRAINT "usuarios_roles_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "usuarios_roles_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles" ("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id_sesion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "token" TEXT,
    "ip_origen" TEXT,
    "user_agent" TEXT,
    "fecha_inicio" DATETIME,
    "fecha_fin" DATETIME,
    "estado" TEXT,
    CONSTRAINT "sesiones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "permisos" (
    "id_permiso" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recurso" TEXT,
    "accion" TEXT
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "id_rol_permiso" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    CONSTRAINT "roles_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles" ("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "roles_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos" ("id_permiso") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id_auditoria" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER,
    "accion" TEXT,
    "tabla_afectada" TEXT,
    "id_registro_afectado" TEXT,
    "detalle" TEXT,
    "fecha_hora" DATETIME,
    "ip_origen" TEXT,
    CONSTRAINT "auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "preguntas_diarias" (
    "id_pregunta" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT,
    "tipo" TEXT,
    "opciones" TEXT,
    "estado" TEXT
);

-- CreateTable
CREATE TABLE "respuestas_diarias" (
    "id_respuesta" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "fecha" DATETIME,
    "id_pregunta" INTEGER NOT NULL,
    "valor" TEXT,
    CONSTRAINT "respuestas_diarias_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "respuestas_diarias_id_pregunta_fkey" FOREIGN KEY ("id_pregunta") REFERENCES "preguntas_diarias" ("id_pregunta") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evaluaciones" (
    "id_evaluacion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "tipo" TEXT,
    "puntaje" REAL,
    "interpretacion" TEXT,
    "fecha" DATETIME,
    CONSTRAINT "evaluaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registros_emocionales" (
    "id_registro" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "fecha" DATETIME,
    "estado_emocional" TEXT,
    "notas" TEXT,
    CONSTRAINT "registros_emocionales_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "progreso_bienestar" (
    "id_progreso" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "periodo" TEXT,
    "bienestar_pct" REAL,
    "tendencia" REAL,
    "metas_logradas" INTEGER,
    "resumen" TEXT,
    CONSTRAINT "progreso_bienestar_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recomendaciones" (
    "id_recomendacion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "fecha" DATETIME,
    "area_mejora" TEXT,
    "sugerencia" TEXT,
    "origen" TEXT,
    "id_recurso" INTEGER,
    CONSTRAINT "recomendaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recomendaciones_id_recurso_fkey" FOREIGN KEY ("id_recurso") REFERENCES "recursos_biblioteca" ("id_recurso") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recursos_biblioteca" (
    "id_recurso" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT,
    "tipo" TEXT,
    "url" TEXT,
    "categoria" TEXT,
    "descripcion" TEXT,
    "estado" TEXT,
    "created_at" DATETIME
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "mensaje" TEXT,
    "tipo" TEXT,
    "fecha_envio" DATETIME,
    "estado" TEXT,
    CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tareas" (
    "id_tarea" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "titulo" TEXT,
    "descripcion" TEXT,
    "estado" TEXT,
    "prioridad" TEXT,
    "tiempo_estimado_min" INTEGER,
    "fecha_creacion" DATETIME,
    "fecha_vencimiento" DATETIME,
    "fecha_completada" DATETIME,
    CONSTRAINT "tareas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "metas_bienestar" (
    "id_meta" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "titulo" TEXT,
    "descripcion" TEXT,
    "objetivo_pct" REAL,
    "progreso_pct" REAL,
    "fecha_inicio" DATETIME,
    "fecha_fin" DATETIME,
    CONSTRAINT "metas_bienestar_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tareas_log" (
    "id_tarea_log" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_tarea" INTEGER NOT NULL,
    "accion" TEXT,
    "fecha_hora" DATETIME,
    "detalle" TEXT,
    CONSTRAINT "tareas_log_id_tarea_fkey" FOREIGN KEY ("id_tarea") REFERENCES "tareas" ("id_tarea") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversaciones_ia" (
    "id_conversacion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "fecha_inicio" DATETIME,
    "estado" TEXT,
    "contexto_mood" TEXT,
    CONSTRAINT "conversaciones_ia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mensajes_ia" (
    "id_mensaje" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_conversacion" INTEGER NOT NULL,
    "emisor" TEXT,
    "contenido" TEXT,
    "fecha_hora" DATETIME,
    "tags" TEXT,
    CONSTRAINT "mensajes_ia_id_conversacion_fkey" FOREIGN KEY ("id_conversacion") REFERENCES "conversaciones_ia" ("id_conversacion") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "id_grupo" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "board_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupos_trabajo" ("id_grupo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "column" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "id_board" INTEGER NOT NULL,
    CONSTRAINT "column_id_board_fkey" FOREIGN KEY ("id_board") REFERENCES "board" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "id_column" INTEGER NOT NULL,
    "id_board" INTEGER NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "prioridad" TEXT,
    "etiquetas" TEXT,
    "fechaVencimiento" DATETIME,
    "estado" TEXT,
    "id_sprint" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_id_column_fkey" FOREIGN KEY ("id_column") REFERENCES "column" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_id_board_fkey" FOREIGN KEY ("id_board") REFERENCES "board" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupos_trabajo" ("id_grupo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_id_sprint_fkey" FOREIGN KEY ("id_sprint") REFERENCES "sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_asignado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_task" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    CONSTRAINT "task_asignado_id_task_fkey" FOREIGN KEY ("id_task") REFERENCES "task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "task_asignado_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sprint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_board" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "estado" TEXT,
    CONSTRAINT "sprint_id_board_fkey" FOREIGN KEY ("id_board") REFERENCES "board" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sesiones_terapia" (
    "id_sesion" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "id_profesional" INTEGER NOT NULL,
    "tipo" TEXT,
    "fecha_inicio" DATETIME,
    "fecha_fin" DATETIME,
    "estado" TEXT,
    "progreso_pct" REAL,
    "notas" TEXT,
    CONSTRAINT "sesiones_terapia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sesiones_terapia_id_profesional_fkey" FOREIGN KEY ("id_profesional") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupos_trabajo" (
    "id_grupo" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_org" INTEGER NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    "progreso_pct" REAL,
    "estado" TEXT,
    CONSTRAINT "grupos_trabajo_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupos_miembros" (
    "id_grupo_miembro" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_grupo" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "rol_en_grupo" TEXT,
    "joined_at" DATETIME,
    CONSTRAINT "grupos_miembros_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupos_trabajo" ("id_grupo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "grupos_miembros_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "llamadas" (
    "id_llamada" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_empleado" INTEGER NOT NULL,
    "fecha" DATETIME,
    "duracion_seg" INTEGER,
    "resultado" TEXT,
    "relacion_proyecto" TEXT,
    CONSTRAINT "llamadas_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "productividad_empleado" (
    "id_prod" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "periodo" TEXT,
    "evaluaciones_recibidas" INTEGER,
    "rendimiento_promedio_pct" REAL,
    "casos_resueltos" INTEGER,
    CONSTRAINT "productividad_empleado_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reportes_productividad" (
    "id_reporte" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_org" INTEGER NOT NULL,
    "fecha" DATETIME,
    "entregables" INTEGER,
    "tiempo_entrega_pct" REAL,
    "efectividad_score" REAL,
    "retrasos" INTEGER,
    "por_departamento" TEXT,
    CONSTRAINT "reportes_productividad_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "empleados_destacados" (
    "id_destacado" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_org" INTEGER NOT NULL,
    "periodo" TEXT,
    "id_usuario" INTEGER NOT NULL,
    "motivo" TEXT,
    CONSTRAINT "empleados_destacados_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "empleados_destacados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "preferencias_usuario" (
    "id_preferencia" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "idioma" TEXT,
    "pais" TEXT,
    "zona_horaria" TEXT,
    "tema" TEXT,
    "color_principal" TEXT,
    "frecuencia_recordatorios" TEXT,
    "intereses_bienestar" TEXT,
    CONSTRAINT "preferencias_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "configuracion_notificaciones" (
    "id_conf_notif" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "meditacion" BOOLEAN,
    "tareas" BOOLEAN,
    "preguntas_diarias" BOOLEAN,
    "bienestar_recordatorios" BOOLEAN,
    CONSTRAINT "configuracion_notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "privacidad_datos" (
    "id_privacidad" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "compartir_con_investigadores" BOOLEAN,
    "modo_offline" BOOLEAN,
    "fecha_aceptacion" DATETIME,
    CONSTRAINT "privacidad_datos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "indicadores_organizacion" (
    "id_indicador" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_org" INTEGER NOT NULL,
    "fecha" DATETIME,
    "tipo_indicador" TEXT,
    "valor" REAL,
    CONSTRAINT "indicadores_organizacion_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "descargas_reportes" (
    "id_descarga" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_usuario" INTEGER NOT NULL,
    "tipo_reporte" TEXT,
    "fecha_hora" DATETIME,
    "formato" TEXT,
    CONSTRAINT "descargas_reportes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_roles_id_usuario_id_rol_key" ON "usuarios_roles"("id_usuario", "id_rol");

-- CreateIndex
CREATE UNIQUE INDEX "roles_permisos_id_rol_id_permiso_key" ON "roles_permisos"("id_rol", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_diarias_id_usuario_id_pregunta_fecha_key" ON "respuestas_diarias"("id_usuario", "id_pregunta", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "task_asignado_id_task_id_usuario_key" ON "task_asignado"("id_task", "id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_miembros_id_grupo_id_usuario_key" ON "grupos_miembros"("id_grupo", "id_usuario");
