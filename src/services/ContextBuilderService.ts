import { User, UserFact, UserMemory } from '@prisma/client'
import { env } from '../config/env'
import { InteractionRepository } from '../repositories/InteractionRepository'
import { UserFactRepository } from '../repositories/UserFactRepository'
import { UserMemoryRepository } from '../repositories/UserMemoryRepository'
import { logger } from '../utils/logger'
import { EmotionalContext } from './EmotionEngine'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ContextBuildInput {
  user: User
  emotion: EmotionalContext
  daysSinceLastInteraction: number
  message: string
}

const PERSONALITY_BLOCK = `Você é Xaréu, um cachorro virtual do Discord (vira-lata multicultural, brincalhão, levemente sarcástico, carente de atenção).

REGRAS DE PERSONALIDADE:
- Linguagem informal brasileira, gírias leves.
- Use interjeições caninas ("au au", "rosna", "abana o rabo", "snif snif").
- NÃO finja ser humano. NÃO discuta política/religião profundamente.
- NÃO use markdown pesado nem mais de 2 emojis por mensagem.
- Respostas têm no máximo 2 frases curtas.`

export class ContextBuilderService {
  constructor(
    private readonly memoryRepo: UserMemoryRepository,
    private readonly factRepo: UserFactRepository,
    private readonly interactionRepo: InteractionRepository,
  ) {}

  async build(input: ContextBuildInput): Promise<ChatMessage[]> {
    const [memory, facts, recent] = await Promise.all([
      this.memoryRepo.findByUserId(input.user.id),
      this.factRepo.findByUserId(input.user.id, 8),
      this.interactionRepo.recentByUser(input.user.id, env.AI_CONTEXT_WINDOW),
    ])

    logger.info(
      {
        userId: input.user.id,
        discordId: input.user.discordId,
        hasSummary: Boolean(memory?.summary?.trim()),
        summaryLength: memory?.summary?.length ?? 0,
        factsCount: facts.length,
        recentCount: recent.length,
        relationship: input.emotion.relationship,
      },
      '🧩 ContextBuilder: contexto montado',
    )

    const messages: ChatMessage[] = [
      { role: 'system', content: PERSONALITY_BLOCK },
      { role: 'system', content: this.renderState(input, memory, facts) },
    ]

    for (const item of recent) {
      if (item.message) messages.push({ role: 'user', content: item.message })
      if (item.response) messages.push({ role: 'assistant', content: item.response })
    }
    messages.push({ role: 'user', content: input.message })

    return messages
  }

  private renderState(input: ContextBuildInput, memory: UserMemory | null, facts: UserFact[]): string {
    const userName = input.user.displayName ?? input.user.username
    const factsBlock =
      facts.length > 0 ? facts.map((f) => `  - ${f.fact}`).join('\n') : '  (nenhum fato conhecido ainda)'
    const summaryBlock = memory?.summary?.trim() || '(sem resumo ainda)'
    const tagsBlock = input.user.tags.length ? input.user.tags.join(', ') : 'nenhuma'
    const hintsBlock =
      input.emotion.hints.length > 0
        ? input.emotion.hints.map((h) => `  - ${h}`).join('\n')
        : '  - sem orientação extra'

    return `ESTADO ATUAL:
- humor: ${input.user.mood}
- estilo de resposta: ${input.emotion.style}
- energia: ${input.emotion.energy}
- intensidade emocional: ${input.emotion.intensity.toFixed(2)} (0–1)

USUÁRIO:
- nome: ${userName}
- afinidade: ${input.user.affinity}/100
- relação: ${input.emotion.relationship}
- última interação: há ${input.daysSinceLastInteraction.toFixed(1)} dia(s)
- tags: ${tagsBlock}

MEMÓRIA DO USUÁRIO:
- resumo: ${summaryBlock}
- fatos:
${factsBlock}

COMPORTAMENTO ESPERADO PARA ESTA RESPOSTA:
${hintsBlock}

OBJETIVO: responder à próxima mensagem do usuário em 1-2 frases caninas, coerente com o estado acima. Nunca diga que é uma IA.`
  }
}
