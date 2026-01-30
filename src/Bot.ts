import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { AudioService } from './services/AudioService'
import { VoiceService } from './services/VoiceService'
import { CommandService } from './services/CommandService'
import { MessageHandler } from './handlers/MessageHandler'
import { VoiceStateHandler } from './handlers/VoiceStateHandler'

/**
 * Classe principal do bot Discord
 */
export class DiscordBot {
  private client: Client
  private audioService: AudioService
  private voiceService: VoiceService
  private commandService: CommandService
  private messageHandler: MessageHandler
  private voiceStateHandler: VoiceStateHandler

  constructor() {
    // Inicializa o cliente Discord
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
      ],
    })

    // Inicializa os serviços
    this.audioService = new AudioService()
    this.voiceService = new VoiceService(this.client, this.audioService)
    this.commandService = new CommandService(this.audioService, this.voiceService)

    // Inicializa os handlers
    this.messageHandler = new MessageHandler(this.commandService)
    this.voiceStateHandler = new VoiceStateHandler(this.voiceService)

    // Registra os eventos
    this.registerEvents()
  }

  /**
   * Registra os eventos do Discord
   */
  private registerEvents(): void {
    this.client.once('ready', () => this.handleReady())
    this.client.on('error', (error) => this.handleError(error))
    this.client.on('warn', (info) => this.handleWarning(info))
    this.client.on('messageCreate', (message) => this.messageHandler.handle(message))
    this.client.on('voiceStateUpdate', (oldState, newState) =>
      this.voiceStateHandler.handle(oldState, newState)
    )
  }

  /**
   * Handler para quando o bot estiver pronto
   */
  private handleReady(): void {
    console.log(`🤖 Bot logado como ${this.client.user?.tag}`)
    console.log(`📊 Servidores conectados: ${this.client.guilds.cache.size}`)

    this.client.guilds.cache.forEach(guild => {
      console.log(`   - ${guild.name} (${guild.id})`)
    })

    console.log('\n⏳ Aguardando eventos de voz...\n')
  }

  /**
   * Handler para erros
   */
  private handleError(error: Error): void {
    console.error('❌ Erro no cliente:', error)
  }

  /**
   * Handler para avisos
   */
  private handleWarning(info: string): void {
    console.warn('⚠️  Aviso:', info)
  }

  /**
   * Inicia o bot
   */
  async start(token: string): Promise<void> {
    if (!token) {
      throw new Error('DISCORD_TOKEN não encontrado no arquivo .env')
    }

    try {
      await this.client.login(token)
    } catch (error) {
      console.error('❌ Erro ao iniciar o bot:', error)
      throw error
    }
  }

  /**
   * Para o bot
   */
  async stop(): Promise<void> {
    console.log('🛑 Encerrando bot...')
    await this.client.destroy()
    console.log('✅ Bot encerrado com sucesso')
  }

  /**
   * Retorna a instância do cliente
   */
  getClient(): Client {
    return this.client
  }
}
