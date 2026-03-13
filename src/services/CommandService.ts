import { Message } from 'discord.js'
import { AudioService } from './AudioService'
import { VoiceService } from './VoiceService'

/** Comandos para pegar a coleira */
const COLLAR_COMMANDS = ['collar', 'coleira']
/** Comandos para soltar a coleira */
const RELEASE_COMMANDS = ['release', 'soltar']
/** Comandos para verificar quem tem a coleira */
const WHO_HAS_COLLAR_COMMANDS = ['owner', 'dono']

/**
 * Serviço responsável pelo processamento de comandos via DM
 */
export class CommandService {
  private audioService: AudioService
  private voiceService: VoiceService

  constructor(audioService: AudioService, voiceService: VoiceService) {
    this.audioService = audioService
    this.voiceService = voiceService
  }

  /**
   * Lista todos os áudios disponíveis
   */
  async listAvailableAudios(message: Message): Promise<void> {
    console.log('📋 Comando help recebido')

    const audioList = this.audioService.listAvailableAudios()

    if (audioList.length === 0) {
      await message.reply('📂 Nenhum áudio encontrado!')
      return
    }

    const formattedList = audioList.join('\n• ')

    await message.reply(
      `🎵 **Áudios disponíveis:**\n• ${formattedList}\n\n💡 Digite o nome do áudio para tocar!`
    )
  }

  /**
   * Processa um comando de áudio
   */
  async processAudioCommand(message: Message, audioName: string): Promise<void> {
    const { connection, guildName } = await this.voiceService.findActiveConnection()

    if (!connection) {
      console.log('⏭️  Bot não está em nenhum canal de voz')
      await message.reply('❌ Não estou conectado em nenhum canal de voz no momento!')
      return
    }

    const audioFileName = this.voiceService.getBestMatchingAudio(audioName)

    if (audioFileName.length === 0) {
      console.log(`⏭️  Nenhum áudio encontrado para sua busca`)
    }

    await message.reply(`🔊 Tocando "${audioFileName}" no servidor: ${guildName}`)

    this.voiceService.playAudioByName(audioFileName, connection)
  }

  /**
   * Processa comando de pegar a coleira
   */
  async processCollarCommand(message: Message): Promise<void> {
    console.log(`🎀 Comando coleira recebido de ${message.author.tag}`)
    
    const userId = message.author.id

    // Primeiro, encontra onde o usuário está
    const userLocation = this.voiceService.findUserVoiceChannel(userId)
    
    if (!userLocation) {
      await message.reply('❌ Você precisa estar em um canal de voz para pegar a coleira!')
      return
    }

    const { guildId, channel } = userLocation
    const result = this.voiceService.giveCollar(guildId, userId)

    if (!result.success) {
      const holderMention = `<@${result.previousHolder}>`
      await message.reply(`❌ A coleira já está com ${holderMention}! Peça para ele soltar primeiro.`)
      return
    }

    if (result.previousHolder) {
      const previousMention = `<@${result.previousHolder}>`
      await message.reply(`👑 Você tomou a coleira de ${previousMention}! 🐕 Xeréu agora vai te seguir!`)
    } else {
      await message.reply('🎀 Você pegou a coleira! 🐕 Xeréu agora vai te seguir!')
    }

    // Vai até o canal do usuário
    this.voiceService.handleChannelEntry(channel, guildId)
  }

  /**
   * Processa comando de soltar a coleira
   */
  async processReleaseCommand(message: Message): Promise<void> {
    console.log(`🏠 Comando soltar coleira recebido de ${message.author.tag}`)
    
    const userId = message.author.id

    // Procura em qual servidor o bot está conectado
    const { connection, guildName } = await this.voiceService.findActiveConnection()
    
    if (!connection) {
      await message.reply('❌ O Xeréu não está conectado em nenhum servidor!')
      return
    }

    // Pega o guildId da conexão ativa
    const guildId = connection.joinConfig.guildId

    const currentHolder = this.voiceService.getCollarHolder(guildId)
    
    if (!currentHolder) {
      await message.reply('❌ Ninguém está com a coleira no momento!')
      return
    }

    const released = this.voiceService.releaseCollar(guildId, userId)

    if (!released) {
      await message.reply('❌ Você não pode soltar a coleira porque não está com ela!')
      return
    }

    await message.reply('🏠 Coleira solta! Xeréu voltou para a casinha.')
  }

  /**
   * Processa uma mensagem DM
   */
  async processDM(message: Message): Promise<void> {
    console.log(`📨 DM recebida de ${message.author.tag}: "${message.content}"`)

    const command = message.content.trim().toLowerCase()

    if (command === 'help') {
      await this.listAvailableAudios(message)
      return
    }

    // Verifica se é comando de coleira
    if (COLLAR_COMMANDS.includes(command)) {
      await this.processCollarCommand(message)
      return
    }

    // Verifica se é comando de soltar
    if (RELEASE_COMMANDS.includes(command)) {
      await this.processReleaseCommand(message)
      return
    }

    // Verifica se é comando de verificar dono da coleira
    if (WHO_HAS_COLLAR_COMMANDS.includes(command)) {
      await this.processWhoHasCollarCommand(message)
      return
    }

    await this.processAudioCommand(message, command)
  }

  /**
   * Processa comando para verificar quem tem a coleira
   */
  async processWhoHasCollarCommand(message: Message): Promise<void> {
    console.log(`🔍 Comando quem tem coleira recebido de ${message.author.tag}`)

    const { connection } = await this.voiceService.findActiveConnection()

    if (!connection) {
      await message.reply('❌ O Xeréu não está conectado em nenhum servidor!')
      return
    }

    const guildId = connection.joinConfig.guildId
    const collarHolder = this.voiceService.getCollarHolder(guildId)

    if (!collarHolder) {
      await message.reply('🏠 Ninguém está com a coleira! O Xeréu está na casinha esperando.')
      return
    }

    const holderMention = `<@${collarHolder}>`
    await message.reply(`🎀 A coleira está com ${holderMention}!`)
  }
}
