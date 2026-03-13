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
    const userId = newState.member?.user.id || ''
    const collarHolder = this.voiceService.getCollarHolder(guildId)

    // Usuário saiu do canal completamente
    const userLeftChannel = oldState.channel && !newState.channel
    if (userLeftChannel) {
      console.log('   👋 Usuário saiu do canal')

      // Se o usuário que saiu tinha a coleira, tenta transferir para outro usuário
      if (collarHolder === userId) {
        console.log('   🎀 Dono da coleira saiu - tentando transferir')
        this.voiceService.forceReleaseCollar(guildId)
        
        // Tenta transferir para outro usuário no canal
        const newHolder = this.voiceService.transferCollarToRandomUser(guildId)
        
        if (!newHolder) {
          // Ninguém disponível, volta para casinha
          console.log('   🏠 Nenhum usuário disponível - voltando para casinha')
          this.voiceService.goToCasinha(guildId)
        } else {
          console.log(`   🎲 Coleira transferida para <@${newHolder}>`)
        }
        return
      }

      // Verifica se o bot ficou sozinho no canal atual
      setTimeout(() => {
        const isAlone = this.voiceService.isBotAloneInChannel(guildId)
        if (isAlone) {
          this.voiceService.handleBotAlone(guildId)
        }
      }, 2000)
      return
    }

    // Usuário entrou ou mudou de canal
    const userJoinedOrMovedChannel = newState.channel && newState.channelId !== oldState.channelId
    if (userJoinedOrMovedChannel) {
      console.log('   ✅ Usuário entrou/mudou de canal')

      // Se é a primeira pessoa entrando no servidor E o bot não está conectado, acorda o bot
      const wasServerEmpty = !oldState.channel
      const botNotConnected = !this.voiceService.isBotConnected(guildId)

      if (wasServerEmpty && botNotConnected) {
        console.log('   😴 Xeréu acordando... Indo para a casinha!')
        this.voiceService.handleUserJoinedChannel(guildId)
        return
      }

      // Se alguém mudou de canal e o bot ficou sozinho, volta para casinha
      if (oldState.channel) {
        setTimeout(() => {
          if (this.voiceService.isBotAloneInChannel(guildId)) {
            // Se o dono da coleira mudou de canal, segue ele
            if (collarHolder === userId) {
              console.log('   🐕 Seguindo dono da coleira para novo canal')
              this.voiceService.handleChannelEntry(newState.channel, guildId)
            } else {
              this.voiceService.handleBotAlone(guildId)
            }
          }
        }, 2000)
      }

      // Se este usuário tem a coleira, o bot segue
      if (collarHolder === userId) {
        console.log('   🐕 Dono da coleira mudou de canal - seguindo!')
        this.voiceService.handleChannelEntry(newState.channel, guildId)
        return
      }

      // Se ninguém tem a coleira, o bot fica na casinha esperando
      if (!collarHolder) {
        console.log('   🏠 Ninguém tem a coleira - Xeréu aguardando na casinha')
        return
      }

      // Outro usuário se moveu mas não tem a coleira - ignora
      console.log('   ⏭️  Usuário não tem coleira - ignorando')
      return
    }

    console.log('   ⏭️  Nenhuma ação necessária')
  }
}
