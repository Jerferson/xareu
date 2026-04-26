import { Interaction, MessageFlags } from 'discord.js'
import { XareuCommand } from '../commands'
import { logger } from '../utils/logger'

export class InteractionHandler {
  constructor(private readonly commands: Map<string, XareuCommand>) {}

  async handle(interaction: Interaction): Promise<void> {
    if (interaction.isAutocomplete()) {
      const command = this.commands.get(interaction.commandName)
      if (!command?.autocomplete) {
        await interaction.respond([]).catch(() => undefined)
        return
      }
      try {
        await command.autocomplete(interaction)
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, 'Erro no autocomplete')
        await interaction.respond([]).catch(() => undefined)
      }
      return
    }

    if (!interaction.isChatInputCommand()) return
    const command = this.commands.get(interaction.commandName)
    if (!command) {
      await interaction.reply({ content: 'Comando desconhecido 🤷', flags: MessageFlags.Ephemeral })
      return
    }
    try {
      await command.execute(interaction)
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, 'Erro ao executar slash command')
      const errorMsg = '💥 Xaréu se enrolou no carpete. Tenta de novo!'
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({ content: errorMsg, flags: MessageFlags.Ephemeral })
          .catch(() => undefined)
      } else {
        await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => undefined)
      }
    }
  }
}
