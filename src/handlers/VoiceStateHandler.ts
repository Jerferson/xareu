import { VoiceState } from 'discord.js'
import { VoiceService } from '../services/VoiceService'

/**
 * Handler responsável pelas mudanças de estado de voz
 */
export class VoiceStateHandler {
  private voiceService: VoiceService

  constructor(voiceService: VoiceService) {
    this.voiceService = voiceService
  }

  /**
   * Lida com mudanças de estado de voz
   */
  handle(oldState: VoiceState, newState: VoiceState): void {
    console.log('📢 VoiceStateUpdate detectado!')
    console.log(`   Usuário: ${newState.member?.user.tag}`)
    console.log(`   Bot?: ${newState.member?.user.bot}`)
    console.log(`   Canal antigo: ${oldState.channel?.name || 'nenhum'}`)
    console.log(`   Canal novo: ${newState.channel?.name || 'nenhum'}`)

    // Ignora eventos de bots
    if (newState.member?.user.bot) {
      console.log('   ⏭️  Ignorando bot')
      return
    }

    // Usuário saiu do canal
    const userLeftChannel = oldState.channel && !newState.channel
    if (userLeftChannel) {
      this.voiceService.leaveVoiceChannel(oldState.guild.id)
      return
    }

    // Usuário entrou ou mudou de canal
    const userJoinedOrMovedChannel = newState.channel && newState.channelId !== oldState.channelId
    if (userJoinedOrMovedChannel) {
      this.voiceService.handleChannelEntry(newState.channel, newState.guild.id)
      return
    }

    console.log('   ⏭️  Nenhuma ação necessária')
  }
}
