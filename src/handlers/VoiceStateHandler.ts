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

    const guildId = newState.guild.id

    // Usuário saiu do canal
    const userLeftChannel = oldState.channel && !newState.channel
    if (userLeftChannel) {
      console.log('   👋 Usuário saiu do canal')

      // Verifica se o bot ficou sozinho
      setTimeout(() => {
        if (this.voiceService.isBotAloneInChannel(guildId)) {
          this.voiceService.handleBotAlone(guildId)
        }
      }, 1000) // Pequeno delay para garantir que o estado foi atualizado
      return
    }

    // Usuário entrou ou mudou de canal
    const userJoinedOrMovedChannel = newState.channel && newState.channelId !== oldState.channelId
    if (userJoinedOrMovedChannel) {
      console.log('   ✅ Usuário entrou no canal')

      // Se é a primeira pessoa entrando no servidor, acorda o bot e vai para a casinha
      const wasServerEmpty = !oldState.channel
      if (wasServerEmpty) {
        this.voiceService.handleUserJoinedChannel(guildId)
        // Não continua - bot fica na casinha esperando
        return
      }

      // Se usuário mudou de canal (e não é entrada nova), verifica se o bot ficou sozinho no canal antigo
      if (oldState.channel) {
        setTimeout(() => {
          if (this.voiceService.isBotAloneInChannel(guildId)) {
            this.voiceService.handleBotAlone(guildId)
            return
          }
        }, 1000) // Pequeno delay para garantir que o estado foi atualizado
      }

      // Se o bot está seguindo usuários, continua seguindo
      if (this.voiceService.isFollowingUsers(guildId)) {
        console.log('   🐕 Xeréu está seguindo o usuário...')
        this.voiceService.handleChannelEntry(newState.channel, guildId)
        return
      }

      // Se o bot está na casinha, só sai se alguém entrar na própria casinha
      if (this.voiceService.isInCasinhaChannel(guildId)) {
        // Se alguém entrou na casinha, o bot começa a seguir
        if (newState.channel.name === 'Casinha do Xeréu') {
          this.voiceService.startFollowingUser(guildId)
          this.voiceService.handleChannelEntry(newState.channel, guildId)
        } else {
          console.log('   🏠 Xeréu está na casinha, esperando ser chamado...')
        }
      } else {
        // Se não está na casinha nem seguindo, comportamento normal (legado)
        this.voiceService.handleChannelEntry(newState.channel, guildId)
      }
      return
    }

    console.log('   ⏭️  Nenhuma ação necessária')
  }
}
