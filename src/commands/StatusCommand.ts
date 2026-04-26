import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { IntelligenceService } from '../services/IntelligenceService'
import { XareuCommand } from './types'

export class StatusCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('status')
    .setDescription('Mostra a relação entre você e o Xaréu')

  constructor(private readonly intelligence: IntelligenceService) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memory = await this.intelligence.getMemory(interaction.user.id)
    if (!memory) {
      await interaction.reply({
        content: '👀 Xaréu ainda não te conhece direito! Manda uma mensagem ou entra na casinha.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    const lines = [
      `🦴 **Afinidade**: ${memory.user.affinity}/100`,
      `😺 **Humor (Xaréu→você)**: ${memory.user.mood}`,
      `📊 **Interações**: ${memory.totalInteractions} no total | ${memory.recentInteractions} nas últimas 24h`,
      `⏰ **Última interação**: há ${memory.daysSinceLastInteraction.toFixed(1)} dia(s)`,
      memory.user.tags.length ? `🏷️ **Tags**: ${memory.user.tags.join(', ')}` : '',
      memory.user.xp > 0 ? `✨ **XP**: ${memory.user.xp}` : '',
    ].filter(Boolean)
    await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral })
  }
}
