-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_grupos_trabajo" (
    "id_grupo" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "id_org" INTEGER NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    "progreso_pct" REAL,
    "estado" TEXT,
    "leader_id" INTEGER,
    "visibility" TEXT DEFAULT 'private',
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME,
    CONSTRAINT "grupos_trabajo_id_org_fkey" FOREIGN KEY ("id_org") REFERENCES "organizaciones" ("id_org") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_grupos_trabajo" ("created_at", "created_by", "descripcion", "estado", "id_grupo", "id_org", "leader_id", "nombre", "progreso_pct", "updated_at", "visibility") SELECT "created_at", "created_by", "descripcion", "estado", "id_grupo", "id_org", "leader_id", "nombre", "progreso_pct", "updated_at", "visibility" FROM "grupos_trabajo";
DROP TABLE "grupos_trabajo";
ALTER TABLE "new_grupos_trabajo" RENAME TO "grupos_trabajo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
