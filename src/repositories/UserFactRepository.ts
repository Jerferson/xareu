import { PrismaClient, UserFact } from '@prisma/client'

export interface UpsertFactInput {
  userId: string
  fact: string
  confidence: number
}

export class UserFactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string, limit = 20): Promise<UserFact[]> {
    return this.prisma.userFact.findMany({
      where: { userId },
      orderBy: [{ confidence: 'desc' }, { lastSeenAt: 'desc' }],
      take: limit,
    })
  }

  /**
   * Cria fato novo OU atualiza confidence/lastSeenAt se já existir match exato.
   * Dedup por similaridade aproximada fica no service (lower-cased equals).
   */
  async upsertExact(input: UpsertFactInput): Promise<UserFact> {
    const existing = await this.prisma.userFact.findFirst({
      where: { userId: input.userId, fact: input.fact },
    })
    if (existing) {
      return this.prisma.userFact.update({
        where: { id: existing.id },
        data: {
          confidence: Math.min(1, Math.max(existing.confidence, input.confidence)),
          lastSeenAt: new Date(),
        },
      })
    }
    return this.prisma.userFact.create({
      data: {
        userId: input.userId,
        fact: input.fact,
        confidence: input.confidence,
        lastSeenAt: new Date(),
      },
    })
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const result = await this.prisma.userFact.deleteMany({
      where: { lastSeenAt: { lt: cutoff } },
    })
    return result.count
  }

  async deleteForUser(userId: string): Promise<number> {
    const result = await this.prisma.userFact.deleteMany({ where: { userId } })
    return result.count
  }
}
