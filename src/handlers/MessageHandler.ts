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

    const botId = message.client.user?.id
    if (!botId) return

    const isMention = message.mentions.users.has(botId)
    logger.info(
      {
        author: message.author.tag,
        guildId: message.guild.id,
        channel: message.channel.id,
        isMention,
        contentPreview: message.content.slice(0, 80),
      },
      '✉️ mensagem em servidor recebida',
    )

    if (!isMention) return

    const config = await this.guildConfigRepo.getOrCreate(message.guild.id)
    if (!config.aiEnabled) {
      logger.info({ guildId: message.guild.id }, '🚫 IA desativada — ignorando menção')
      return
    }

    logger.info({ author: message.author.tag }, '📣 menção válida — processando com IA')
    await this.commandService.processMention(message)
  }
}
