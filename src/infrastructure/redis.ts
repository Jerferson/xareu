import Redis from 'ioredis'
import { env } from '../config/env'
import { logger } from '../utils/logger'

let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    })
    client.on('error', (err) => logger.error({ err }, 'Redis error'))
    client.on('connect', () => logger.info('🔗 Redis conectado'))
  }
  return client
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit()
    client = null
  }
}
