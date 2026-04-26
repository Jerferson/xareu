import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { AudioService } from '../services/AudioService'
import { XareuCommand } from './types'

export class HelpCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra os comandos do Xaréu e a lista de áudios')

  constructor(private readonly audioService: AudioService) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const audios = this.audioService.listAvailableAudios()
    const audioPreview =
      audios.slice(0, 30).join(', ') + (audios.length > 30 ? `... (+${audios.length - 30})` : '')

    const help = [
      '🐶 **Comandos do Xaréu**',
      '',
      '`/play <busca>` — toca um áudio (ou parecido)',
      '`/petisco` — dá um petisco e ganha afinidade',
      '`/coleira pegar|passar|largar` — gerencia quem o Xaréu segue',
      '`/status` — mostra a relação entre você e o Xaréu',
      '`/config` — configurações do servidor (admin)',
      '',
      `🎵 **Biblioteca** (${audios.length}): ${audioPreview}`,
    ].join('\n')

    await interaction.reply({ content: help, flags: MessageFlags.Ephemeral })
  }
}
