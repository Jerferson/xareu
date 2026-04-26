import { VoiceChannel, VoiceState } from 'discord.js'
import { EventBus } from '../events/EventBus'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { VoiceService } from '../services/VoiceService'
import { logger } from '../utils/logger'

const ALONE_CHECK_DELAY_MS = 2000
const CHANNEL_SWITCH_DEBOUNCE_MS = 600

export class VoiceStateHandler {
  /**
   * Debounce de mudanças rápidas de canal por usuário.
   * Quando alguém troca de canal várias vezes em < 600ms, processamos só a última —
   * isso evita o erro "Cannot perform IP discovery - socket closed" do @discordjs/voice
   * quando o handshake da conexão anterior é interrompido pelo seguinte.
   */
  private readonly pendingByUser = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly voiceService: VoiceService,
    private readonly guildConfigRepo: GuildConfigRepository,
    private readonly eventBus: EventBus,
  ) {}

  async handle(oldState: VoiceState, newState: VoiceState): Promise<void> {
    if (newState.member?.user.bot) return

    const guildId = newState.guild.id
    const userId = newState.member?.id
    if (!userId) return

    // Debounce: cancela processamento agendado anterior do mesmo user
    const debounceKey = `${guildId}:${userId}`
    const pending = this.pendingByUser.get(debounceKey)
    if (pending) {
      clearTimeout(pending)
      logger.debug({ userId }, '🪃 debounce: descartando evento anterior')
    }

    const timer = setTimeout(() => {
      this.pendingByUser.delete(debounceKey)
      this.processStateUpdate(oldState, newState).catch((err) =>
        logger.error({ err }, 'Erro ao processar voice state'),
      )
    }, CHANNEL_SWITCH_DEBOUNCE_MS)
    this.pendingByUser.set(debounceKey, timer)
  }

  private async processStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = newState.guild.id
    const userId = newState.member?.id
    if (!userId) return

    // Garante que o config (incluindo nome da casinha) tá carregado
    await this.voiceService.loadGuildConfig(guildId)
    const config = await this.guildConfigRepo.getOrCreate(guildId)

    const userLeftChannel = oldState.channel && !newState.channel
    const userJoinedOrMoved = newState.channel && newState.channelId !== oldState.channelId

    logger.info(
      {
        userId,
        oldChannel: oldState.channel?.name,
        newChannel: newState.channel?.name,
        userLeftChannel,
        userJoinedOrMoved,
        isFollowing: this.voiceService.isFollowing(guildId),
        isInCasinha: this.voiceService.isInCasinha(guildId),
        leashOwner: config.leashOwnerId,
        isLeashOwner: config.leashOwnerId === userId,
      },
      '🔍 voiceStateUpdate',
    )

    if (userLeftChannel) {
      logger.info({ userId }, '🚪 branch: userLeftChannel — verificando se bot ficou sozinho')
      this.eventBus.emit({ type: 'voice.user.left', guildId, userId })
      setTimeout(() => {
        const alone = this.voiceService.isBotAloneInChannel(guildId)
        logger.info({ userId, alone }, '🕒 verificação pós-saída concluída')
        if (alone) {
          void this.voiceService.handleBotAlone(guildId)
        }
      }, ALONE_CHECK_DELAY_MS)
      return
    }

    if (userJoinedOrMoved && newState.channel) {
      const newChannel = newState.channel as VoiceChannel
      this.eventBus.emit({
        type: 'voice.user.joined',
        guildId,
        userId,
        channelId: newChannel.id,
        channelName: newChannel.name,
      })

      // Primeiro a entrar no servidor: bot acorda
      const wasServerEmpty = !oldState.channel
      if (wasServerEmpty && !this.voiceService.isBotConnected(guildId)) {
        logger.info({ userId, channel: newChannel.name }, '🌅 branch: wasServerEmpty — acordando bot')
        await this.voiceService.handleUserJoinedChannel(guildId)
        return
      }

      // Coleira: se há dono definido e o usuário não é o dono → ignora
      if (config.leashOwnerId && userId !== config.leashOwnerId) {
        const following = this.voiceService.isFollowing(guildId)
        logger.info({ userId, owner: config.leashOwnerId, following }, '🎀 branch: não-dono moveu')
        if (following) {
          await this.voiceService.handleChannelEntry(newChannel)
        }
        return
      }

      // Se o bot já está seguindo, acompanha
      if (this.voiceService.isFollowing(guildId)) {
        logger.info({ userId, channel: newChannel.name }, '🐕 branch: isFollowing — acompanhando user')
        await this.voiceService.handleChannelEntry(newChannel)
        return
      }

      // Verifica se ficou sozinho após a movimentação
      if (oldState.channel) {
        setTimeout(() => {
          if (!this.voiceService.isFollowing(guildId) && this.voiceService.isBotAloneInChannel(guildId)) {
            logger.info({ userId }, '🕒 verificação pós-mudança: bot sozinho, voltando pra casinha')
            void this.voiceService.handleBotAlone(guildId)
          }
        }, ALONE_CHECK_DELAY_MS)
      }

      // Bot na casinha + usuário entrou na casinha = começa a seguir
      if (this.voiceService.isInCasinha(guildId) && newChannel.name === config.casinhaName) {
        if (config.leashOwnerId && userId !== config.leashOwnerId) {
          logger.info(
            { userId, owner: config.leashOwnerId },
            '🚫 branch: user entrou na casinha mas não é dono da coleira',
          )
          return
        }
        // Auto-coleira: se ninguém tem a coleira, quem entra na casinha vira o novo dono
        if (!config.leashOwnerId) {
          await this.guildConfigRepo.setLeashOwner(guildId, userId)
          logger.info({ userId }, '🎀 auto-coleira: novo dono ao entrar na casinha')
        }
        logger.info({ userId }, '🏠 branch: user entrou na casinha — bot começa a seguir')
        this.eventBus.emit({ type: 'voice.user.entered_casinha', guildId, userId })
        await this.voiceService.startFollowing(guildId)
        await this.voiceService.handleChannelEntry(newChannel)
        return
      }

      // Modo legado (sem casinha)
      const guild = newState.guild
      const hasCasinha = guild.channels.cache.find(
        (ch) => ch.name === config.casinhaName && ch.isVoiceBased(),
      )
      if (!hasCasinha) {
        logger.info({ userId, channel: newChannel.name }, '🦾 branch: modo legado (sem casinha)')
        await this.voiceService.handleChannelEntry(newChannel)
      } else {
        logger.info(
          { userId, channel: newChannel.name },
          '⏸️ branch: nenhuma ação (bot esperando alguém entrar na casinha)',
        )
      }
    }
  }
}
