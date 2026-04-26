import { z } from 'zod'
import { env } from '../config/env'
import { getOpenAI, isAIEnabled } from '../infrastructure/openai'
import { InteractionRepository } from '../repositories/InteractionRepository'
import { UserFactRepository } from '../repositories/UserFactRepository'
import { UserMemoryRepository } from '../repositories/UserMemoryRepository'
import { UserQuestionRepository } from '../repositories/UserQuestionRepository'
import { UserRepository } from '../repositories/UserRepository'
import { logger } from '../utils/logger'

const extractionSchema = z.object({
  new_facts: z.array(z.string().min(2).max(200)).max(8),
  updated_summary: z.string().max(800),
  confidence: z.number().min(0).max(1),
})

/**
 * Insight inline retornado pela IA junto da resposta principal.
 * `summary_update` é opcional — pode ser omitido quando não há mudança.
 */
export const inlineInsightSchema = z.object({
  new_facts: z.array(z.string().min(2).max(200)).max(8).default([]),
  summary_update: z.string().max(800).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
})

export type InlineInsight = z.infer<typeof inlineInsightSchema>

/**
 * Padrões de auto-revelação. Cada padrão é uma regex com `\b` pra casar
 * palavras inteiras — assim "eu também gosto" cai em "gosto", e a gente
 * não pega "gostoso" por engano.
 */
const SELF_REVELATION_PATTERNS: RegExp[] = [
  /\b(gosto|gosta)\b/i,
  /\b(adoro|adora)\b/i,
  /\b(odeio|odeia)\b/i,
  /\b(prefiro|prefere)\b/i,
  /\b(amo|ama)\b/i,
  /\btrabalh(o|a|ei|amos)\b/i,
  /\bmor(o|a|ei|amos)\b/i,
  /\bestud(o|a|ei|amos|ando)\b/i,
  /\bjog(o|a|uei|amos)\b/i,
  /\bsou\b/i, // "sou de SP", "sou fã", "sou palmeirense"
  /\btenho\b/i, // "tenho 30 anos", "tenho 2 cachorros"
  /\bcresci\b/i,
  /\b(meu|minha) (nome|vida|trabalho|time|rotina|cidade|profiss[ãa]o|hobby)\b/i,
  /\b(curso|profiss[ãa]o)\b/i,
  /\bnasci\b/i,
] as const

const SYSTEM_PROMPT = `Você extrai memória sobre um usuário do Discord a partir de mensagens dele pra um bot pet (Xaréu).

REGRAS DE EXTRAÇÃO:
- Foque em fatos DURADOUROS (gostos, hábitos, profissão, contexto de vida).
- Ignore fatos triviais ("estou comendo agora", "tô com frio") ou opiniões momentâneas.
- Cada fato deve ser uma frase curta em terceira pessoa: "gosta de futebol", "trabalha com TI".
- Atualize o summary de forma INCREMENTAL — preserve o que já existe, adicione/refine.
- O summary tem no máximo 600 caracteres, conciso, em português.
- new_facts pode estar vazio se não houver nada novo.
- confidence: quão certo você está dos fatos extraídos (0–1).

OUTPUT: APENAS JSON válido no formato exato:
{
  "new_facts": ["fato 1", "fato 2"],
  "updated_summary": "texto consolidado curto",
  "confidence": 0.0
}`

export interface ExtractionContext {
  discordId: string
  message: string
  response: string
}

const FACTS_LIMIT_FOR_PROMPT = 12
const HISTORY_LIMIT_FOR_PROMPT = 8

export class MemoryExtractionService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly memoryRepo: UserMemoryRepository,
    private readonly factRepo: UserFactRepository,
    private readonly interactionRepo: InteractionRepository,
    private readonly questionRepo: UserQuestionRepository,
  ) {}

  /**
   * Heurística: vale chamar OpenAI pra extrair? Decide ANTES de gastar tokens.
   */
  shouldExtract(message: string): boolean {
    const trimmed = message.trim()
    if (trimmed.length < 25) return false
    const wordCount = trimmed.split(/\s+/).length
    if (wordCount < 5) return false
    return SELF_REVELATION_PATTERNS.some((pattern) => pattern.test(trimmed))
  }

  /**
   * Pipeline completo: decide se extrai, chama OpenAI, valida, persiste.
   * Fire-and-forget — nunca lança.
   */
  async process(ctx: ExtractionContext): Promise<void> {
    try {
      if (!isAIEnabled()) return
      if (!this.shouldExtract(ctx.message)) return

      const user = await this.userRepo.findByDiscordId(ctx.discordId)
      if (!user) return

      const [memory, facts, recent] = await Promise.all([
        this.memoryRepo.findByUserId(user.id),
        this.factRepo.findByUserId(user.id, FACTS_LIMIT_FOR_PROMPT),
        this.interactionRepo.recentByUser(user.id, HISTORY_LIMIT_FOR_PROMPT),
      ])

      const userPayload = {
        message: ctx.message,
        bot_response: ctx.response,
        current_summary: memory?.summary ?? '',
        known_facts: facts.map((f) => f.fact),
        recent_history: recent.filter((i) => i.message).map((i) => ({ user: i.message, bot: i.response })),
      }

      const client = getOpenAI()
      if (!client) return

      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      })

      const raw = completion.choices[0]?.message?.content?.trim()
      if (!raw) return

      const parsed = extractionSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        logger.warn({ issues: parsed.error.issues, raw }, 'extraction JSON inválido')
        return
      }

      await this.persist(
        user.id,
        parsed.data,
        facts.map((f) => f.fact),
      )
      logger.info(
        {
          discordId: ctx.discordId,
          newFacts: parsed.data.new_facts.length,
          confidence: parsed.data.confidence,
        },
        '🧠 memory extracted',
      )
    } catch (err) {
      logger.error({ err, discordId: ctx.discordId }, 'falha ao extrair memória')
    }
  }

  /**
   * Persiste um insight extraído inline pela própria chamada de IA da resposta
   * (sem fazer outra chamada OpenAI). Faz dedup contra fatos existentes e
   * marca a última pergunta pendente como respondida quando há fato novo.
   */
  async persistInline(discordId: string, insight: InlineInsight): Promise<void> {
    try {
      const user = await this.userRepo.findByDiscordId(discordId)
      if (!user) return
      const knownFacts = (await this.factRepo.findByUserId(user.id, 100)).map((f) => f.fact)
      const currentSummary = (await this.memoryRepo.findByUserId(user.id))?.summary ?? ''
      // Só sobrescreve summary se a IA retornou algo NÃO-VAZIO. Caso contrário
      // mantém o que já tinha (evita zerar memória quando a IA omite o campo).
      const newSummary = insight.summary_update?.trim()
      const finalSummary = newSummary && newSummary.length > 0 ? newSummary : currentSummary
      await this.persist(
        user.id,
        {
          new_facts: insight.new_facts,
          updated_summary: finalSummary,
          confidence: insight.confidence,
        },
        knownFacts,
      )
      if (insight.new_facts.length > 0) {
        logger.info(
          { discordId, newFacts: insight.new_facts.length, confidence: insight.confidence },
          '🧠 inline insight persisted',
        )
      }
    } catch (err) {
      logger.error({ err, discordId }, 'falha ao persistir inline insight')
    }
  }

  private async persist(
    userId: string,
    extraction: z.infer<typeof extractionSchema>,
    knownFacts: string[],
  ): Promise<void> {
    const known = new Set(knownFacts.map((f) => f.toLowerCase().trim()))
    const newOnes = extraction.new_facts
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
      .filter((f) => !known.has(f.toLowerCase()))

    await Promise.all([
      ...newOnes.map((fact) =>
        this.factRepo.upsertExact({ userId, fact, confidence: extraction.confidence }),
      ),
      this.memoryRepo.upsert(userId, extraction.updated_summary),
    ])

    // Heurística: se a extração produziu fatos novos, considera que a
    // pergunta pendente mais recente foi respondida.
    if (newOnes.length > 0) {
      const answered = await this.questionRepo.markLatestUnansweredAsAnswered(userId)
      if (answered) {
        logger.info(
          { userId, questionKey: answered.questionKey },
          '✅ pergunta marcada como respondida (fato novo extraído)',
        )
      }
    }
  }
}
