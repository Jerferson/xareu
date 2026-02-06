import {
  joinVoiceChannel,
  getVoiceConnection,
  getVoiceConnections,
  VoiceConnection,
} from '@discordjs/voice'
import { Client, VoiceChannel, Guild } from 'discord.js'
import { AudioService } from './AudioService'
import { BOT_CONFIG } from '../config/constants'
import { selectRandomMinute, minutesToMilliseconds } from '../utils/helpers'
import { ActiveConnectionResult } from '../types'

/**
 * Serviço responsável pelo gerenciamento de conexões de voz
 */
export class VoiceService {
  private barkTimersByGuild = new Map<string, NodeJS.Timeout>()
  private audioService: AudioService
  private client: Client
  private isInCasinha = new Map<string, boolean>()
  private isFollowingUser = new Map<string, boolean>()

  constructor(client: Client, audioService: AudioService) {
    this.client = client
    this.audioService = audioService
  }

  /**
   * Entra em um canal de voz
   */
  joinVoiceChannel(voiceChannel: any): VoiceConnection {
    console.log(`🎧 Entrando no canal: ${voiceChannel.name}`)

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    })

    // Aumenta o limite de listeners para evitar warning
    connection.setMaxListeners(20)

    connection.on('error', (error) => {
      console.error('❌ Erro na conexão de voz:', error)
    })

    return connection
  }

  /**
   * Sai do canal de voz
   */
  leaveVoiceChannel(guildId: string): void {
    console.log('   👋 Usuário saiu do canal - bot também vai sair')

    this.cancelScheduledBarks(guildId)

    const connection = getVoiceConnection(guildId)
    if (connection) {
      connection.destroy()
      console.log('   ✅ Bot desconectado')
    }
  }

  /**
   * Lida com a entrada no canal de voz
   */
  handleChannelEntry(voiceChannel: any, guildId: string): void {
    console.log('   ✅ Usuário entrou no canal')

    // Se está indo para um canal diferente da casinha, marca que saiu
    if (voiceChannel.name !== BOT_CONFIG.CASINHA_CHANNEL_NAME) {
      this.markLeftCasinha(guildId)
    }

    try {
      const connection = this.joinVoiceChannel(voiceChannel)

      setTimeout(() => {
        this.playEntryAudio(guildId, connection)
      }, BOT_CONFIG.ENTRY_WAIT_TIME_MS)
    } catch (error) {
      console.error('❌ Erro ao entrar no canal:', error)
    }
  }

  /**
   * Toca o áudio de entrada e inicia o ciclo de latidos (se ainda não estiver ativo)
   */
  private playEntryAudio(guildId: string, connection: VoiceConnection): void {
    this.audioService.playEntryAudio(
      connection,
      BOT_CONFIG.AUDIO_TIME_LIMIT_MS,
      () => {
        // Só inicia o ciclo de latidos se não houver um timer ativo
        const hasActiveTimer = this.barkTimersByGuild.has(guildId)
        if (!hasActiveTimer) {
          console.log('⏰ Iniciando ciclo de latidos aleatórios...')
          this.startRandomBarkCycle(guildId, connection)
        } else {
          console.log('⏰ Ciclo de latidos já está ativo, mantendo...')
        }
      }
    )
  }

  /**
   * Toca um latido aleatório
   */
  private playRandomBark(guildId: string, connection: VoiceConnection): void {
    this.audioService.playRandomBark(
      connection,
      BOT_CONFIG.AUDIO_TIME_LIMIT_MS,
      () => {
        // Usa a conexão atual para agendar o próximo
        const currentConnection = getVoiceConnection(guildId)
        if (currentConnection) {
          this.scheduleNextBark(guildId, currentConnection)
        }
      }
    )
  }

  /**
   * Agenda o próximo latido aleatório
   */
  private scheduleNextBark(guildId: string, connection: VoiceConnection): void {
    const minutes = selectRandomMinute(BOT_CONFIG.RANDOM_BARK_MINUTES)
    const milliseconds = minutesToMilliseconds(minutes)

    console.log(`⏰ Próximo latido em ${minutes} minuto(s)`)

    const timer = setTimeout(() => {
      // Pega a conexão atual (pode ter mudado de canal)
      const currentConnection = getVoiceConnection(guildId)
      if (currentConnection) {
        this.playRandomBark(guildId, currentConnection)
      } else {
        console.log('⏹️  Bot não está mais conectado, cancelando latidos')
        this.barkTimersByGuild.delete(guildId)
      }
    }, milliseconds)

    this.barkTimersByGuild.set(guildId, timer)
  }

  /**
   * Inicia o ciclo de latidos aleatórios
   */
  private startRandomBarkCycle(guildId: string, connection: VoiceConnection): void {
    this.scheduleNextBark(guildId, connection)
  }

  /**
   * Cancela latidos agendados
   */
  private cancelScheduledBarks(guildId: string): void {
    const timer = this.barkTimersByGuild.get(guildId)
    if (timer) {
      clearTimeout(timer)
      this.barkTimersByGuild.delete(guildId)
      console.log('   ⏹️  Timer de latido cancelado')
    }
  }

  /**
   * Busca uma conexão de voz ativa
   */
  async findActiveConnection(): Promise<ActiveConnectionResult> {
    const connections = getVoiceConnections()

    for (const [guildId, voiceConnection] of connections) {
      const guild = this.client.guilds.cache.get(guildId)
      const guildName = guild?.name || 'Desconhecido'
      console.log(`🔍 Conexão encontrada no servidor: ${guildName}`)
      return { connection: voiceConnection, guildName }
    }

    return { connection: null, guildName: '' }
  }

  /**
   * Toca um áudio por nome através do serviço de áudio
   */
  playAudioByName(audioName: string, connection: VoiceConnection): void {
    this.audioService.playAudioByName(audioName, connection, BOT_CONFIG.AUDIO_TIME_LIMIT_MS)
  }

  /**
   * Dado uma string completa ou parcial, busca o melhor nome de áudio correspondente
   */
  getBestMatchingAudio(audioName: string): string {
    return this.audioService.getBestMatchingAudio(audioName)
  }

  /**
   * Encontra o canal "Casinha do Xeréu" em um servidor
   */
  private findCasinhaChannel(guild: Guild): VoiceChannel | null {
    const channel = guild.channels.cache.find(
      (ch) => ch.name === BOT_CONFIG.CASINHA_CHANNEL_NAME && ch.isVoiceBased()
    )
    return channel as VoiceChannel | null
  }

  /**
   * Move o bot para a casinha do Xeréu
   */
  goToCasinha(guildId: string): void {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    const casinhaChannel = this.findCasinhaChannel(guild)
    if (!casinhaChannel) {
      console.log(`🏠 Casinha do Xeréu não encontrada no servidor ${guild.name}`)
      return
    }

    console.log(`🏠 Indo para a Casinha do Xeréu...`)

    // Para de seguir usuários
    if (this.isFollowingUser.get(guildId)) {
      console.log(`🛑 Xeréu parou de seguir - aguardando na casinha`)
    }
    this.isFollowingUser.set(guildId, false)

    // NÃO cancela latidos agendados - eles continuam rodando independente do canal

    // Entra na casinha
    this.joinVoiceChannel(casinhaChannel)
    this.isInCasinha.set(guildId, true)
  }

  /**
   * Verifica se alguém está conectado em algum canal de voz (exceto o bot)
   */
  hasUsersInVoice(guild: Guild): boolean {
    for (const channel of guild.channels.cache.values()) {
      if (channel.isVoiceBased()) {
        const voiceChannel = channel as VoiceChannel
        const members = voiceChannel.members.filter(m => !m.user.bot)
        if (members.size > 0) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Verifica se o bot está sozinho em um canal
   */
  isBotAloneInChannel(guildId: string): boolean {
    const connection = getVoiceConnection(guildId)
    if (!connection) return false

    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return false

    // Encontra o canal onde o bot está
    const botMember = guild.members.cache.get(this.client.user?.id || '')
    const botChannel = botMember?.voice.channel as VoiceChannel | null

    if (!botChannel) return false

    // Verifica se há outros usuários (não-bots) no canal
    const humanMembers = botChannel.members.filter(m => !m.user.bot)
    return humanMembers.size === 0
  }

  /**
   * Lida com usuário entrando em um canal (acordar o bot)
   */
  handleUserJoinedChannel(guildId: string): void {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    const casinhaChannel = this.findCasinhaChannel(guild)
    if (!casinhaChannel) {
      console.log(`🏠 Casinha do Xeréu não existe no servidor ${guild.name}`)
      return
    }

    const connection = getVoiceConnection(guildId)
    if (!connection) {
      console.log(`😴 Xeréu acordando... Indo para a casinha!`)
      // Limpa estados antes de ir para a casinha
      this.isFollowingUser.set(guildId, false)
      this.goToCasinha(guildId)
    } else {
      // Se já há conexão (reinício do bot), garante que não está seguindo e vai para casinha
      console.log(`🔄 Bot já conectado - resetando estado e indo para casinha...`)
      this.isFollowingUser.set(guildId, false)
      this.goToCasinha(guildId)
    }
  }

  /**
   * Lida com o bot ficando sozinho (sempre desconecta quando sozinho no servidor)
   */
  handleBotAlone(guildId: string): void {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    // Se não há ninguém no servidor, desconecta (dorme)
    if (!this.hasUsersInVoice(guild)) {
      console.log(`😴 Xeréu está sozinho no servidor e vai dormir...`)
      this.leaveVoiceChannel(guildId)
      this.isInCasinha.delete(guildId)
      this.isFollowingUser.delete(guildId)
      return
    }

    // Se há alguém no servidor mas não no canal do bot, volta para a casinha
    const casinhaChannel = this.findCasinhaChannel(guild)
    if (casinhaChannel) {
      console.log(`🏠 Xeréu ficou sozinho no canal, voltando para a casinha...`)
      this.goToCasinha(guildId)
    } else {
      // Se não tem casinha, desconecta
      console.log(`😴 Xeréu ficou sozinho e não há casinha, vai dormir...`)
      this.leaveVoiceChannel(guildId)
      this.isInCasinha.delete(guildId)
      this.isFollowingUser.delete(guildId)
    }
  }

  /**
   * Verifica se está na casinha
   */
  isInCasinhaChannel(guildId: string): boolean {
    return this.isInCasinha.get(guildId) || false
  }

  /**
   * Verifica se o bot está conectado no servidor
   */
  isBotConnected(guildId: string): boolean {
    const connection = getVoiceConnection(guildId)
    return connection !== undefined
  }

  /**
   * Marca que saiu da casinha (quando chamado para outro canal)
   */
  markLeftCasinha(guildId: string): void {
    this.isInCasinha.set(guildId, false)
  }

  /**
   * Verifica se está seguindo um usuário
   */
  isFollowingUsers(guildId: string): boolean {
    return this.isFollowingUser.get(guildId) || false
  }

  /**
   * Marca que começou a seguir usuários (quando alguém entra na casinha)
   */
  startFollowingUser(guildId: string): void {
    console.log('🐕 Xeréu agora vai seguir o usuário!')
    this.isFollowingUser.set(guildId, true)
    this.isInCasinha.set(guildId, false)
  }

  /**
   * Para de seguir usuários
   */
  stopFollowingUser(guildId: string): void {
    this.isFollowingUser.set(guildId, false)
  }
}
