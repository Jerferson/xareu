import { Message } from 'discord.js'
import { AudioService } from './AudioService'
import { VoiceService } from './VoiceService'

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

    await message.reply(`🔊 Tocando "${audioFileName}.mp3" no servidor: ${guildName}`)

    this.voiceService.playAudioByName(audioFileName, connection)
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

    await this.processAudioCommand(message, command)
  }
}
