import { REST, Routes } from 'discord.js'
import { env } from '../config/env'
import { AudioService } from '../services/AudioService'
import { AudioQueueService } from '../services/AudioQueueService'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { buildCommands } from '../commands'
import { logger } from '../utils/logger'

/**
 * Registra os slash commands globalmente.
 * Uso: `npm run commands:register`
 *
 * Atenção: comandos globais podem levar até 1h pra propagar. Para teste rápido,
 * rode em uma guilda específica via env GUILD_ID.
 */
async function main(): Promise<void> {
  if (!env.DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID é obrigatório para registrar comandos')
  }

  // Stubs leves: registerCommands só lê metadata `data`, não precisa do bot real.
  const audioService = new AudioService()
  const audioQueue = new AudioQueueService(audioService)
  const stub = {} as never
  const guildConfigRepo = new GuildConfigRepository(stub)

  const commands = buildCommands({
    audioService,
    audioQueue,
    voiceService: stub,
    intelligence: stub,
    guildConfigRepo,
    aiService: stub,
    eventBus: stub,
  })

  const payload = Array.from(commands.values()).map((c) => c.data.toJSON())
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN)

  const guildId = process.env.GUILD_ID
  if (guildId) {
    logger.info({ guildId, count: payload.length }, '🔧 Registrando comandos na guilda')
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), { body: payload })
  } else {
    logger.info({ count: payload.length }, '🌍 Registrando comandos globais')
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: payload })
  }
  logger.info('✅ Comandos registrados!')
}

main().catch((err) => {
  logger.error({ err }, 'Falha ao registrar comandos')
  process.exit(1)
})
