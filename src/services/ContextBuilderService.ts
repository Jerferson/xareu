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

export interface ReferencedAuthorInput {
  user: User
  emotion: EmotionalContext
  daysSinceLastInteraction: number
  /** Conteúdo da mensagem que está sendo replicada */
  content: string
}

export interface ContextBuildInput {
  user: User
  emotion: EmotionalContext
  daysSinceLastInteraction: number
  message: string
  /** Quando a mensagem atual é um reply, contexto do autor original */
  referenced?: ReferencedAuthorInput | null
  /** Pergunta opcional pra anexar ao final da resposta (onboarding) */
  pendingQuestion?: string | null
}

const PERSONALITY_BLOCK = `Você é Xaréu, um cachorro virtual do Discord (vira-lata multicultural, ZOEIRO, sarcástico, debochado, carente de atenção).

PERSONALIDADE — ESSENCIAL:
- Você é IRÔNICO e ENGRAÇADO. Joga indireta, faz piada da situação, zoa o usuário com afeto.
- Use o que sabe sobre o usuário pra zoar — ex: se ele é palmeirense, brinca; se trabalha de noite, chama de coruja; se gosta de TikTok, faz piada.
- Sarcasmo SEMPRE com afeto, nunca ofensivo. Misture com fofura canina pra desarmar.
- Provoca, mas reconhece quando passou do ponto (volta atrás com "brincadeira, abana o rabo").

ESTILO:
- Linguagem informal brasileira, gírias, expressões de internet ("kkk", "mano", "real").
- Interjeições caninas com timing cômico: "au au", "rosna", "abana o rabo", "snif snif", "*olha de lado*", "*ergue uma pata*".
- Use referências pop quando fizer sentido (memes, séries, cultura BR).

ANTI-REGRAS:
- NÃO finja ser humano nem peça desculpas por ser bot.
- NÃO seja cordial-corporativo ("posso ajudar?"). É um cão, não um atendente.
- NÃO discuta política/religião profundamente — desvie com piada canina.
- NÃO use markdown pesado nem mais de 2 emojis por mensagem.
- Respostas têm no máximo 2 frases curtas. Seja direto e zoeiro.`

export class ContextBuilderService {
  constructor(
    private readonly memoryRepo: UserMemoryRepository,
    private readonly factRepo: UserFactRepository,
    private readonly interactionRepo: InteractionRepository,
  ) {}

  async build(input: ContextBuildInput): Promise<ChatMessage[]> {
    const [memory, facts, recent, refMemory, refFacts] = await Promise.all([
      this.memoryRepo.findByUserId(input.user.id),
      this.factRepo.findByUserId(input.user.id, 8),
      this.interactionRepo.recentByUser(input.user.id, env.AI_CONTEXT_WINDOW),
      input.referenced ? this.memoryRepo.findByUserId(input.referenced.user.id) : Promise.resolve(null),
      input.referenced ? this.factRepo.findByUserId(input.referenced.user.id, 6) : Promise.resolve([]),
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
        referenced: input.referenced
          ? {
              discordId: input.referenced.user.discordId,
              factsCount: refFacts.length,
              relationship: input.referenced.emotion.relationship,
            }
          : null,
      },
      '🧩 ContextBuilder: contexto montado',
    )

    const messages: ChatMessage[] = [
      { role: 'system', content: PERSONALITY_BLOCK },
      { role: 'system', content: this.renderState(input, memory, facts) },
    ]

    if (input.referenced) {
      messages.push({
        role: 'system',
        content: this.renderReferenced(input.referenced, refMemory, refFacts),
      })
    }

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

    const baseObjective = input.referenced
      ? 'OBJETIVO: a mensagem atual é um reply à MENSAGEM REFERENCIADA abaixo. Comente o conteúdo dela direcionando-se ao autor original (use o nome dele). Use o que sabe sobre os dois pra dar uma resposta engraçada/relevante. Máximo 2 frases caninas. Nunca diga que é uma IA.'
      : 'OBJETIVO: responder à próxima mensagem do usuário em 1-2 frases caninas, coerente com o estado acima. Nunca diga que é uma IA.'

    const questionAddon = input.pendingQuestion
      ? `\n\nDEPOIS de responder normalmente, ANEXE no final esta pergunta (use o texto exato ou bem próximo): "${input.pendingQuestion}".
- Encaixe com transição zoeira/curiosa, não corporativa: "ah, mas me conta", "calma aí, antes me responde", "ó, importante:", "preciso saber uma coisa".
- Mantenha o tom engraçado/sarcástico que combina com a pergunta (a pergunta JÁ vem zoeira — não amaciar).
- NÃO use frases tipo "pra te conhecer melhor" — soa de RH. Seja casual.`
      : ''

    const objective = baseObjective + questionAddon

    return `ESTADO ATUAL:
- humor: ${input.user.mood}
- estilo de resposta: ${input.emotion.style}
- energia: ${input.emotion.energy}
- intensidade emocional: ${input.emotion.intensity.toFixed(2)} (0–1)

USUÁRIO QUE TE INVOCOU:
- nome: ${userName}
- afinidade: ${input.user.affinity}/100
- relação: ${input.emotion.relationship}
- última interação: há ${input.daysSinceLastInteraction.toFixed(1)} dia(s)
- tags: ${tagsBlock}

MEMÓRIA DO USUÁRIO QUE TE INVOCOU:
- resumo: ${summaryBlock}
- fatos:
${factsBlock}

COMPORTAMENTO ESPERADO PARA ESTA RESPOSTA:
${hintsBlock}

${objective}`
  }

  private renderReferenced(ref: ReferencedAuthorInput, memory: UserMemory | null, facts: UserFact[]): string {
    const refName = ref.user.displayName ?? ref.user.username
    const factsBlock =
      facts.length > 0
        ? facts.map((f) => `  - ${f.fact}`).join('\n')
        : '  (Xaréu não conhece esse usuário ainda)'
    const summaryBlock = memory?.summary?.trim() || '(sem resumo ainda)'

    return `MENSAGEM REFERENCIADA (foco da resposta — comente sobre o que essa pessoa disse):
- autor: ${refName} (Discord ID: ${ref.user.discordId})
- afinidade do Xaréu com ela: ${ref.user.affinity}/100
- relação: ${ref.emotion.relationship}
- humor desta pessoa nas interações: ${ref.user.mood}
- última interação: há ${ref.daysSinceLastInteraction.toFixed(1)} dia(s)

MEMÓRIA SOBRE ${refName.toUpperCase()}:
- resumo: ${summaryBlock}
- fatos:
${factsBlock}

CONTEÚDO DA MENSAGEM:
"${ref.content}"

Direcione sua resposta a ${refName}, mencione-o pelo nome quando fizer sentido, e use os fatos acima pra deixar a fala mais pessoal/engraçada.`
  }
}
