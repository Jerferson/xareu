import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { AUDIO_CONFIG } from '../config/constants'
import { AudioQueueService } from '../services/AudioQueueService'
import { IntelligenceService } from '../services/IntelligenceService'
import { VoiceService } from '../services/VoiceService'
import { XareuCommand } from './types'

const COOLDOWN_HOURS = 6

export class PetiscoCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('petisco')
    .setDescription('Dá um petisco pro Xaréu (ganha afinidade, cooldown 6h)')

  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly audioQueue: AudioQueueService,
    private readonly voiceService: VoiceService,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memory = await this.intelligence.getMemory(interaction.user.id)
    if (memory) {
      const hoursSince = (Date.now() - memory.user.lastInteraction.getTime()) / (1000 * 60 * 60)
      if (memory.user.affinity >= 95 && hoursSince < COOLDOWN_HOURS) {
        await interaction.reply({
          content: '🦴 Xaréu tá empanturrado, depois você dá outro!',
          flags: MessageFlags.Ephemeral,
        })
        return
      }
    }

    const updated = await this.intelligence.recordInteraction({
      discordId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.user.displayName ?? null,
      type: 'petisco',
      guildId: interaction.guildId ?? null,
      channelId: interaction.channelId ?? null,
    })

    // Toca o som de mastigando se houver conexão de voz na guilda
    if (interaction.guildId) {
      const connection = this.voiceService.getConnection(interaction.guildId)
      if (connection) {
        void this.audioQueue.playInternal(connection, interaction.guildId, AUDIO_CONFIG.PETISCO_FILE)
      }
    }

    await interaction.reply(
      `🦴 Petisco! Xaréu abana o rabo. Sua afinidade agora é **${updated.affinity}/100**.`,
    )
  }
}
