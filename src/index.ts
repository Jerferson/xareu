import 'dotenv/config'
import { DiscordBot } from './Bot'

/**
 * Ponto de entrada da aplicação
 */
async function main() {
  try {
    const bot = new DiscordBot()
    await bot.start(process.env.DISCORD_TOKEN!)

    // Trata sinais de encerramento
    process.on('SIGINT', async () => {
      console.log('\n🛑 Recebido SIGINT, encerrando...')
      await bot.stop()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Recebido SIGTERM, encerrando...')
      await bot.stop()
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar o bot:', error)
    process.exit(1)
  }
}

main()
