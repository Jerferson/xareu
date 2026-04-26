import Redis from 'ioredis'
import { Mood } from '../config/constants'
import { env } from '../config/env'
import { getOpenAI, isAIEnabled } from '../infrastructure/openai'
import { logger } from '../utils/logger'
import { ContextBuilderService } from './ContextBuilderService'
import { EmotionEngine } from './EmotionEngine'
import { IntelligenceService } from './IntelligenceService'
import { MemoryExtractionService } from './MemoryExtractionService'

export interface AIResponseContext {
  discordId: string
  username: string
  displayName?: string | null
  guildId?: string | null
  channelId?: string | null
  message: string
}

export class AIService {
  private readonly rateLimitPerMinute: number

  constructor(
    private readonly redis: Redis,
    private readonly intelligence: IntelligenceService,
    private readonly emotion: EmotionEngine,
    private readonly contextBuilder: ContextBuilderService,
    private readonly memoryExtraction: MemoryExtractionService,
  ) {
    this.rateLimitPerMinute = env.AI_RATE_LIMIT_PER_MINUTE
  }

  /**
   * Gera resposta para uma mensagem do usuário, usando memória + personalidade.
   * Retorna `null` se a IA estiver desabilitada ou em rate limit.
   * Após responder, dispara extração de memória em background (fire-and-forget).
   */
  async respond(ctx: AIResponseContext): Promise<string | null> {
    if (!isAIEnabled()) {
      return this.fallbackResponse('neutro')
    }

    const allowed = await this.checkRateLimit(ctx.discordId)
    if (!allowed) {
      logger.debug({ discordId: ctx.discordId }, 'rate limit atingido')
      return 'au au... (Xaréu tá ofegante, espera um pouquinho)'
    }

    // Garante que o user existe e aplica decay antes de calcular emoção
    await this.intelligence.getOrCreateUser({
      discordId: ctx.discordId,
      username: ctx.username,
      displayName: ctx.displayName ?? null,
    })

    const memory = await this.intelligence.getMemory(ctx.discordId)
    if (!memory) {
      return this.fallbackResponse('neutro')
    }

    const emotionalContext = this.emotion.evaluate({
      affinity: memory.user.affinity,
      mood: memory.user.mood,
      daysSinceLastInteraction: memory.daysSinceLastInteraction,
      recentInteractions: memory.recentInteractions,
    })

    const messages = await this.contextBuilder.build({
      user: memory.user,
      emotion: emotionalContext,
      daysSinceLastInteraction: memory.daysSinceLastInteraction,
      message: ctx.message,
    })

    const client = getOpenAI()
    if (!client) return this.fallbackResponse(memory.user.mood as Mood | string)

    let text: string | null = null
    try {
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        max_tokens: env.OPENAI_MAX_TOKENS,
        temperature: env.OPENAI_TEMPERATURE,
        messages,
      })
      text = completion.choices[0]?.message?.content?.trim() ?? null
    } catch (err) {
      logger.error({ err, discordId: ctx.discordId }, 'Falha na chamada OpenAI')
      return this.fallbackResponse(memory.user.mood as Mood | string)
    }

    const response = text ?? this.fallbackResponse(memory.user.mood as Mood | string)

    // Fire-and-forget: extrai memória em background sem bloquear a resposta
    void this.memoryExtraction.process({
      discordId: ctx.discordId,
      message: ctx.message,
      response,
    })

    return response
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  private async checkRateLimit(discordId: string): Promise<boolean> {
    const key = `xareu:ratelimit:${discordId}`
    try {
      const count = await this.redis.incr(key)
      if (count === 1) await this.redis.expire(key, 60)
      return count <= this.rateLimitPerMinute
    } catch (err) {
      logger.warn({ err }, 'Rate limit indisponível, liberando')
      return true
    }
  }

  private fallbackResponse(mood?: Mood | string): string {
    const responses: Record<string, string[]> = {
      feliz: ['au au! que bom te ver! 🐾', 'abana o rabo todo'],
      animado: ['AU AU AU AU!! 🐕', 'pula em cima de você'],
      carente: ['snif snif... cadê você?', 'manhoso, deita do seu lado'],
      bravo: ['rrrrr...', 'olha pro lado e ignora'],
      dormindo: ['zzzz...', 'ronca baixinho'],
      neutro: ['au.', 'cheira a tela'],
    }
    const list = responses[mood ?? 'neutro'] ?? responses.neutro
    return list[Math.floor(Math.random() * list.length)]
  }
}
