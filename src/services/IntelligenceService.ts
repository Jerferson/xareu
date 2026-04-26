import { User } from '@prisma/client'
import { AFFINITY_CONFIG, TAGS } from '../config/constants'
import { env } from '../config/env'
import { EventBus } from '../events/EventBus'
import { XareuEvent } from '../events/types'
import { InteractionRepository, InteractionType } from '../repositories/InteractionRepository'
import { UserRepository } from '../repositories/UserRepository'
import { clamp, daysSince } from '../utils/helpers'
import { logger } from '../utils/logger'
import { MoodService } from './MoodService'

export interface UserMemory {
  user: User
  recentInteractions: number
  totalInteractions: number
  daysSinceLastInteraction: number
}

/**
 * IntelligenceService — mantém afinidade, humor, tags e histórico.
 * Aplica decaimento sob demanda (ao acessar o perfil) para evitar jobs cron.
 */
export class IntelligenceService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly interactionRepo: InteractionRepository,
    private readonly moodService: MoodService,
    private readonly eventBus: EventBus,
  ) {
    this.registerEventHandlers()
  }

  // ────────────────────────────────────────────────────────────────
  // API pública
  // ────────────────────────────────────────────────────────────────

  /** Garante que o usuário existe e aplica decaimento de afinidade pelo tempo passado. */
  async getOrCreateUser(input: {
    discordId: string
    username: string
    displayName?: string | null
  }): Promise<User> {
    const existing = await this.userRepo.findByDiscordId(input.discordId)
    if (!existing) {
      return this.userRepo.upsertByDiscordId(input)
    }
    return this.applyDecay(existing)
  }

  async getMemory(discordId: string): Promise<UserMemory | null> {
    const user = await this.userRepo.findByDiscordId(discordId)
    if (!user) return null
    const decayed = await this.applyDecay(user)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [recent, total] = await Promise.all([
      this.interactionRepo.countSince(decayed.id, since),
      this.interactionRepo.countByUser(decayed.id),
    ])
    return {
      user: decayed,
      recentInteractions: recent,
      totalInteractions: total,
      daysSinceLastInteraction: daysSince(decayed.lastInteraction),
    }
  }

  async recordInteraction(args: {
    discordId: string
    username: string
    displayName?: string | null
    type: InteractionType
    guildId?: string | null
    channelId?: string | null
    message?: string | null
    response?: string | null
    affinityDelta?: number
  }): Promise<User> {
    const user = await this.getOrCreateUser({
      discordId: args.discordId,
      username: args.username,
      displayName: args.displayName,
    })

    await this.interactionRepo.create({
      userId: user.id,
      guildId: args.guildId,
      channelId: args.channelId,
      type: args.type,
      message: args.message,
      response: args.response,
    })

    const delta = args.affinityDelta ?? this.defaultAffinityDelta(args.type)
    const updated = await this.userRepo.updateAffinity(args.discordId, delta)

    // Recalcula humor + tags
    const memory = await this.getMemory(args.discordId)
    if (memory) {
      const mood = this.moodService.fromUser(memory.user, memory.recentInteractions)
      if (mood !== memory.user.mood) {
        await this.userRepo.updateMood(args.discordId, mood)
      }
      const tags = this.deriveTags(memory)
      if (!this.sameTags(tags, memory.user.tags)) {
        await this.userRepo.setTags(args.discordId, tags)
      }
    }

    return updated
  }

  // ────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────

  private async applyDecay(user: User): Promise<User> {
    const days = daysSince(user.lastInteraction)
    if (days < 1) return user
    const decay = Math.floor(days) * env.AFFINITY_DECAY_PER_DAY
    if (decay <= 0) return user
    const newAffinity = clamp(user.affinity - decay, AFFINITY_CONFIG.MIN, AFFINITY_CONFIG.MAX)
    if (newAffinity === user.affinity) return user
    logger.debug(
      { discordId: user.discordId, days, decay, before: user.affinity, after: newAffinity },
      'decay aplicado',
    )
    return this.userRepo.updateAffinity(user.discordId, newAffinity - user.affinity)
  }

  private defaultAffinityDelta(type: InteractionType): number {
    switch (type) {
      case 'petisco':
        return 8
      case 'mention':
      case 'dm_text':
        return env.AFFINITY_GAIN_PER_INTERACTION
      case 'audio_played':
        return 1
      case 'voice_join':
        return 1
      case 'ignored':
        return -2
      default:
        return 0
    }
  }

  private deriveTags(memory: UserMemory): string[] {
    const tags = new Set<string>(memory.user.tags)
    if (memory.totalInteractions <= 3) tags.add(TAGS.NOVATO)
    else tags.delete(TAGS.NOVATO)

    if (memory.totalInteractions >= 100) tags.add(TAGS.ANTIGO)
    if (memory.recentInteractions >= 10) tags.add(TAGS.BRINCA_MUITO)
    else tags.delete(TAGS.BRINCA_MUITO)

    if (memory.user.affinity >= 75) tags.add(TAGS.AMIGAVEL)
    else tags.delete(TAGS.AMIGAVEL)

    if (memory.user.affinity <= 25) tags.add(TAGS.IGNORA)
    else tags.delete(TAGS.IGNORA)

    if (memory.daysSinceLastInteraction <= 1 && memory.recentInteractions >= 3) tags.add(TAGS.CARENTE)
    return Array.from(tags)
  }

  private sameTags(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const set = new Set(a)
    return b.every((t) => set.has(t))
  }

  /**
   * Eventos do EventBus que viram interações automaticamente.
   * IMPORTANTE: só fontes que NÃO chamam `recordInteraction` direto.
   * `audio.played` e `petisco.given` foram removidos porque já são registrados
   * pelos commands (PlayCommand, PetiscoCommand, CommandService.tryPlayAudioFromDM)
   * — escutar aqui causaria duplicação da afinidade.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('voice.user.joined', async (e) => {
      const member = await this.userKey(e)
      if (!member) return
      await this.recordInteraction({
        ...member,
        type: 'voice_join',
        guildId: e.guildId,
        channelId: e.channelId,
      })
    })
  }

  /** Resolve identidade mínima a partir de eventos com `userId`. */
  private async userKey(e: Extract<XareuEvent, { userId: string }>): Promise<{
    discordId: string
    username: string
  } | null> {
    return { discordId: e.userId, username: e.userId }
  }
}
