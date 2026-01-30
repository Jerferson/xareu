import { Message } from 'discord.js'
import { CommandService } from '../services/CommandService'

/**
 * Handler responsável pelo processamento de mensagens
 */
export class MessageHandler {
  private commandService: CommandService

  constructor(commandService: CommandService) {
    this.commandService = commandService
  }

  /**
   * Lida com mensagens recebidas
   */
  async handle(message: Message): Promise<void> {
    const messageType = message.guild?.name || 'DM'
    console.log(
      `🔔 Mensagem recebida! Guild: ${messageType} | ` +
      `Autor: ${message.author.tag} | Bot: ${message.author.bot} | ` +
      `Conteúdo: "${message.content}"`
    )

    // Ignora mensagens de bots
    if (message.author.bot) {
      console.log('   ⏭️  Ignorando: mensagem de bot')
      return
    }

    // Ignora mensagens vazias
    if (!message.content.trim()) {
      console.log('   ⏭️  Ignorando: mensagem vazia')
      return
    }

    // Processa DMs
    if (!message.guild) {
      await this.commandService.processDM(message)
      return
    }

    // Ignora mensagens de servidor (por enquanto)
    console.log(`⏭️  Mensagem de servidor ignorada: "${message.content}"`)
  }
}
