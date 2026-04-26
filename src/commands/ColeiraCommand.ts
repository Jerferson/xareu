import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { AFFINITY_CONFIG } from '../config/constants'
import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { IntelligenceService } from '../services/IntelligenceService'
import { VoiceService } from '../services/VoiceService'
import { XareuCommand } from './types'

export class ColeiraCommand implements XareuCommand {
  readonly data = new SlashCommandBuilder()
    .setName('coleira')
    .setDescription('Gerencia quem o Xaréu segue (coleira)')
    .addSubcommand((sc) => sc.setName('pegar').setDescription('Pega a coleira — Xaréu vai te seguir'))
    .addSubcommand((sc) =>
      sc
        .setName('passar')
        .setDescription('Passa a coleira pra outro usuário')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Quem vai virar dono').setRequired(true),
        ),
    )
    .addSubcommand((sc) => sc.setName('largar').setDescription('Solta a coleira'))
    .addSubcommand((sc) => sc.setName('quem').setDescription('Mostra quem tá com a coleira'))

  constructor(
    private readonly guildConfigRepo: GuildConfigRepository,
    private readonly voiceService: VoiceService,
    private readonly intelligence: IntelligenceService,
  ) {}

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Só funciona em servidor.', flags: MessageFlags.Ephemeral })
      return
    }
    const sub = interaction.options.getSubcommand(true)

    if (sub === 'pegar') {
      const user = await this.intelligence.getOrCreateUser({
        discordId: interaction.user.id,
        username: interaction.user.username,
        displayName: interaction.user.displayName ?? null,
      })
      if (user.affinity < AFFINITY_CONFIG.LEASH_MIN) {
        await interaction.reply({
          content: `🐺 Xaréu rosna baixinho... sua afinidade é **${user.affinity}/100**, precisa de **${AFFINITY_CONFIG.LEASH_MIN}+** pra ele te obedecer.\nDá uns \`/petisco\` ou conversa com ele pra ganhar confiança!`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }
      await this.guildConfigRepo.setLeashOwner(interaction.guildId, interaction.user.id)
      const wentToUser = await this.voiceService.goToUser(interaction.guildId, interaction.user.id)
      const tail = wentToUser ? 'Tô indo aí agora! 🐕' : 'Entra num canal de voz pra eu te seguir.'
      await interaction.reply(`🎀 ${interaction.user} agora é dono do Xaréu! ${tail}`)
      return
    }

    if (sub === 'passar') {
      const target = interaction.options.getUser('usuario', true)
      const current = await this.guildConfigRepo.getOrCreate(interaction.guildId)
      if (current.leashOwnerId !== interaction.user.id) {
        await interaction.reply({
          content: '⛔ Você não tá com a coleira pra passar pra ninguém.',
          flags: MessageFlags.Ephemeral,
        })
        return
      }
      const targetMemory = await this.intelligence.getOrCreateUser({
        discordId: target.id,
        username: target.username,
        displayName: target.displayName ?? null,
      })
      if (targetMemory.affinity < AFFINITY_CONFIG.LEASH_MIN) {
        await interaction.reply({
          content: `🐺 Xaréu não confia em ${target} ainda — afinidade ${targetMemory.affinity}/100 (mínimo ${AFFINITY_CONFIG.LEASH_MIN}).`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }
      await this.guildConfigRepo.setLeashOwner(interaction.guildId, target.id)
      const wentToUser = await this.voiceService.goToUser(interaction.guildId, target.id)
      const tail = wentToUser ? 'Já fui atrás dele! 🐕' : ''
      await interaction.reply(`🎀 Coleira passada pra ${target}! ${tail}`.trim())
      return
    }

    if (sub === 'largar') {
      const current = await this.guildConfigRepo.getOrCreate(interaction.guildId)
      if (current.leashOwnerId !== interaction.user.id) {
        await interaction.reply({
          content: '⛔ Você não tá com a coleira.',
          flags: MessageFlags.Ephemeral,
        })
        return
      }
      await this.guildConfigRepo.setLeashOwner(interaction.guildId, null)
      // Para de seguir e volta pra casinha imediatamente
      await this.voiceService.goToCasinha(interaction.guildId)
      await interaction.reply('🎀 Coleira solta. Xaréu voltou pra casinha 🏠')
      return
    }

    if (sub === 'quem') {
      const config = await this.guildConfigRepo.getOrCreate(interaction.guildId)
      if (!config.leashOwnerId) {
        await interaction.reply(
          `🦴 Ninguém com a coleira — só quem tem afinidade ${AFFINITY_CONFIG.LEASH_MIN}+ consegue pegar.`,
        )
        return
      }
      await interaction.reply(`🎀 Coleira atual: <@${config.leashOwnerId}>`)
      return
    }
  }
}
