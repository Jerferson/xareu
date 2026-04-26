import { PrismaClient, UserQuestion } from '@prisma/client'

export class UserQuestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserQuestion[]> {
    return this.prisma.userQuestion.findMany({
      where: { userId },
      orderBy: { askedAt: 'desc' },
    })
  }

  async hasAsked(userId: string, questionKey: string): Promise<boolean> {
    const found = await this.prisma.userQuestion.findUnique({
      where: { userId_questionKey: { userId, questionKey } },
    })
    return found !== null
  }

  async markAsked(userId: string, questionKey: string): Promise<UserQuestion> {
    return this.prisma.userQuestion.upsert({
      where: { userId_questionKey: { userId, questionKey } },
      create: { userId, questionKey },
      update: { askedAt: new Date(), answeredAt: null },
    })
  }

  /**
   * Marca a pergunta mais recente ainda não respondida como respondida.
   * Usado pelo MemoryExtractionService quando fatos novos são extraídos
   * — a heurística é: se houve fato novo, o user respondeu algo.
   */
  async markLatestUnansweredAsAnswered(userId: string): Promise<UserQuestion | null> {
    const latest = await this.prisma.userQuestion.findFirst({
      where: { userId, answeredAt: null },
      orderBy: { askedAt: 'desc' },
    })
    if (!latest) return null
    return this.prisma.userQuestion.update({
      where: { id: latest.id },
      data: { answeredAt: new Date() },
    })
  }
}
