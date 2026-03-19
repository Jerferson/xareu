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
  /** Mapa de guildId -> userId que tem a coleira */
  private collarHolder = new Map<string, string>()

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

    console.log(`😴 Xeréu acordando... Indo para a casinha!`)
    this.goToCasinha(guildId)
  }

  /**
   * Lida com o bot ficando sozinho (sempre desconecta quando sozinho no servidor)
   */
  handleBotAlone(guildId: string): void {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return

    // Se não há ninguém no servidor, desconecta (dorme) e libera coleira
    if (!this.hasUsersInVoice(guild)) {
      console.log(`😴 Xeréu está sozinho no servidor e vai dormir...`)
      this.collarHolder.delete(guildId)
      this.leaveVoiceChannel(guildId)
      this.isInCasinha.delete(guildId)
      return
    }

    // Se o dono da coleira saiu, libera a coleira
    const collarHolderId = this.collarHolder.get(guildId)
    if (collarHolderId) {
      const holderMember = guild.members.cache.get(collarHolderId)
      if (!holderMember?.voice.channel) {
        console.log(`🏠 Dono da coleira saiu do canal de voz, liberando coleira...`)
        this.forceReleaseCollar(guildId)
      }
    }

    // Se há alguém no servidor mas não no canal do bot, volta para a casinha
    const casinhaChannel = this.findCasinhaChannel(guild)
    if (casinhaChannel) {
      console.log(`🏠 Xeréu ficou sozinho no canal, voltando para a casinha...`)
      this.goToCasinha(guildId)
    } else {
      // Se não tem casinha, desconecta
      console.log(`😴 Xeréu ficou sozinho e não há casinha, vai dormir...`)
      this.collarHolder.delete(guildId)
      this.leaveVoiceChannel(guildId)
      this.isInCasinha.delete(guildId)
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

  // ========== MÉTODOS DE COLEIRA ==========

  /**
   * Dá a coleira para um usuário
   * @returns true se conseguiu dar a coleira, false se não
   */
  giveCollar(guildId: string, userId: string): { success: boolean; previousHolder?: string } {
    const currentHolder = this.collarHolder.get(guildId)
    const isMaster = userId === BOT_CONFIG.MASTER_USER_ID

    // Se já tem a coleira, não faz nada
    if (currentHolder === userId) {
      return { success: true }
    }

    // Se há outro dono e não é master, não pode pegar
    if (currentHolder && !isMaster) {
      return { success: false, previousHolder: currentHolder }
    }

    // Dá a coleira
    const previousHolder = currentHolder
    this.collarHolder.set(guildId, userId)
    this.isInCasinha.set(guildId, false)
    console.log(`🎀 Coleira dada para ${userId}${previousHolder ? ` (tomada de ${previousHolder})` : ''}`)
    
    return { success: true, previousHolder }
  }

  /**
   * Libera a coleira e volta para a casinha
   */
  releaseCollar(guildId: string, userId: string): boolean {
    const currentHolder = this.collarHolder.get(guildId)
    const isMaster = userId === BOT_CONFIG.MASTER_USER_ID
    
    // Só pode soltar se é o dono ou é master
    if (currentHolder !== userId && !isMaster) {
      return false
    }

    this.collarHolder.delete(guildId)
    console.log(`🏠 Coleira liberada, voltando para a casinha...`)
    
    this.goToCasinha(guildId)
    return true
  }

  /**
   * Retorna o ID do usuário que tem a coleira
   */
  getCollarHolder(guildId: string): string | undefined {
    return this.collarHolder.get(guildId)
  }

  /**
   * Verifica se um usuário específico tem a coleira
   */
  hasCollar(guildId: string, userId: string): boolean {
    return this.collarHolder.get(guildId) === userId
  }

  /**
   * Verifica se há alguém com a coleira
   */
  isCollarTaken(guildId: string): boolean {
    return this.collarHolder.has(guildId)
  }

  /**
   * Força liberação da coleira (para quando usuário sai do servidor)
   */
  forceReleaseCollar(guildId: string): void {
    const holder = this.collarHolder.get(guildId)
    if (holder) {
      console.log(`🏠 Usuário ${holder} saiu, coleira liberada automaticamente`)
      this.collarHolder.delete(guildId)
    }
  }

  /**
   * Transfere a coleira para um usuário aleatório no canal atual do bot
   * @returns O novo dono da coleira ou null se não há usuários
   */
  transferCollarToRandomUser(guildId: string): string | null {
    const guild = this.client.guilds.cache.get(guildId)
    if (!guild) return null

    // Encontra o canal onde o bot está
    const botMember = guild.members.cache.get(this.client.user?.id || '')
    const botChannel = botMember?.voice.channel as VoiceChannel | null

    if (!botChannel) return null

    // Pega todos os usuários humanos no canal (excluindo bots)
    const humanMembers = botChannel.members.filter(m => !m.user.bot)

    if (humanMembers.size === 0) {
      console.log('🎲 Nenhum usuário disponível para receber a coleira')
      return null
    }

    // Escolhe um usuário aleatório
    const membersArray = Array.from(humanMembers.values())
    const randomIndex = Math.floor(Math.random() * membersArray.length)
    const newHolder = membersArray[randomIndex]

    // Transfere a coleira
    this.collarHolder.set(guildId, newHolder.id)
    console.log(`🎲 Coleira transferida aleatoriamente para ${newHolder.user.tag}`)

    return newHolder.id
  }

  /**
   * Encontra o canal de voz onde o usuário está
   */
  findUserVoiceChannel(userId: string): { guildId: string; channel: VoiceChannel } | null {
    for (const guild of this.client.guilds.cache.values()) {
      const member = guild.members.cache.get(userId)
      if (member?.voice.channel) {
        return { guildId: guild.id, channel: member.voice.channel as VoiceChannel }
      }
    }
    return null
  }
}
