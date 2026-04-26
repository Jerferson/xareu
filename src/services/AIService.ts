import Redis from 'ioredis'
import { z } from 'zod'
import { Mood } from '../config/constants'
import { env } from '../config/env'
import { getOpenAI, isAIEnabled } from '../infrastructure/openai'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { UserFactRepository } from '../repositories/UserFactRepository'
import { logger } from '../utils/logger'
import { ContextBuilderService } from './ContextBuilderService'
import { EmotionEngine } from './EmotionEngine'
import { IntelligenceService } from './IntelligenceService'
import { MemoryExtractionService, inlineInsightSchema } from './MemoryExtractionService'
import { QuestionService } from './QuestionService'

const aiResponseSchema = z.object({
  reply: z.string().min(1).max(2000),
  insight: inlineInsightSchema.nullable().optional(),
})

export interface AIReferencedMessage {
  /** Autor da mensagem que está sendo replicada */
  discordId: string
  username: string
  displayName?: string | null
  /** Conteúdo textual da mensagem replicada */
  content: string
}

export interface AIResponseContext {
  discordId: string
  username: string
  displayName?: string | null
  guildId?: string | null
  channelId?: string | null
  message: string
  /** Se a menção foi feita em reply de outra mensagem, contexto da referenciada */
  referenced?: AIReferencedMessage | null
}

export class AIService {
  private readonly rateLimitPerMinute: number

  constructor(
    private readonly redis: Redis,
    private readonly intelligence: IntelligenceService,
    private readonly emotion: EmotionEngine,
    private readonly contextBuilder: ContextBuilderService,
    private readonly memoryExtraction: MemoryExtractionService,
    private readonly questionService: QuestionService,
    private readonly factRepo: UserFactRepository,
    private readonly guildConfigRepo: GuildConfigRepository,
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

    // Se há mensagem referenciada (reply), resolve memória/emoção do autor original
    const referencedResolved = ctx.referenced ? await this.resolveReferenced(ctx.referenced) : null

    // Decide se anexa uma pergunta de onboarding pra conhecer o user
    const factsCount = (await this.factRepo.findByUserId(memory.user.id, 100)).length
    const nextQuestion = await this.questionService.resolveNextQuestion({
      userId: memory.user.id,
      factsCount,
      affinity: memory.user.affinity,
    })

    // Busca humorLevel da guilda (DM usa default 5)
    const guildConfig = ctx.guildId ? await this.guildConfigRepo.getOrCreate(ctx.guildId) : null
    const humorLevel = guildConfig?.humorLevel ?? 5

    const messages = await this.contextBuilder.build({
      user: memory.user,
      emotion: emotionalContext,
      daysSinceLastInteraction: memory.daysSinceLastInteraction,
      message: ctx.message,
      referenced: referencedResolved,
      pendingQuestion: nextQuestion?.question ?? null,
      humorLevel,
    })

    const client = getOpenAI()
    if (!client) return this.fallbackResponse(memory.user.mood as Mood | string)

    let raw: string | null = null
    try {
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        max_tokens: env.OPENAI_MAX_TOKENS,
        temperature: env.OPENAI_TEMPERATURE,
        response_format: { type: 'json_object' },
        messages,
      })
      raw = completion.choices[0]?.message?.content?.trim() ?? null
    } catch (err) {
      logger.error({ err, discordId: ctx.discordId }, 'Falha na chamada OpenAI')
      return this.fallbackResponse(memory.user.mood as Mood | string)
    }

    if (!raw) return this.fallbackResponse(memory.user.mood as Mood | string)

    // Tenta parsear JSON estruturado { reply, insight? }
    const parsed = this.tryParseStructured(raw)
    const response = parsed?.reply ?? raw // fallback: usa o texto cru como reply

    // Persiste insight inline se a IA retornou algum
    if (parsed?.insight && parsed.insight.new_facts.length > 0) {
      void this.memoryExtraction.persistInline(ctx.discordId, parsed.insight)
    }

    return response
  }

  /**
   * Parseia a saída da IA esperando { reply, insight? }. Retorna null
   * se a saída é puro texto (fallback gracioso — chamamos como reply mesmo).
   */
  private tryParseStructured(raw: string): z.infer<typeof aiResponseSchema> | null {
    try {
      const json = JSON.parse(raw)
      const result = aiResponseSchema.safeParse(json)
      if (!result.success) {
        logger.warn({ issues: result.error.issues }, 'AI response JSON inválido — usando texto cru')
        return null
      }
      return result.data
    } catch {
      logger.warn({ rawPreview: raw.slice(0, 100) }, 'AI response não é JSON — usando texto cru')
      return null
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  private async resolveReferenced(ref: AIReferencedMessage) {
    await this.intelligence.getOrCreateUser({
      discordId: ref.discordId,
      username: ref.username,
      displayName: ref.displayName ?? null,
    })
    const memory = await this.intelligence.getMemory(ref.discordId)
    if (!memory) return null

    const emotion = this.emotion.evaluate({
      affinity: memory.user.affinity,
      mood: memory.user.mood,
      daysSinceLastInteraction: memory.daysSinceLastInteraction,
      recentInteractions: memory.recentInteractions,
    })
    return {
      user: memory.user,
      emotion,
      daysSinceLastInteraction: memory.daysSinceLastInteraction,
      content: ref.content,
    }
  }

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
