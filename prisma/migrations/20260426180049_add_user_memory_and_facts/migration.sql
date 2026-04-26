-- CreateTable
CREATE TABLE "user_memory" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_facts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_memory_user_id_key" ON "user_memory"("user_id");

-- CreateIndex
CREATE INDEX "user_facts_user_id_idx" ON "user_facts"("user_id");

-- CreateIndex
CREATE INDEX "user_facts_last_seen_at_idx" ON "user_facts"("last_seen_at");

-- AddForeignKey
ALTER TABLE "user_memory" ADD CONSTRAINT "user_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
