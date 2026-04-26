import { UserQuestion } from '@prisma/client'
import { QUESTIONS } from '../../../src/config/questions'
import { QuestionService } from '../../../src/services/QuestionService'

describe('QuestionService', () => {
  function build() {
    let asked: UserQuestion[] = []
    const repo = {
      findByUserId: jest.fn(async () => asked),
      hasAsked: jest.fn(),
      markAsked: jest.fn(async (userId: string, key: string) => {
        const item = {
          id: `${userId}-${key}`,
          userId,
          questionKey: key,
          askedAt: new Date(),
          answeredAt: null,
        } as UserQuestion
        asked = [...asked, item]
        return item
      }),
      markLatestUnansweredAsAnswered: jest.fn(),
    }
    return {
      service: new QuestionService(repo as never),
      repo,
      seedAsked: (keys: string[], opts: { ageMs?: number } = {}) => {
        const askedAt = new Date(Date.now() - (opts.ageMs ?? 0))
        asked = keys.map(
          (key) =>
            ({
              id: `seed-${key}`,
              userId: 'u',
              questionKey: key,
              askedAt,
              answeredAt: null,
            }) as UserQuestion,
        )
      },
      seedAnswered: (keys: string[]) => {
        asked = keys.map(
          (key) =>
            ({
              id: `seed-${key}`,
              userId: 'u',
              questionKey: key,
              askedAt: new Date(Date.now() - 60_000),
              answeredAt: new Date(),
            }) as UserQuestion,
        )
      },
    }
  }

  describe('shouldAsk', () => {
    const { service } = build()

    it('pergunta quando facts < 8', () => {
      expect(service.shouldAsk(0, 80)).toBe(true)
      expect(service.shouldAsk(7, 80)).toBe(true)
    })

    it('não pergunta quando facts >= 8 e afinidade >= 50', () => {
      expect(service.shouldAsk(8, 50)).toBe(false)
      expect(service.shouldAsk(20, 100)).toBe(false)
    })

    it('pergunta quando afinidade < 50 mesmo com muitos facts', () => {
      expect(service.shouldAsk(20, 30)).toBe(true)
    })
  })

  describe('pickNext', () => {
    it('retorna pergunta nova quando nenhuma foi feita', async () => {
      const { service } = build()
      const q = await service.pickNext('u')
      expect(q).not.toBeNull()
      expect(QUESTIONS.map((p) => p.key)).toContain(q!.key)
    })

    it('não repete pergunta já feita', async () => {
      const { service, seedAsked } = build()
      const allButOne = QUESTIONS.slice(0, -1).map((q) => q.key)
      seedAsked(allButOne)
      const q = await service.pickNext('u')
      expect(q?.key).toBe(QUESTIONS[QUESTIONS.length - 1].key)
    })

    it('retorna null quando todas foram respondidas', async () => {
      const { service, seedAnswered } = build()
      seedAnswered(QUESTIONS.map((q) => q.key))
      const q = await service.pickNext('u')
      expect(q).toBeNull()
    })

    it('libera pergunta após 24h sem resposta', async () => {
      const { service, seedAsked } = build()
      // marca todas exceto uma como pendentes recentes (bloqueadas)
      const recentKeys = QUESTIONS.slice(0, -1).map((q) => q.key)
      seedAsked(recentKeys, { ageMs: 1_000 })
      // a última fica disponível porque nunca foi feita
      const q = await service.pickNext('u')
      expect(q?.key).toBe(QUESTIONS[QUESTIONS.length - 1].key)
    })

    it('pergunta pendente há > 24h volta a ser candidata', async () => {
      const { service, seedAsked } = build()
      // todas as keys marcadas como pendentes há 25h
      seedAsked(
        QUESTIONS.map((q) => q.key),
        { ageMs: 25 * 60 * 60 * 1000 },
      )
      const q = await service.pickNext('u')
      // não retorna null porque todas vão ter expirado
      expect(q).not.toBeNull()
    })
  })

  describe('resolveNextQuestion', () => {
    it('retorna null e não marca quando shouldAsk é false', async () => {
      const { service, repo } = build()
      const q = await service.resolveNextQuestion({ userId: 'u', factsCount: 20, affinity: 80 })
      expect(q).toBeNull()
      expect(repo.markAsked).not.toHaveBeenCalled()
    })

    it('marca a pergunta quando retorna uma', async () => {
      const { service, repo } = build()
      const q = await service.resolveNextQuestion({ userId: 'u', factsCount: 0, affinity: 20 })
      expect(q).not.toBeNull()
      expect(repo.markAsked).toHaveBeenCalledWith('u', q!.key)
    })
  })
})
