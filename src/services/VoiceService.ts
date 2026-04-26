import {
  entersState,
  getVoiceConnection,
  getVoiceConnections,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { Client, Guild, VoiceChannel } from 'discord.js'
import { AFFINITY_CONFIG, AUDIO_CONFIG, BOT_CONFIG } from '../config/constants'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { AudioService } from './AudioService'
import { AudioQueueService } from './AudioQueueService'
import { IntelligenceService } from './IntelligenceService'
import { selectRandomMinute, minutesToMilliseconds } from '../utils/helpers'
import { logger as log } from '../utils/logger'

interface GuildState {
  isInCasinha: boolean
  isFollowing: boolean
  barkTimer?: NodeJS.Timeout
  casinhaName: string
}

export class VoiceService {
  private readonly state = new Map<string, GuildState>()
  private readonly lifecycleLoggedConnections = new WeakSet<VoiceConnection>()

  constructor(
    private readonly client: Client,
    private readonly audioService: AudioService,
    private readonly audioQueue: AudioQueueService,
    private readonly guildConfigRepo: GuildConfigRepository,
    private readonly intelligence: IntelligenceService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // Estado por guilda
  // ────────────────────────────────────────────────────────────────

  private getState(guildId: string): GuildState {
    let s = this.state.get(guildId)
    if (!s) {
      s = { isInCasinha: false, isFollowing: false, casinhaName: BOT_CONFIG.DEFAULT_CASINHA_NAME }
      this.state.set(guildId, s)
    }
    return s
  }

  async loadGuildConfig(guildId: string): Promise<void> {
    const config = await this.guildConfigRepo.getOrCreate(guildId)
    this.getState(guildId).casinhaName = config.casinhaName
  }

  /**
   * Restaura o estado em memória após um restart do processo.
   * Se o bot já está conectado num canal de voz (Discord mantém a sessão),
   * inferimos `isInCasinha`/`isFollowing` a partir do canal atual.
   */
  async recoverStateAfterRestart(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    const botMember = guild.members.cache.get(this.client.user?.id ?? '')
    const botChannel = botMember?.voice.channel as VoiceChannel | null
    if (!botChannel) return

    const s = this.getState(guildId)
    if (botChannel.name === s.casinhaName) {
      s.isInCasinha = true
      s.isFollowing = false
      log.info({ guildId, channel: botChannel.name }, '♻️ Estado recuperado: na casinha')
    } else {
      s.isInCasinha = false
      s.isFollowing = true
      log.info({ guildId, channel: botChannel.name }, '♻️ Estado recuperado: seguindo')
    }
  }

  setCasinhaName(guildId: string, name: string): void {
    this.getState(guildId).casinhaName = name
  }

  /**
   * Loga toda mudança de status na conexão — útil pra entender se a conexão
   * fica oscilando, reconectando, sendo derrubada, etc.
   */
  private attachConnectionLifecycleLogs(
    connection: VoiceConnection,
    guildId: string,
    channelName: string,
  ): void {
    if (this.lifecycleLoggedConnections.has(connection)) {
      // Mesma connection reusada (joinVoiceChannel reaproveita) — listeners já existem
      return
    }
    this.lifecycleLoggedConnections.add(connection)

    const states: VoiceConnectionStatus[] = [
      VoiceConnectionStatus.Signalling,
      VoiceConnectionStatus.Connecting,
      VoiceConnectionStatus.Ready,
      VoiceConnectionStatus.Disconnected,
      VoiceConnectionStatus.Destroyed,
    ]
    for (const state of states) {
      connection.on(state, (oldState, newState) => {
        log.info(
          { guildId, channel: channelName, from: oldState.status, to: newState.status },
          `🔌 voice connection: ${state}`,
        )
      })
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Conexões
  // ────────────────────────────────────────────────────────────────

  /**
   * Conecta no canal e aguarda a conexão ficar `Ready`.
   * Se a conexão antiga estiver travada/disconnected, destrói antes de criar a nova.
   */
  async joinChannel(channel: VoiceChannel): Promise<VoiceConnection> {
    const guildId = channel.guild.id
    log.info({ channel: channel.name, guildId }, '🎧 Entrando no canal')

    // Se já existe uma conexão e ela está num estado ruim, destrói antes
    const existing = getVoiceConnection(guildId)
    if (existing && existing.state.status === VoiceConnectionStatus.Disconnected) {
      log.warn({ guildId }, 'Conexão anterior estava Disconnected, destruindo antes de reconectar')
      try {
        existing.destroy()
      } catch {
        /* ignore */
      }
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
    })

    connection.removeAllListeners('error')
    connection.on('error', (err) => log.error({ err, guildId }, 'Erro na conexão de voz'))

    // Log cada mudança de status — entender se está conectando/reconectando/falhando
    this.attachConnectionLifecycleLogs(connection, guildId, channel.name)

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000)
      log.info({ guildId, channel: channel.name, status: connection.state.status }, '✅ Conexão Ready')
    } catch (err) {
      log.error(
        { err: (err as Error).message, guildId, channel: channel.name, status: connection.state.status },
        'Conexão não ficou Ready em 10s — destruindo e tentando uma vez',
      )
      try {
        connection.destroy()
      } catch {
        /* ignore */
      }
      // Retry uma vez
      const retry = joinVoiceChannel({
        channelId: channel.id,
        guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
      })
      retry.on('error', (e) => log.error({ err: e, guildId }, 'Erro na conexão de voz (retry)'))
      this.attachConnectionLifecycleLogs(retry, guildId, channel.name + ' [retry]')
      try {
        await entersState(retry, VoiceConnectionStatus.Ready, 10_000)
        log.info({ guildId, channel: channel.name }, '✅ Conexão Ready (retry)')
      } catch (retryErr) {
        log.error(
          { err: (retryErr as Error).message, guildId, channel: channel.name },
          '❌ Falha ao conectar mesmo após retry',
        )
      }
      return retry
    }

    return connection
  }

  leaveChannel(guildId: string): void {
    this.cancelScheduledBarks(guildId)
    this.audioQueue.clearGuild(guildId)
    const connection = getVoiceConnection(guildId)
    if (connection) {
      try {
        connection.destroy()
      } catch (err) {
        log.warn({ err, guildId }, 'Erro ao destruir conexão (ignorado)')
      }
    }
    const s = this.getState(guildId)
    s.isInCasinha = false
    s.isFollowing = false
  }

  isBotConnected(guildId: string): boolean {
    return getVoiceConnection(guildId) !== undefined
  }

  // ────────────────────────────────────────────────────────────────
  // Casinha
  // ────────────────────────────────────────────────────────────────

  findCasinhaChannel(guild: Guild): VoiceChannel | null {
    const name = this.getState(guild.id).casinhaName
    const channel = guild.channels.cache.find((ch) => ch.name === name && ch.isVoiceBased())
    return (channel as VoiceChannel | undefined) ?? null
  }

  isInCasinha(guildId: string): boolean {
    return this.getState(guildId).isInCasinha
  }

  isFollowing(guildId: string): boolean {
    return this.getState(guildId).isFollowing
  }

  async goToCasinha(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    const casinha = this.findCasinhaChannel(guild)
    if (!casinha) {
      log.info({ guildId, guild: guild.name }, '🏠 Casinha não encontrada')
      return
    }

    log.info({ guildId, guild: guild.name }, '🏠 Indo para a casinha')
    const s = this.getState(guildId)
    s.isFollowing = false
    s.isInCasinha = true
    await this.joinChannel(casinha)
  }

  async startFollowing(guildId: string): Promise<void> {
    const s = this.getState(guildId)
    s.isFollowing = true
    s.isInCasinha = false
    log.info({ guildId }, '🐕 Começou a seguir')
  }

  /**
   * Move o bot até o canal onde o usuário está e ativa o modo follow.
   * Retorna `false` se o usuário não está em nenhum canal de voz na guilda.
   */
  async goToUser(guildId: string, userId: string): Promise<boolean> {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return false

    const member = guild.members.cache.get(userId)
    const channel = member?.voice.channel as VoiceChannel | null
    if (!channel) return false

    log.info({ guildId, userId, channel: channel.name }, '🦮 Indo até o dono da coleira')
    await this.startFollowing(guildId)
    await this.handleChannelEntry(channel)
    return true
  }

  async handleChannelEntry(channel: VoiceChannel): Promise<VoiceConnection> {
    const guildId = channel.guild.id
    const s = this.getState(guildId)

    if (channel.name !== s.casinhaName) {
      s.isInCasinha = false
    }

    // Detecta se o bot está chegando num canal novo ou só revalidando o atual
    const previousChannelId = getVoiceConnection(guildId)?.joinConfig.channelId
    const isNewChannel = previousChannelId !== channel.id

    const connection = await this.joinChannel(channel)

    if (isNewChannel) {
      // Bot chegando — toca latido amigável de cumprimento
      setTimeout(() => {
        void this.audioQueue.playInternal(connection, guildId, AUDIO_CONFIG.DEFAULT_BARK_FILE)
        this.schedulePeriodicBark(guildId)
      }, BOT_CONFIG.ENTRY_WAIT_TIME_MS)
    } else {
      log.info({ guildId, channel: channel.name }, '⏭️ canal idem — sem latido (bot já estava aqui)')
    }

    return connection
  }

  /**
   * Reação do bot quando alguém entra no canal onde ele já está:
   * - afinidade < 30 → rosnado (alto)
   * - afinidade ≥ 30 (ou sem memória) → latido amigável de cumprimento
   */
  async playEntryReactionFor(guildId: string, userId: string): Promise<void> {
    const connection = getVoiceConnection(guildId)
    if (!connection) return

    const memory = await this.intelligence.getMemory(userId)
    const threshold = AFFINITY_CONFIG.ROSNADO_AFFINITY_MAX
    const affinity = memory?.user.affinity

    if (affinity !== undefined && affinity < threshold) {
      log.info(
        { guildId, userId, affinity, threshold },
        '🐺 rosnando: user de afinidade baixa entrou no canal do bot',
      )
      void this.audioQueue.playInternal(
        connection,
        guildId,
        AUDIO_CONFIG.ROSNADO_FILE,
        AUDIO_CONFIG.ROSNADO_VOLUME_BOOST,
      )
      return
    }

    log.info({ guildId, userId, affinity }, '🐕 latindo amigável: user entrou no canal do bot')
    void this.audioQueue.playInternal(connection, guildId, AUDIO_CONFIG.DEFAULT_BARK_FILE)
  }

  /** Retorna o channelId atual do bot na guilda (ou null). */
  getBotChannelId(guildId: string): string | null {
    const guild = this.client.guilds.cache.get(guildId)
    const botMember = guild?.members.cache.get(this.client.user?.id ?? '')
    return botMember?.voice.channelId ?? null
  }

  // ────────────────────────────────────────────────────────────────
  // Latidos periódicos (mesmo som, intervalo aleatório)
  // ────────────────────────────────────────────────────────────────

  private schedulePeriodicBark(guildId: string): void {
    const s = this.getState(guildId)
    if (s.barkTimer) return // Já agendado

    const minutes = selectRandomMinute(BOT_CONFIG.RANDOM_BARK_MINUTES)
    log.info({ guildId, minutes }, '⏰ Próximo latido em ' + minutes + ' min')

    s.barkTimer = setTimeout(() => {
      s.barkTimer = undefined
      const connection = getVoiceConnection(guildId)
      if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
        log.debug({ guildId }, 'Conexão inativa — encerrando ciclo de latidos')
        return
      }
      void this.audioQueue.playInternal(connection, guildId, AUDIO_CONFIG.DEFAULT_BARK_FILE)
      this.schedulePeriodicBark(guildId)
    }, minutesToMilliseconds(minutes))
  }

  cancelScheduledBarks(guildId: string): void {
    const s = this.getState(guildId)
    if (s.barkTimer) {
      clearTimeout(s.barkTimer)
      s.barkTimer = undefined
      log.debug({ guildId }, '⏹️ Latidos cancelados')
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Estado dos canais
  // ────────────────────────────────────────────────────────────────

  hasUsersInVoice(guild: Guild): boolean {
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isVoiceBased()) continue
      const humans = (channel as VoiceChannel).members.filter((m) => !m.user.bot)
      if (humans.size > 0) return true
    }
    return false
  }

  isBotAloneInChannel(guildId: string): boolean {
    const connection = getVoiceConnection(guildId)
    if (!connection) return false

    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return false

    const botMember = guild.members.cache.get(this.client.user?.id ?? '')
    const botChannel = botMember?.voice.channel as VoiceChannel | null
    if (!botChannel) return false

    return botChannel.members.filter((m) => !m.user.bot).size === 0
  }

  async handleUserJoinedChannel(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    const casinha = this.findCasinhaChannel(guild)
    if (!casinha) return

    const s = this.getState(guildId)
    s.isFollowing = false
    await this.goToCasinha(guildId)
  }

  async handleBotAlone(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    if (!this.hasUsersInVoice(guild)) {
      log.info({ guildId }, '😴 Servidor vazio, dormindo')
      this.leaveChannel(guildId)
      return
    }

    const casinha = this.findCasinhaChannel(guild)
    if (casinha) {
      log.info({ guildId }, '🏠 Voltando para a casinha')
      await this.goToCasinha(guildId)
    } else {
      log.info({ guildId }, '😴 Sem casinha, dormindo')
      this.leaveChannel(guildId)
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Multi-guild: lookup de conexões
  // ────────────────────────────────────────────────────────────────

  /**
   * Retorna a conexão de uma guilda específica, se existir.
   */
  getConnection(guildId: string): VoiceConnection | null {
    return getVoiceConnection(guildId) ?? null
  }

  /**
   * Lista todas as guildas em que o bot está conectado, com nome.
   */
  listActiveGuilds(): { guildId: string; guildName: string }[] {
    const result: { guildId: string; guildName: string }[] = []
    for (const guildId of getVoiceConnections().keys()) {
      const guild = this.client.guilds.cache.get(guildId)
      result.push({ guildId, guildName: guild?.name ?? 'Desconhecido' })
    }
    return result
  }

  /** Limpa todos os timers em desligamento. */
  shutdown(): void {
    for (const guildId of this.state.keys()) {
      this.cancelScheduledBarks(guildId)
    }
    for (const [, conn] of getVoiceConnections()) {
      try {
        conn.destroy()
      } catch {
        /* ignore */
      }
    }
    this.state.clear()
  }
}
