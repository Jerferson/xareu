import { PrismaClient, User } from '@prisma/client'
import { AFFINITY_CONFIG } from '../config/constants'
import { clamp } from '../utils/helpers'

export interface UpsertUserInput {
  discordId: string
  username: string
  displayName?: string | null
}

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertByDiscordId(input: UpsertUserInput): Promise<User> {
    return this.prisma.user.upsert({
      where: { discordId: input.discordId },
      create: {
        discordId: input.discordId,
        username: input.username,
        displayName: input.displayName ?? null,
      },
      update: {
        username: input.username,
        displayName: input.displayName ?? null,
      },
    })
  }

  async findByDiscordId(discordId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { discordId } })
  }

  async updateAffinity(discordId: string, delta: number): Promise<User> {
    const user = await this.upsertByDiscordId({ discordId, username: discordId })
    const affinity = clamp(user.affinity + delta, AFFINITY_CONFIG.MIN, AFFINITY_CONFIG.MAX)
    return this.prisma.user.update({
      where: { id: user.id },
      data: { affinity, lastInteraction: new Date() },
    })
  }

  async updateMood(discordId: string, mood: string): Promise<User> {
    return this.prisma.user.update({
      where: { discordId },
      data: { mood },
    })
  }

  async addXp(discordId: string, amount: number): Promise<User> {
    return this.prisma.user.update({
      where: { discordId },
      data: { xp: { increment: amount }, lastInteraction: new Date() },
    })
  }

  async setTags(discordId: string, tags: string[]): Promise<User> {
    return this.prisma.user.update({
      where: { discordId },
      data: { tags: Array.from(new Set(tags)) },
    })
  }

  async touchLastInteraction(discordId: string): Promise<void> {
    await this.prisma.user.update({
      where: { discordId },
      data: { lastInteraction: new Date() },
    })
  }

  async findStaleUsers(olderThanDays: number): Promise<User[]> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    return this.prisma.user.findMany({
      where: { lastInteraction: { lt: cutoff } },
    })
  }
}
