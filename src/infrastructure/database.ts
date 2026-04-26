import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger'

let client: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    })
    client.$on('error' as never, (e: unknown) => logger.error({ e }, 'Prisma error'))
    client.$on('warn' as never, (e: unknown) => logger.warn({ e }, 'Prisma warn'))
  }
  return client
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}
