import { GuildMember, Message } from 'discord.js'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { logger } from '../utils/logger'
import { AIService } from './AIService'
import { AudioQueueService } from './AudioQueueService'
import { AudioService } from './AudioService'
import { IntelligenceService } from './IntelligenceService'
import { VoiceService } from './VoiceService'

/**
 * Serviço para comandos por DM e mensagens livres com IA.
 */
export class CommandService {
  constructor(
    private readonly audioService: AudioService,
    private readonly audioQueue: AudioQueueService,
    private readonly voiceService: VoiceService,
    private readonly intelligence: IntelligenceService,
    private readonly aiService: AIService,
    private readonly guildConfigRepo: GuildConfigRepository,
  ) {}

  // ────────────────────────────────────────────────────────────────
  // DM
  // ────────────────────────────────────────────────────────────────

  async processDM(message: Message): Promise<void> {
    const content = message.content.trim()
    if (!content) return
    logger.info({ author: message.author.tag, content }, '📨 DM recebida')

    const lower = content.toLowerCase()

    if (lower === 'help' || lower === '!help' || lower === '?help') {
      await this.sendAudioList(message)
      return
    }

    if (lower === 'status') {
      await this.sendStatus(message)
      return
    }

    // Heurística: mensagens curtas sem espaço viram tentativa de áudio.
    // Frases (mais de 3 palavras) viram conversa com a IA.
    const wordCount = content.split(/\s+/).length
    if (wordCount <= 2) {
      await this.tryPlayAudioFromDM(message, content)
      return
    }

    await this.respondWithAI(message, content)
  }

  private async sendAudioList(message: Message): Promise<void> {
    const audios = this.audioService.listAvailableAudios()
    if (audios.length === 0) {
      await message.reply('📂 Nenhum áudio na biblioteca!')
      return
    }
    const chunks = this.chunkList(audios, 50)
    await message.reply(
      `🎵 **Áudios disponíveis** (${audios.length}):\n• ${chunks[0].join('\n• ')}\n\n💡 Mande o nome (ou parte dele) pra tocar.`,
    )
    for (let i = 1; i < chunks.length; i++) {
      await message.reply(`• ${chunks[i].join('\n• ')}`)
    }
  }

  private async sendStatus(message: Message): Promise<void> {
    const guilds = this.voiceService.listActiveGuilds()
    if (guilds.length === 0) {
      await message.reply('😴 Tô fora de qualquer canal de voz agora.')
      return
    }
    const memory = await this.intelligence.getMemory(message.author.id)
    const lines = [
      `🎧 Conectado em ${guilds.length} servidor(es): ${guilds.map((g) => g.guildName).join(', ')}`,
    ]
    if (memory) {
      lines.push(
        `🦴 Sua afinidade comigo: **${memory.user.affinity}/100** (humor: ${memory.user.mood})`,
        `📊 Total de interações: ${memory.totalInteractions} | recentes: ${memory.recentInteractions}`,
        memory.user.tags.length ? `🏷️ Tags: ${memory.user.tags.join(', ')}` : '',
      )
    }
    await message.reply(lines.filter(Boolean).join('\n'))
  }

  private async tryPlayAudioFromDM(message: Message, query: string): Promise<void> {
    const guilds = this.voiceService.listActiveGuilds()
    if (guilds.length === 0) {
      await message.reply('❌ Não tô em nenhum canal de voz agora!')
      return
    }
    if (guilds.length > 1) {
      await message.reply(
        `🔀 Tô em vários servidores (${guilds.map((g) => g.guildName).join(', ')}). Use /play no servidor que você quer.`,
      )
      return
    }
    const target = guilds[0]
    const connection = this.voiceService.getConnection(target.guildId)
    if (!connection) {
      await message.reply('❌ Conexão de voz indisponível.')
      return
    }

    const match = this.audioService.findBestMatch(query)
    if (!match) {
      await message.reply(`🤷 Não achei nada parecido com "${query}".`)
      return
    }

    const config = await this.guildConfigRepo.getOrCreate(target.guildId)
    const result = this.audioQueue.enqueue({
      guildId: target.guildId,
      userId: message.author.id,
      fileName: match.fileName,
      cooldownSeconds: config.audioCooldown,
      volume: config.volume,
      connection,
    })

    if (!result.ok) {
      await message.reply(`⏳ Calma aí, espera ${result.cooldownRemaining}s antes de tocar de novo.`)
      return
    }

    await message.reply(`🔊 Tocando "${match.fileName}" em **${target.guildName}**`)

    await this.intelligence.recordInteraction({
      discordId: message.author.id,
      username: message.author.username,
      displayName: message.author.displayName ?? null,
      type: 'audio_played',
      guildId: target.guildId,
      message: match.fileName,
    })
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

    // Sem texto E sem reply → nada pra responder, ignora silenciosamente
    if (!cleaned && !referenced) return

    // Sem texto MAS com reply → o user só quer um comentário sobre a mensagem
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

  private chunkList<T>(items: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
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
