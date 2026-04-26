import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { env } from './config/env'
import { buildCommands } from './commands'
import { EventBus } from './events/EventBus'
import { InteractionHandler } from './handlers/InteractionHandler'
import { MessageHandler } from './handlers/MessageHandler'
import { VoiceStateHandler } from './handlers/VoiceStateHandler'
import { disconnectPrisma, getPrisma } from './infrastructure/database'
import { disconnectRedis, getRedis } from './infrastructure/redis'
import { GuildConfigRepository } from './repositories/GuildConfigRepository'
import { InteractionRepository } from './repositories/InteractionRepository'
import { UserRepository } from './repositories/UserRepository'
import { AIService } from './services/AIService'
import { AudioQueueService } from './services/AudioQueueService'
import { AudioService } from './services/AudioService'
import { CommandService } from './services/CommandService'
import { IntelligenceService } from './services/IntelligenceService'
import { MoodService } from './services/MoodService'
import { VoiceService } from './services/VoiceService'
import { logger } from './utils/logger'

export class DiscordBot {
  private readonly client: Client
  private readonly voiceService: VoiceService
  private readonly intelligence: IntelligenceService
  private readonly messageHandler: MessageHandler
  private readonly voiceStateHandler: VoiceStateHandler
  private readonly interactionHandler: InteractionHandler
  private readonly eventBus: EventBus
  private shuttingDown = false

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    })

    const prisma = getPrisma()
    const redis = getRedis()

    // Repositories
    const userRepo = new UserRepository(prisma)
    const interactionRepo = new InteractionRepository(prisma)
    const guildConfigRepo = new GuildConfigRepository(prisma)

    // Event bus
    this.eventBus = new EventBus()

    // Domain services
    const moodService = new MoodService()
    this.intelligence = new IntelligenceService(userRepo, interactionRepo, moodService, this.eventBus)

    const audioService = new AudioService()
    const audioQueue = new AudioQueueService(audioService)
    this.voiceService = new VoiceService(
      this.client,
      audioService,
      audioQueue,
      guildConfigRepo,
      this.intelligence,
    )
    const aiService = new AIService(redis, this.intelligence, interactionRepo)
    const commandService = new CommandService(
      audioService,
      audioQueue,
      this.voiceService,
      this.intelligence,
      aiService,
      guildConfigRepo,
    )

    const commands = buildCommands({
      audioService,
      audioQueue,
      voiceService: this.voiceService,
      intelligence: this.intelligence,
      guildConfigRepo,
      aiService,
      eventBus: this.eventBus,
    })

    // Handlers
    this.messageHandler = new MessageHandler(commandService, guildConfigRepo)
    this.voiceStateHandler = new VoiceStateHandler(
      this.voiceService,
      guildConfigRepo,
      this.eventBus,
      this.intelligence,
    )
    this.interactionHandler = new InteractionHandler(commands)

    this.registerEvents()
  }

  private registerEvents(): void {
    this.client.once('clientReady', () => this.handleReady())
    this.client.on('error', (err) => logger.error({ err }, 'Discord client error'))
    this.client.on('warn', (info) => logger.warn(info))
    this.client.on('messageCreate', (message) => {
      this.messageHandler.handle(message).catch((err) => logger.error({ err }, 'MessageHandler error'))
    })
    this.client.on('voiceStateUpdate', (oldState, newState) => {
      this.voiceStateHandler
        .handle(oldState, newState)
        .catch((err) => logger.error({ err }, 'VoiceStateHandler error'))
    })
    this.client.on('interactionCreate', (interaction) => {
      this.interactionHandler
        .handle(interaction)
        .catch((err) => logger.error({ err }, 'InteractionHandler error'))
    })
  }

  private async handleReady(): Promise<void> {
    logger.info({ tag: this.client.user?.tag, guilds: this.client.guilds.cache.size }, '🤖 Bot logado')
    for (const guild of this.client.guilds.cache.values()) {
      try {
        await this.voiceService.loadGuildConfig(guild.id)
        await this.voiceService.recoverStateAfterRestart(guild.id)
      } catch (err) {
        logger.warn({ err, guild: guild.name }, 'Falha ao carregar config/recuperar estado')
      }
    }
    logger.info('⏳ Aguardando eventos...')
  }

  async start(): Promise<void> {
    await this.client.login(env.DISCORD_TOKEN)
  }

  async stop(): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true
    logger.info('🛑 Encerrando bot...')

    try {
      this.voiceService.shutdown()
      this.eventBus.removeAllListeners()
      await this.client.destroy()
      await disconnectRedis()
      await disconnectPrisma()
      logger.info('✅ Bot encerrado')
    } catch (err) {
      logger.error({ err }, 'Erro durante shutdown')
    }
  }

  getClient(): Client {
    return this.client
  }
}
