import { Message } from 'discord.js'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { CommandService } from '../services/CommandService'
import { logger } from '../utils/logger'

export class MessageHandler {
  constructor(
    private readonly commandService: CommandService,
    private readonly guildConfigRepo: GuildConfigRepository,
  ) {}

  async handle(message: Message): Promise<void> {
    if (message.author.bot) return
    if (!message.content.trim()) return

    // DM
    if (!message.guild) {
      await this.commandService.processDM(message)
      return
    }

    // Menção ao bot no servidor
    const botId = message.client.user?.id
    if (!botId) return
    if (!message.mentions.users.has(botId)) return

    const config = await this.guildConfigRepo.getOrCreate(message.guild.id)
    if (!config.aiEnabled) {
      logger.debug({ guildId: message.guild.id }, 'IA desativada — ignorando menção')
      return
    }

    await this.commandService.processMention(message)
  }
}
