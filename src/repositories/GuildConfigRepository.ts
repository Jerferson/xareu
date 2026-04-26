import { GuildConfig, PrismaClient } from '@prisma/client'
import { BOT_CONFIG } from '../config/constants'

export interface GuildConfigUpdate {
  casinhaName?: string
  volume?: number
  audioCooldown?: number
  aiEnabled?: boolean
  humorLevel?: number
  leashOwnerId?: string | null
  language?: string
}

export class GuildConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(guildId: string): Promise<GuildConfig> {
    return this.prisma.guildConfig.upsert({
      where: { guildId },
      create: { guildId, casinhaName: BOT_CONFIG.DEFAULT_CASINHA_NAME },
      update: {},
    })
  }

  async update(guildId: string, data: GuildConfigUpdate): Promise<GuildConfig> {
    await this.getOrCreate(guildId)
    return this.prisma.guildConfig.update({
      where: { guildId },
      data,
    })
  }

  async setLeashOwner(guildId: string, userId: string | null): Promise<GuildConfig> {
    return this.update(guildId, { leashOwnerId: userId })
  }
}
