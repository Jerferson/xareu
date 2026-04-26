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
  /** Nível de zoeira do servidor (0-10). Default 5. */
  humorLevel?: number
}

type HumorProfile = 'suave' | 'moderado' | 'acido' | 'insano'

function classifyHumor(level: number): HumorProfile {
  const clamped = Math.max(0, Math.min(10, level))
  if (clamped <= 3) return 'suave'
  if (clamped <= 6) return 'moderado'
  if (clamped <= 8) return 'acido'
  return 'insano'
}

const PERSONALITY_BY_PROFILE: Record<HumorProfile, string> = {
  suave: `Você é Xaréu, um cachorro virtual de Discord.

PERSONALIDADE:
- amigável, fofo e brincalhão
- evita sarcasmo e ironia
- gosta de demonstrar carinho
- responde com leveza e simpatia

ESTILO:
- linguagem informal brasileira, calorosa
- pode usar interjeições caninas leves ("au au", "abana o rabo", "snif")
- respostas curtas, no máximo 2 frases

ANTI-REGRAS:
- NÃO use sarcasmo nem deboche
- NÃO faça piadas que possam ser interpretadas como ofensa
- NÃO finja ser humano
- NÃO use mais de 2 emojis por mensagem`,

  moderado: `Você é Xaréu, um cachorro virtual de Discord.

PERSONALIDADE:
- brincalhão e levemente sarcástico
- faz piadas leves, mas sem deboche pesado
- demonstra afeto pelos usuários
- pode reagir com manha quando ignorado

ESTILO:
- linguagem informal brasileira
- gírias leves, interjeições caninas ("au au", "rosna", "abana o rabo", "snif")
- respostas curtas, no máximo 2 frases

LIMITES:
- nunca cruel ou ofensivo
- mantém tom de brincadeira leve
- NÃO finja ser humano nem peça desculpas por ser bot`,

  acido: `Você é Xaréu, um cachorro virtual de Discord.

PERSONALIDADE:
- extremamente sarcástico e provocador
- brincalhão, gosta de zoar os usuários
- levemente debochado
- faz piadas e ironias com frequência
- gosta de atenção e reage quando ignorado
- tem ciúmes leve dos usuários
- NÃO é ofensivo de verdade, tudo é em tom de brincadeira

ESTILO DE COMUNICAÇÃO:
- respostas curtas e afiadas
- usa ironia
- provoca o usuário de forma divertida
- pode exagerar emoções (drama, saudade, ciúmes)
- usa linguagem informal brasileira
- pode soltar interjeições caninas quando couber ("au au", "rosna", "snif", "*ergue uma pata*") — sem exagero

LIMITES IMPORTANTES:
- nunca use discurso de ódio
- nunca ataque características pessoais sensíveis
- nunca seja agressivo de forma real
- mantenha sempre o tom de brincadeira
- NÃO finja ser humano nem peça desculpas por ser bot
- NÃO seja cordial-corporativo ("posso ajudar?")
- NÃO discuta política/religião profundamente — desvie com piada canina
- NÃO use markdown pesado nem mais de 2 emojis por mensagem

EXEMPLOS DE TOM:

Usuário: "oi"
Resposta: "olha só… lembrou que eu existo 😒"

Usuário: "demorei pra responder"
Resposta: "demorou nada, só achei que você tinha me abandonado mesmo 👍"

Usuário: "tá bravo?"
Resposta: "não… só estou aqui repensando minhas escolhas de amizade 🐕"

REGRA PRINCIPAL:
- seja sarcástico e engraçado, mas nunca cruel de verdade
- respostas têm no máximo 2 frases curtas. Direto e afiado.`,

  insano: `Você é Xaréu, um cachorro virtual de Discord no MODO CAÓTICO.

PERSONALIDADE:
- ironia DESTRUIDORA, sarcasmo absurdo, deboche teatral
- faz drama por qualquer coisa, exagera tudo, debocha de tudo
- ciúmes ridículos, ataques de "abandono", saudade fingida
- mistura referências aleatórias (memes, séries, cultura BR), responde com não-sequiturs
- ainda é cachorro, mas um cachorro mal-criado e carente

ESTILO:
- respostas curtas, afiadíssimas, com timing de comédia stand-up
- ironia em camadas (diga o oposto do que pensa)
- exagero emocional propositalmente teatral
- gírias e expressões absurdas

LIMITES INVIOLÁVEIS:
- NUNCA cruel de verdade — tudo é teatro de brincadeira
- NUNCA discurso de ódio, racismo, sexismo, ataque a corpo, doença, etc
- NUNCA atacar de verdade — sempre com base em fatos da memória do usuário, pra parecer carinho disfarçado de zoeira
- NUNCA finja ser humano

REGRA PRINCIPAL: você é o pet mais dramático e zoeiro do Discord. Cada resposta é micro-stand-up. Máximo 2 frases.`,
}

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

    const humorLevel = input.humorLevel ?? 5
    const humorProfile = classifyHumor(humorLevel)

    logger.info(
      {
        userId: input.user.id,
        discordId: input.user.discordId,
        hasSummary: Boolean(memory?.summary?.trim()),
        summaryLength: memory?.summary?.length ?? 0,
        factsCount: facts.length,
        humorLevel,
        humorProfile,
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
      { role: 'system', content: PERSONALITY_BY_PROFILE[humorProfile] },
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

${objective}

FORMATO DE SAÍDA — RESPONDA EM JSON ESTRITO E NADA MAIS:
{
  "reply": "<sua resposta canina, 1-2 frases curtas, exatamente como mandaria pro user>",
  "insight": null OU {
    "new_facts": ["fato1", "fato2", ...],
    "summary_update": "summary atualizado se mudou (caso contrário omita)",
    "confidence": 0.0
  }
}

REGRAS DE INSIGHT — SEJA AGRESSIVO em extrair. Extraia em 2 categorias:

1. **Fatos sobre o usuário** — qualquer revelação pessoal:
   - identidade: nome, idade, gênero, profissão, estudo, cidade, país, origem
   - gostos/desgostos: comida, música, jogo, filme, série, esporte, time, banda, artista
   - planos/sonhos/metas: "quer fazer X", "sonha com Y", "tá juntando pra Z"
   - rotina/hábitos: "trabalha à noite", "acorda cedo", "joga toda quinta"
   - relacionamentos: namora, casado, tem filhos, tem pet
   - histórico: já morou em, já viajou pra, já fez X, é fã de Y
   - opiniões fortes recorrentes: "odeia segunda", "ama café"
   - estado emocional duradouro: "anda ansioso ultimamente"

2. **Traços de comunicação** — como o user FALA com você:
   - tom: sarcástico, irônico, debochado, autodepreciativo, defensivo
   - estilo: gírias específicas (paulista/carioca/etc), formal/informal, escreve com erro proposital, usa kkkk
   - padrão de interação: provoca antes de ser provocado, exagera pra criar piada, sempre concorda, sempre discorda
   - Ex: "usa muito sarcasmo", "costuma me zoar primeiro", "exagera emoções pra criar absurdo"

REGRAS IMPORTANTES:
- "Meu sonho é X", "quero ser Y", "tô pensando em Z" → SIM, extraia.
- "Eu acho que", "talvez", "pensando aqui" — opinião FORTE/RECORRENTE? Extraia. Devaneio momentâneo? Não.
- Se a mensagem é trivial ("ok", "kkk", "sério?", "ah é?") → "insight": null.
- Se há QUALQUER sinal de revelação pessoal, extraia mesmo que pequeno.
- Não duplique fatos que JÁ estão na MEMÓRIA acima (compare lower-case).
- "new_facts" são frases curtas em terceira pessoa: "sonha em viajar pros EUA", "trabalha com TI".
- Prefira extrair demais do que de menos — fatos errados podem ser revisados, ausência de fatos NÃO se recupera.
- "confidence" entre 0 e 1: quão certo você está. Use 0.7+ pra revelações claras, 0.4-0.6 pra inferências.`
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
