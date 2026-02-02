import {
  joinVoiceChannel,
  getVoiceConnection,
  getVoiceConnections,
  VoiceConnection,
} from '@discordjs/voice'
import { Client } from 'discord.js'
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
   * Toca o áudio de entrada e inicia o ciclo de latidos
   */
  private playEntryAudio(guildId: string, connection: VoiceConnection): void {
    this.audioService.playEntryAudio(
      connection,
      BOT_CONFIG.AUDIO_TIME_LIMIT_MS,
      () => {
        this.startRandomBarkCycle(guildId, connection)
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
        this.scheduleNextBark(guildId, connection)
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
      this.playRandomBark(guildId, connection)
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
}
