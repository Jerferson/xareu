import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { AudioQueueService } from '../services/AudioQueueService'
import { AudioService } from '../services/AudioService'
import { IntelligenceService } from '../services/IntelligenceService'
import { VoiceService } from '../services/VoiceService'
import { XareuCommand } from './types'

const AUTOCOMPLETE_LIMIT = 25

export class PlayCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Manda o Xaréu tocar um áudio')
    .addStringOption((opt) =>
      opt.setName('audio').setDescription('Nome (ou parte) do áudio').setRequired(true).setAutocomplete(true),
    )

  constructor(
    private readonly audioService: AudioService,
    private readonly audioQueue: AudioQueueService,
    private readonly voiceService: VoiceService,
    private readonly intelligence: IntelligenceService,
    private readonly guildConfigRepo: GuildConfigRepository,
  ) {}

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true)
    if (focused.name !== 'audio') {
      await interaction.respond([])
      return
    }

    const matches = this.audioService.searchAudios(String(focused.value), AUTOCOMPLETE_LIMIT)
    const choices = matches.map(({ fileName }) => {
      const display = fileName.replace(/\.mp3$/i, '')
      // Discord exige name e value <= 100 chars
      const safeDisplay = display.length > 100 ? display.slice(0, 100) : display
      const safeValue = fileName.length > 100 ? fileName.slice(0, 100) : fileName
      return { name: safeDisplay, value: safeValue }
    })

    await interaction.respond(choices)
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'Esse comando só funciona em servidor.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    const query = interaction.options.getString('audio', true)
    const connection = this.voiceService.getConnection(interaction.guildId)
    if (!connection) {
      await interaction.reply({
        content: '😴 Tô fora do canal de voz. Entra em algum canal pra eu acordar!',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const match = this.audioService.findBestMatch(query)
    if (!match) {
      await interaction.reply({
        content: `🤷 Não achei nada parecido com "${query}".`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const config = await this.guildConfigRepo.getOrCreate(interaction.guildId)
    const result = this.audioQueue.enqueue({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      fileName: match.fileName,
      cooldownSeconds: config.audioCooldown,
      volume: config.volume,
      connection,
    })

    if (!result.ok) {
      await interaction.reply({
        content: `⏳ Calma! espera ${result.cooldownRemaining}s pra tocar de novo.`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    await interaction.reply(`🔊 Tocando \`${match.fileName}\``)

    await this.intelligence.recordInteraction({
      discordId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.user.displayName ?? null,
      type: 'audio_played',
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      message: match.fileName,
    })
  }
}
