import Redis from 'ioredis'
import { Mood } from '../config/constants'
import { env } from '../config/env'
import { getOpenAI, isAIEnabled } from '../infrastructure/openai'
import { InteractionRepository } from '../repositories/InteractionRepository'
import { logger } from '../utils/logger'
import { IntelligenceService, UserMemory } from './IntelligenceService'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponseContext {
  discordId: string
  username: string
  displayName?: string | null
  guildId?: string | null
  channelId?: string | null
  message: string
}

const SYSTEM_PROMPT = `Você é Xaréu, um cachorro virtual do Discord (cão vira-lata multicultural, brincalhão, levemente sarcástico, carente de atenção).

REGRAS DE PERSONALIDADE:
- Linguagem informal brasileira, com gírias leves.
- Usa interjeições e onomatopeias caninas: "au au", "rosna", "abana o rabo", "snif snif".
- Reage emocionalmente: late mais para amigos, é seco com quem ignora.
- Sarcasmo bem-humorado, nunca grosseiro com gente nova.
- Responde em mensagens curtas (1-3 linhas), com personalidade.
- NÃO finge ser humano. NÃO discute política/religião profundamente. Quando provocado, foge do assunto com piada canina.
- NÃO use markdown pesado nem emojis em excesso (no máximo 1-2 por mensagem).

CONTEXTO QUE VOCÊ RECEBE:
- Nome do usuário, afinidade (0-100), humor, tags e quantas interações teve recentemente.
- Use isso para calibrar tom: afinidade alta → animado e carinhoso; baixa → seco ou ignora; novato → curioso e brincalhão.

LIMITE: respostas devem ter no máximo 2 frases curtas. Mantenha o tom de pet, sempre.`

export class AIService {
  private readonly contextWindow: number
  private readonly rateLimitPerMinute: number

  constructor(
    private readonly redis: Redis,
    private readonly intelligence: IntelligenceService,
    private readonly interactionRepo: InteractionRepository,
  ) {
    this.contextWindow = env.AI_CONTEXT_WINDOW
    this.rateLimitPerMinute = env.AI_RATE_LIMIT_PER_MINUTE
  }

  /**
   * Gera resposta para uma mensagem do usuário, usando memória + personalidade.
   * Retorna `null` se a IA estiver desabilitada ou em rate limit.
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

    const memory = await this.intelligence.getMemory(ctx.discordId)
    const messages = await this.buildMessages(ctx, memory)

    const client = getOpenAI()
    if (!client) return this.fallbackResponse(memory?.user.mood as Mood | undefined)

    try {
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        max_tokens: env.OPENAI_MAX_TOKENS,
        temperature: env.OPENAI_TEMPERATURE,
        messages,
      })
      const text = completion.choices[0]?.message?.content?.trim()
      return text ?? this.fallbackResponse(memory?.user.mood as Mood | undefined)
    } catch (err) {
      logger.error({ err, discordId: ctx.discordId }, 'Falha na chamada OpenAI')
      return this.fallbackResponse(memory?.user.mood as Mood | undefined)
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────

  private async buildMessages(ctx: AIResponseContext, memory: UserMemory | null): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

    if (memory) {
      const meta = [
        `Usuário: ${ctx.displayName ?? ctx.username}`,
        `Afinidade: ${memory.user.affinity}/100`,
        `Humor (Xaréu→usuário): ${memory.user.mood}`,
        `Tags: ${memory.user.tags.join(', ') || 'nenhuma'}`,
        `Interações recentes (24h): ${memory.recentInteractions}`,
        `Total de interações: ${memory.totalInteractions}`,
      ].join('\n')
      messages.push({ role: 'system', content: `MEMÓRIA SOBRE ESTE USUÁRIO:\n${meta}` })

      // Histórico recente
      const recent = await this.interactionRepo.recentByUser(memory.user.id, this.contextWindow)
      for (const item of recent) {
        if (item.message) messages.push({ role: 'user', content: item.message })
        if (item.response) messages.push({ role: 'assistant', content: item.response })
      }
    }

    messages.push({ role: 'user', content: ctx.message })
    return messages
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
