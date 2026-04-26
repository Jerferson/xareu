import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { XareuCommand } from './types'

export class HelpCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra como o Xaréu funciona e os comandos disponíveis')

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const help = [
      '🐶 **Au au! Sou o Xaréu — pet inteligente do Discord**',
      '',
      '📜 **Comandos:**',
      '`/play <busca>` — toca um áudio (autocomplete fuzzy: digita parte do nome e eu sugiro)',
      '`/petisco` — me dá um petisco (+8 afinidade) e toco som de mastigando',
      '`/coleira pegar|passar @x|largar|quem` — quem tem a coleira é meu dono e eu sigo só ele',
      '`/status` — vê sua relação comigo (afinidade, humor, fatos que sei sobre você)',
      '`/config` — admin: nome da casinha, volume, cooldown, IA on/off',
      '`/help` — você acabou de usar 🐾',
      '',
      '💬 **Como conversar:**',
      '- **DM**: manda qualquer mensagem (até frases curtas — eu lembro do papo)',
      '- **Servidor**: marca `@Xaréu` em um canal de texto, ou dá reply em alguma mensagem me marcando — eu comento direcionado ao autor original',
      '- Se ainda não te conheço bem, posso anexar uma pergunta no fim das respostas (cada resposta sua vira memória pra eu te zoar melhor depois 😏)',
      '',
      '🎵 **Voz / casinha:**',
      '- Crie um canal de voz chamado **"Casinha do Xeréu"** — eu fico esperando lá',
      '- Quem entra na casinha com **afinidade ≥ 50** vira meu dono e eu sigo entre canais',
      '- Pra subir afinidade: `/petisco` (+8), DM/menção pra mim (+3), tocar áudio (+1). Ficar sumido perde -2/dia',
      '- Afinidade < 30 → eu rosno quando você chega no meu canal 🐺',
    ].join('\n')

    await interaction.reply({ content: help, flags: MessageFlags.Ephemeral })
  }
}
