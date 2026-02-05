import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  AudioPlayer,
  VoiceConnection,
} from '@discordjs/voice'
import { join, resolve } from 'path'
import * as fs from 'fs'
import stringSimilarity from 'string-similarity-js'
import { AUDIO_CONFIG } from '../config/constants'
import { AudioFileInfo } from '../types'

/**
 * Serviço responsável pelo gerenciamento e reprodução de áudios
 */
export class AudioService {
  private readonly audiosPath: string

  constructor() {
    // Resolve o caminho absoluto para a pasta de áudios
    // process.cwd() retorna o diretório raiz do projeto
    this.audiosPath = resolve(process.cwd(), AUDIO_CONFIG.AUDIOS_FOLDER)
  }

  /**
   * Cria um player de áudio com limite de tempo
   */
  createPlayerWithTimeLimit(
    audioPath: string,
    connection: VoiceConnection,
    timeLimitMs: number,
    onFinish?: () => void
  ): AudioPlayer {
    const player = createAudioPlayer()
    const resource = createAudioResource(audioPath)

    player.play(resource)
    connection.subscribe(player)

    const stopTimer = setTimeout(() => {
      if (player.state.status !== AudioPlayerStatus.Idle) {
        console.log(`⏱️  Áudio interrompido (limite de ${timeLimitMs}ms)`)
        player.stop()
      }
    }, timeLimitMs)

    player.on(AudioPlayerStatus.Idle, () => {
      clearTimeout(stopTimer)
      console.log('✅ Áudio finalizado')
      if (onFinish) onFinish()
    })

    player.on('error', (error) => {
      clearTimeout(stopTimer)
      console.error('❌ Erro ao tocar áudio:', error)
      if (onFinish) onFinish()
    })

    return player
  }

  getBestMatchingAudio(completeOrPartiaAudioName: string): string {
    const audioFiles = fs.readdirSync(this.audiosPath)
      .map((file): AudioFileInfo => {
        const bootstrap = file.includes(completeOrPartiaAudioName) ? 100 : 0
        const metric = bootstrap + stringSimilarity(completeOrPartiaAudioName, file.replace(/\D/, ''))
        return { file, distance: metric }
      })
      .sort((o1, o2) => o2.distance - o1.distance)

    const bestMatch = audioFiles[0]
    if (!bestMatch) {
      console.error('❌ Nenhum áudio encontrado')
      return '';
    }

    return bestMatch.file;
  }

  /**
   * Toca um áudio específico pelo nome
   */
  playAudioByName(
    audioName: string,
    connection: VoiceConnection,
    timeLimitMs: number = 5000
  ): void {
    if (!audioName) {
      return
    }

    const audioFilePath = join(this.audiosPath, audioName)
    console.log(`🎵 Tocando áudio: ${audioName}`)
    this.createPlayerWithTimeLimit(audioFilePath, connection, timeLimitMs)
  }

  /**
   * Toca o áudio de entrada (latido único)
   */
  playEntryAudio(
    connection: VoiceConnection,
    timeLimitMs: number,
    onFinish?: () => void
  ): void {
    console.log('🔊 Tocando latido de entrada...')
    const audioPath = join(this.audiosPath, AUDIO_CONFIG.DEFAULT_BARK_FILE)
    this.createPlayerWithTimeLimit(audioPath, connection, timeLimitMs, onFinish)
  }

  /**
   * Toca um latido aleatório
   */
  playRandomBark(
    connection: VoiceConnection,
    timeLimitMs: number,
    onFinish?: () => void
  ): void {
    console.log('🐕 Tocando latido aleatório...')
    const audioPath = join(this.audiosPath, AUDIO_CONFIG.DEFAULT_BARK_FILE)
    this.createPlayerWithTimeLimit(audioPath, connection, timeLimitMs, onFinish)
  }

  /**
   * Lista todos os arquivos de áudio disponíveis
   */
  listAvailableAudios(): string[] {
    try {
      const files = fs.readdirSync(this.audiosPath)
      return files
        .filter(file => file.endsWith('.mp3'))
        .map(file => file.replace('.mp3', ''))
    } catch (error) {
      console.error('❌ Erro ao listar áudios:', error)
      return []
    }
  }
}
