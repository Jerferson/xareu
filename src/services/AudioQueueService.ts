import { VoiceConnection } from '@discordjs/voice'
import { AudioService } from './AudioService'
import { logger } from '../utils/logger'
import { BOT_CONFIG } from '../config/constants'

interface QueueItem {
  fileName: string
  guildId: string
  volume: number
}

/**
 * Serializa a reprodução de áudio por guilda e enforça cooldown por usuário.
 * Evita spam quando múltiplos comandos chegam ao mesmo tempo.
 */
export class AudioQueueService {
  private readonly queues = new Map<string, QueueItem[]>()
  private readonly running = new Set<string>()
  private readonly userCooldownExpiresAt = new Map<string, number>()

  constructor(private readonly audioService: AudioService) {}

  /**
   * Tenta enfileirar um áudio. Retorna `false` se o usuário ainda está em cooldown.
   */
  enqueue(args: {
    guildId: string
    userId: string
    fileName: string
    cooldownSeconds: number
    volume?: number
    connection: VoiceConnection
  }): { ok: boolean; cooldownRemaining?: number } {
    const cooldownMs = args.cooldownSeconds * 1000
    const cooldownKey = `${args.guildId}:${args.userId}`
    const now = Date.now()
    const expiresAt = this.userCooldownExpiresAt.get(cooldownKey) ?? 0

    if (cooldownMs > 0 && now < expiresAt) {
      const remaining = Math.ceil((expiresAt - now) / 1000)
      logger.info(
        { guildId: args.guildId, userId: args.userId, fileName: args.fileName, remaining },
        '⏳ enqueue rejeitado por cooldown',
      )
      return { ok: false, cooldownRemaining: remaining }
    }

    if (cooldownMs > 0) {
      this.userCooldownExpiresAt.set(cooldownKey, now + cooldownMs)
    }

    const queue = this.queues.get(args.guildId) ?? []
    queue.push({ fileName: args.fileName, guildId: args.guildId, volume: args.volume ?? 1.0 })
    this.queues.set(args.guildId, queue)
    logger.info(
      { guildId: args.guildId, userId: args.userId, fileName: args.fileName, queueSize: queue.length },
      '📥 enqueue OK',
    )

    void this.drain(args.guildId, args.connection)
    return { ok: true }
  }

  /** Reprodução direta sem cooldown — uso interno do bot (latido de entrada, etc). */
  async playInternal(
    connection: VoiceConnection,
    guildId: string,
    fileName: string,
    volume = 1.0,
  ): Promise<void> {
    const queue = this.queues.get(guildId) ?? []
    queue.push({ fileName, guildId, volume })
    this.queues.set(guildId, queue)
    logger.debug({ guildId, fileName, queueSize: queue.length }, '📥 playInternal enfileirou')
    await this.drain(guildId, connection)
  }

  clearGuild(guildId: string): void {
    this.queues.delete(guildId)
  }

  private async drain(guildId: string, connection: VoiceConnection): Promise<void> {
    if (this.running.has(guildId)) {
      logger.debug({ guildId }, '🔄 drain já rodando, item esperando na fila')
      return
    }
    this.running.add(guildId)
    logger.debug({ guildId }, '▶️ drain iniciou')

    try {
      const queue = this.queues.get(guildId) ?? []
      while (queue.length > 0) {
        const next = queue.shift()
        if (!next) break
        const connStatus = connection.state?.status
        logger.info(
          { guildId, fileName: next.fileName, connStatus, remaining: queue.length },
          '🎶 drain processando item',
        )
        try {
          await this.audioService.playFile(
            connection,
            next.fileName,
            BOT_CONFIG.AUDIO_TIME_LIMIT_MS,
            next.volume,
          )
        } catch (err) {
          logger.error({ err, fileName: next.fileName }, 'Erro ao processar item da fila')
        }
      }
      this.queues.delete(guildId)
      logger.debug({ guildId }, '✔️ drain finalizou (fila vazia)')
    } finally {
      this.running.delete(guildId)
    }
  }
}
