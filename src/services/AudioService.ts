import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  VoiceConnection,
} from '@discordjs/voice'
import * as fs from 'fs'
import { extname, join, resolve } from 'path'
import stringSimilarity from 'string-similarity-js'
import { AUDIO_CONFIG } from '../config/constants'
import { logger } from '../utils/logger'

export interface AudioMatch {
  fileName: string
  score: number
}

export class AudioService {
  private readonly audiosPath: string

  constructor(audiosPath?: string) {
    this.audiosPath = audiosPath ?? resolve(process.cwd(), AUDIO_CONFIG.AUDIOS_FOLDER)
  }

  /** Lista nomes (sem extensão) de áudios suportados. */
  listAvailableAudios(): string[] {
    return this.listAudioFiles().map((f) => f.replace(/\.mp3$/i, ''))
  }

  /** Retorna nomes de arquivo (com extensão) suportados. */
  listAudioFiles(): string[] {
    try {
      return fs
        .readdirSync(this.audiosPath)
        .filter((file) =>
          (AUDIO_CONFIG.SUPPORTED_EXTENSIONS as readonly string[]).includes(extname(file).toLowerCase()),
        )
    } catch (err) {
      logger.error({ err, audiosPath: this.audiosPath }, 'Falha ao ler pasta de áudios')
      return []
    }
  }

  /**
   * Busca o áudio mais similar ao termo. Retorna null se não houver candidatos.
   */
  findBestMatch(query: string): AudioMatch | null {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return null

    const files = this.listAudioFiles()
    if (files.length === 0) return null

    const ranked = files
      .map((file): AudioMatch => {
        const stripped = file.replace(/\.mp3$/i, '').toLowerCase()
        const containsBoost = stripped.includes(trimmed) ? 100 : 0
        const score = containsBoost + stringSimilarity(trimmed, stripped)
        return { fileName: file, score }
      })
      .sort((a, b) => b.score - a.score)

    return ranked[0] ?? null
  }

  /** Toca um arquivo (já validado) na conexão atual. Resolve quando termina ou estoura o limite. */
  async playFile(
    connection: VoiceConnection,
    fileName: string,
    timeLimitMs: number,
    volume = 1.0,
  ): Promise<void> {
    const audioPath = join(this.audiosPath, fileName)
    if (!fs.existsSync(audioPath)) {
      logger.warn({ audioPath }, 'Arquivo de áudio não encontrado')
      return
    }

    return new Promise<void>((resolvePromise) => {
      const player: AudioPlayer = createAudioPlayer()
      const resource = createAudioResource(audioPath, { inlineVolume: true })
      resource.volume?.setVolume(volume)

      const cleanup = (): void => {
        clearTimeout(stopTimer)
        player.removeAllListeners()
        try {
          player.stop()
        } catch {
          /* já parado */
        }
      }

      const stopTimer = setTimeout(() => {
        if (player.state.status !== AudioPlayerStatus.Idle) {
          logger.debug({ fileName, timeLimitMs }, 'Áudio interrompido por limite de tempo')
        }
        cleanup()
        resolvePromise()
      }, timeLimitMs)

      player.on(AudioPlayerStatus.Idle, () => {
        cleanup()
        resolvePromise()
      })

      player.on('error', (err) => {
        logger.error({ err, fileName }, 'Erro ao tocar áudio')
        cleanup()
        resolvePromise()
      })

      player.play(resource)
      const subscription = connection.subscribe(player)
      logger.info(
        {
          fileName,
          connStatus: connection.state.status,
          subscribed: Boolean(subscription),
        },
        '🎵 Tocando áudio',
      )
      if (!subscription) {
        logger.warn(
          { fileName, connStatus: connection.state.status },
          '⚠️ connection.subscribe retornou undefined — áudio pode não tocar',
        )
      }
    })
  }
}
