import { PrismaClient, UserMemory } from '@prisma/client'

export class UserMemoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<UserMemory | null> {
    return this.prisma.userMemory.findUnique({ where: { userId } })
  }

  async upsert(userId: string, summary: string): Promise<UserMemory> {
    return this.prisma.userMemory.upsert({
      where: { userId },
      create: { userId, summary, lastUpdatedAt: new Date() },
      update: { summary, lastUpdatedAt: new Date() },
    })
  }
}
