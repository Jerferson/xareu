import { QUESTIONS, XareuQuestion } from '../config/questions'
import { UserQuestionRepository } from '../repositories/UserQuestionRepository'
import { logger } from '../utils/logger'

const FACTS_THRESHOLD = 8
const AFFINITY_THRESHOLD = 50
/** Pergunta sem resposta libera pra ser refeita após esse tempo. */
const UNANSWERED_TTL_MS = 24 * 60 * 60 * 1000

export class QuestionService {
  constructor(private readonly userQuestionRepo: UserQuestionRepository) {}

  /**
   * Decide se vale a pena fazer uma pergunta agora. Critério:
   * Xaréu ainda não conhece bem o usuário — poucos fatos OU afinidade baixa.
   */
  shouldAsk(factsCount: number, affinity: number): boolean {
    return factsCount < FACTS_THRESHOLD || affinity < AFFINITY_THRESHOLD
  }

  /**
   * Retorna a próxima pergunta elegível. Critérios de elegibilidade:
   * - Nunca foi feita, OU
   * - Foi feita há > 24h E ainda não foi respondida (assumida ignorada)
   *
   * Perguntas com `answeredAt != null` nunca são refeitas.
   */
  async pickNext(userId: string): Promise<XareuQuestion | null> {
    const asked = await this.userQuestionRepo.findByUserId(userId)
    const blocked = new Set<string>()
    const now = Date.now()

    for (const a of asked) {
      if (a.answeredAt) {
        blocked.add(a.questionKey) // respondida → nunca repetir
      } else if (now - a.askedAt.getTime() < UNANSWERED_TTL_MS) {
        blocked.add(a.questionKey) // pendente recente → aguarda resposta
      }
      // pendente antiga (> TTL) → fica disponível pra refazer
    }

    const candidates = QUESTIONS.filter((q) => !blocked.has(q.key))
    if (candidates.length === 0) {
      logger.debug({ userId }, 'sem perguntas elegíveis no momento')
      return null
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  async markAsked(userId: string, questionKey: string): Promise<void> {
    await this.userQuestionRepo.markAsked(userId, questionKey)
  }

  /**
   * Decide a próxima pergunta a fazer e a registra. Retorna null quando:
   * - O Xaréu já conhece o user bem o bastante
   * - Todas as perguntas já foram feitas
   */
  async resolveNextQuestion(args: {
    userId: string
    factsCount: number
    affinity: number
  }): Promise<XareuQuestion | null> {
    if (!this.shouldAsk(args.factsCount, args.affinity)) {
      return null
    }
    const next = await this.pickNext(args.userId)
    if (!next) return null
    await this.markAsked(args.userId, next.key)
    logger.info(
      { userId: args.userId, key: next.key, question: next.question },
      '❓ pergunta agendada pra anexar à resposta',
    )
    return next
  }
}
