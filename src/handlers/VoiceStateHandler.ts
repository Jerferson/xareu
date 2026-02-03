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

      // Verifica se o bot ficou sozinho no canal atual
      setTimeout(() => {
        const isAlone = this.voiceService.isBotAloneInChannel(guildId)

        // Só volta para casinha se o bot realmente ficou sozinho
        // (Não importa se estava seguindo ou não - o importante é estar sozinho)
        if (isAlone) {
          this.voiceService.handleBotAlone(guildId)
        }
      }, 2000) // Delay para garantir que o estado foi atualizado
      return
    }

    // Usuário entrou ou mudou de canal
    const userJoinedOrMovedChannel = newState.channel && newState.channelId !== oldState.channelId
    if (userJoinedOrMovedChannel) {
      console.log('   ✅ Usuário entrou no canal')

      // Se é a primeira pessoa entrando no servidor E o bot não está conectado, acorda o bot
      const wasServerEmpty = !oldState.channel
      const botNotConnected = !this.voiceService.isBotConnected(guildId)

      if (wasServerEmpty && botNotConnected) {
        this.voiceService.handleUserJoinedChannel(guildId)
        // Não continua - bot fica na casinha esperando
        return
      }

      // Se o bot está seguindo usuários, continua seguindo (não verifica se ficou sozinho)
      if (this.voiceService.isFollowingUsers(guildId)) {
        console.log('   🐕 Xeréu está seguindo o usuário...')
        this.voiceService.handleChannelEntry(newState.channel, guildId)
        return
      }

      // Se usuário mudou de canal E o bot não está seguindo, verifica se o bot ficou sozinho
      if (oldState.channel && !this.voiceService.isFollowingUsers(guildId)) {
        setTimeout(() => {
          // Verifica novamente se ainda não está seguindo (pode ter mudado)
          if (!this.voiceService.isFollowingUsers(guildId) && this.voiceService.isBotAloneInChannel(guildId)) {
            this.voiceService.handleBotAlone(guildId)
          }
        }, 2000) // Delay maior para garantir que o estado foi atualizado
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
        return
      }

      // Se chegou aqui e há casinha no servidor, não faz nada (modo casinha ativo)
      const guild = newState.guild
      const hasCasinha = guild.channels.cache.find(
        (ch) => ch.name === 'Casinha do Xeréu' && ch.isVoiceBased()
      )

      if (hasCasinha) {
        console.log('   🏠 Modo casinha ativo - aguardando usuário entrar na casinha...')
        return
      }

      // Apenas executa comportamento legado se NÃO houver casinha no servidor
      console.log('   ⚠️ Sem casinha - modo legado ativado')
      this.voiceService.handleChannelEntry(newState.channel, guildId)
      return
    }

    console.log('   ⏭️  Nenhuma ação necessária')
  }
}
