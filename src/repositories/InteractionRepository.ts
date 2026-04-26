import { Interaction, PrismaClient, Prisma } from '@prisma/client'

export type InteractionType =
  | 'voice_join'
  | 'voice_leave'
  | 'dm_text'
  | 'mention'
  | 'audio_played'
  | 'petisco'
  | 'ignored'

export interface CreateInteractionInput {
  userId: string
  guildId?: string | null
  channelId?: string | null
  type: InteractionType
  message?: string | null
  response?: string | null
  metadata?: Prisma.InputJsonValue
}

export class InteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateInteractionInput): Promise<Interaction> {
    return this.prisma.interaction.create({
      data: {
        userId: input.userId,
        guildId: input.guildId ?? null,
        channelId: input.channelId ?? null,
        type: input.type,
        message: input.message ?? null,
        response: input.response ?? null,
        metadata: input.metadata,
      },
    })
  }

  async recentByUser(userId: string, limit = 10): Promise<Interaction[]> {
    const items = await this.prisma.interaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return items.reverse()
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.interaction.count({ where: { userId } })
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.prisma.interaction.count({
      where: { userId, createdAt: { gte: since } },
    })
  }
}
