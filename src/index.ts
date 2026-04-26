import { DiscordBot } from './Bot'
import { logger } from './utils/logger'

async function main(): Promise<void> {
  const bot = new DiscordBot()

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, '📡 Sinal recebido, encerrando')
    await bot.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'))
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException')
    void bot.stop().finally(() => process.exit(1))
  })

  try {
    await bot.start()
  } catch (err) {
    logger.fatal({ err }, '❌ Erro fatal ao iniciar')
    process.exit(1)
  }
}

void main()
