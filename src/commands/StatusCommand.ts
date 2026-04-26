import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { EmotionEngine } from '../services/EmotionEngine'
import { IntelligenceService } from '../services/IntelligenceService'
import { XareuCommand } from './types'

const RELATIONSHIP_LABEL: Record<string, string> = {
  desconhecido: '🚪 desconhecido',
  conhecido: '👋 conhecido',
  amigo: '🤝 amigo',
  melhor_amigo: '💛 melhor amigo',
}

export class StatusCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('status')
    .setDescription('Mostra a relação entre você e o Xaréu')

  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly emotion: EmotionEngine,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const memory = await this.intelligence.getMemory(interaction.user.id)
    if (!memory) {
      await interaction.reply({
        content: '👀 Xaréu ainda não te conhece direito! Manda uma mensagem ou entra na casinha.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    const emotionalContext = this.emotion.evaluate({
      affinity: memory.user.affinity,
      mood: memory.user.mood,
      daysSinceLastInteraction: memory.daysSinceLastInteraction,
      recentInteractions: memory.recentInteractions,
    })
    const relationship = RELATIONSHIP_LABEL[emotionalContext.relationship] ?? emotionalContext.relationship

    const lines = [
      `${relationship} — ${emotionalContext.style}`,
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
