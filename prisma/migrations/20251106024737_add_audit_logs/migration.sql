-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_id" INTEGER,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "details" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "outcome" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
