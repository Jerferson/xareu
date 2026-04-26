import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { VoiceService } from '../services/VoiceService'
import { XareuCommand } from './types'

export class ConfigCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurações do Xaréu (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) =>
      sc
        .setName('casinha')
        .setDescription('Define o nome do canal da casinha')
        .addStringOption((opt) =>
          opt.setName('nome').setDescription('Nome exato do canal').setRequired(true),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('volume')
        .setDescription('Define o volume (0.1 a 2.0)')
        .addNumberOption((opt) =>
          opt
            .setName('valor')
            .setDescription('Volume entre 0.1 e 2.0')
            .setRequired(true)
            .setMinValue(0.1)
            .setMaxValue(2),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('cooldown')
        .setDescription('Cooldown de áudio por usuário (segundos)')
        .addIntegerOption((opt) =>
          opt
            .setName('segundos')
            .setDescription('0 = sem cooldown')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(300),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName('ai')
        .setDescription('Liga ou desliga as respostas com IA neste servidor')
        .addBooleanOption((opt) => opt.setName('ativo').setDescription('true / false').setRequired(true)),
    )
    .addSubcommand((sc) =>
      sc
        .setName('humor')
        .setDescription('Nível de zoeira do Xaréu (0=comportado, 5=moderado, 10=insano)')
        .addIntegerOption((opt) =>
          opt.setName('nivel').setDescription('0 a 10').setRequired(true).setMinValue(0).setMaxValue(10),
        ),
    )
    .addSubcommand((sc) => sc.setName('ver').setDescription('Mostra a configuração atual'))

  constructor(
    private readonly guildConfigRepo: GuildConfigRepository,
    private readonly voiceService: VoiceService,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Só em servidor.', flags: MessageFlags.Ephemeral })
      return
    }
    const sub = interaction.options.getSubcommand(true)

    if (sub === 'ver') {
      const cfg = await this.guildConfigRepo.getOrCreate(interaction.guildId)
      await interaction.reply({
        content: [
          `🏠 Casinha: \`${cfg.casinhaName}\``,
          `🔊 Volume: ${cfg.volume}`,
          `⏱️ Cooldown: ${cfg.audioCooldown}s`,
          `🧠 IA: ${cfg.aiEnabled ? 'ativada' : 'desativada'}`,
          `😈 Humor: ${cfg.humorLevel}/10`,
          cfg.leashOwnerId ? `🎀 Coleira: <@${cfg.leashOwnerId}>` : '🎀 Coleira: livre',
        ].join('\n'),
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (sub === 'casinha') {
      const nome = interaction.options.getString('nome', true)
      await this.guildConfigRepo.update(interaction.guildId, { casinhaName: nome })
      this.voiceService.setCasinhaName(interaction.guildId, nome)
      await interaction.reply({ content: `🏠 Casinha agora é \`${nome}\`.`, flags: MessageFlags.Ephemeral })
      return
    }

    if (sub === 'volume') {
      const valor = interaction.options.getNumber('valor', true)
      await this.guildConfigRepo.update(interaction.guildId, { volume: valor })
      await interaction.reply({ content: `🔊 Volume ajustado para ${valor}.`, flags: MessageFlags.Ephemeral })
      return
    }

    if (sub === 'cooldown') {
      const segundos = interaction.options.getInteger('segundos', true)
      await this.guildConfigRepo.update(interaction.guildId, { audioCooldown: segundos })
      await interaction.reply({
        content: `⏱️ Cooldown ajustado para ${segundos}s.`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (sub === 'ai') {
      const ativo = interaction.options.getBoolean('ativo', true)
      await this.guildConfigRepo.update(interaction.guildId, { aiEnabled: ativo })
      await interaction.reply({
        content: `🧠 IA ${ativo ? 'ativada' : 'desativada'}.`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (sub === 'humor') {
      const nivel = interaction.options.getInteger('nivel', true)
      await this.guildConfigRepo.update(interaction.guildId, { humorLevel: nivel })
      const labels = ['comportado', 'leve', 'moderado', 'pesado', 'insano']
      const idx = nivel <= 2 ? 0 : nivel <= 4 ? 1 : nivel <= 6 ? 2 : nivel <= 8 ? 3 : 4
      await interaction.reply({
        content: `😈 Humor ajustado pra ${nivel}/10 (${labels[idx]}).`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }
  }
}
