import { GuildMember, Message } from 'discord.js'
import { logger } from '../utils/logger'
import { AIService } from './AIService'
import { IntelligenceService } from './IntelligenceService'

/**
 * Serviço para conversas via DM e menções no servidor.
 * Toda DM vira conversa contínua com a IA. Comandos utilitários (lista
 * de áudios, status, play) agora são slash commands (`/help`, `/status`,
 * `/play`).
 */
export class CommandService {
  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly aiService: AIService,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // DM
  // ────────────────────────────────────────────────────────────────

  async processDM(message: Message): Promise<void> {
    const content = message.content.trim()
    if (!content) return
    logger.info({ author: message.author.tag, content }, '📨 DM recebida')
    // Toda DM agora é conversa com IA — comandos viraram slash (/help, /status, /play…)
    await this.respondWithAI(message, content)
  }

  private async respondWithAI(message: Message, content: string): Promise<void> {
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping().catch(() => undefined)
    }
    const response = await this.aiService.respond({
      discordId: message.author.id,
      username: message.author.username,
      displayName: message.author.displayName ?? null,
      message: content,
    })
    if (!response) return
    await this.safeReply(message, response)
    await this.intelligence.recordInteraction({
      discordId: message.author.id,
      username: message.author.username,
      displayName: message.author.displayName ?? null,
      type: 'dm_text',
      message: content,
      response,
    })
  }

  // ────────────────────────────────────────────────────────────────
  // Menções no servidor
  // ────────────────────────────────────────────────────────────────

  async processMention(message: Message): Promise<void> {
    if (!message.guild) return
    const member = message.member as GuildMember | null
    if (!member) return

    const cleaned = message.content.replace(new RegExp(`<@!?${message.client.user?.id}>`, 'g'), '').trim()

    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping().catch(() => undefined)
    }

    const referenced = await this.resolveReferencedMessage(message)
    if (referenced) {
      logger.info(
        { author: referenced.username, contentPreview: referenced.content.slice(0, 80) },
        '🔗 reply detectado — incluindo mensagem referenciada no contexto',
      )
    }

    if (!cleaned && !referenced) return

    const userMessage =
      cleaned ||
      '(O usuário me marcou sem texto, em reply à mensagem referenciada — ele quer que eu comente sobre ela.)'

    const response = await this.aiService.respond({
      discordId: member.id,
      username: member.user.username,
      displayName: member.displayName,
      guildId: message.guild.id,
      channelId: message.channel.id,
      message: userMessage,
      referenced,
    })
    if (!response) return
    await this.safeReply(message, response)
    await this.intelligence.recordInteraction({
      discordId: member.id,
      username: member.user.username,
      displayName: member.displayName,
      type: 'mention',
      guildId: message.guild.id,
      channelId: message.channel.id,
      message: cleaned || `[reply em ${referenced?.username ?? 'mensagem'}]`,
      response,
    })
  }

  /**
   * Se a mensagem é um reply, busca a mensagem referenciada no Discord e
   * extrai o autor + conteúdo. Ignora replies a mensagens de bots.
   */
  private async resolveReferencedMessage(
    message: Message,
  ): Promise<{ discordId: string; username: string; displayName: string | null; content: string } | null> {
    if (!message.reference?.messageId) return null
    if (!('messages' in message.channel)) return null

    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId)
      if (refMsg.author.bot) return null
      const content = refMsg.content?.trim()
      if (!content) return null
      return {
        discordId: refMsg.author.id,
        username: refMsg.author.username,
        displayName: refMsg.member?.displayName ?? refMsg.author.displayName ?? null,
        content,
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'falha ao buscar mensagem referenciada')
      return null
    }
  }

  /**
   * Tenta `message.reply()`; se falhar (ex: sem permissão de Read Message History),
   * cai pro `channel.send()`.
   */
  private async safeReply(message: Message, content: string): Promise<void> {
    try {
      await message.reply(content)
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'reply falhou, usando channel.send')
      if ('send' in message.channel) {
        await message.channel
          .send(content)
          .catch((sendErr) => logger.error({ err: sendErr }, 'channel.send também falhou'))
      }
    }
  }
}
