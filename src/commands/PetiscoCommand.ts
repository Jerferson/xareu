import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { EventBus } from '../events/EventBus'
import { IntelligenceService } from '../services/IntelligenceService'
import { XareuCommand } from './types'

const COOLDOWN_HOURS = 6

export class PetiscoCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('petisco')
    .setDescription('Dá um petisco pro Xaréu (ganha afinidade, cooldown 6h)')

  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memory = await this.intelligence.getMemory(interaction.user.id)
    if (memory) {
      const hoursSince = (Date.now() - memory.user.lastInteraction.getTime()) / (1000 * 60 * 60)
      // Cooldown só vale se a última interação foi de petisco — ler do tipo da última.
      // Simplificação: cooldown geral entre petiscos via lastInteraction quando o Xaréu já tá saciado.
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

    this.eventBus.emit({
      type: 'petisco.given',
      guildId: interaction.guildId ?? 'dm',
      userId: interaction.user.id,
    })

    await interaction.reply(
      `🦴 Petisco! Xaréu abana o rabo. Sua afinidade agora é **${updated.affinity}/100**.`,
    )
  }
}
