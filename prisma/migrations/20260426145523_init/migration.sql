-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "affinity" INTEGER NOT NULL DEFAULT 50,
    "mood" TEXT NOT NULL DEFAULT 'neutro',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_interaction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT,
    "channel_id" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "response" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_config" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "casinha_name" TEXT NOT NULL DEFAULT 'Casinha do Xeréu',
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "audio_cooldown" INTEGER NOT NULL DEFAULT 5,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "leash_owner_id" TEXT,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discord_id_key" ON "users"("discord_id");

-- CreateIndex
CREATE INDEX "users_discord_id_idx" ON "users"("discord_id");

-- CreateIndex
CREATE INDEX "users_last_interaction_idx" ON "users"("last_interaction");

-- CreateIndex
CREATE INDEX "interactions_user_id_created_at_idx" ON "interactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "interactions_guild_id_created_at_idx" ON "interactions"("guild_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "guild_config_guild_id_key" ON "guild_config"("guild_id");

-- CreateIndex
CREATE INDEX "guild_config_guild_id_idx" ON "guild_config"("guild_id");

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
