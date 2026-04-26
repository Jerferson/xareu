import OpenAI from 'openai'
import { env } from '../config/env'
import { logger } from '../utils/logger'

let client: OpenAI | null = null

export function getOpenAI(): OpenAI | null {
  if (!env.OPENAI_API_KEY) {
    return null
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    logger.info('🧠 OpenAI client inicializado')
  }
  return client
}

export function isAIEnabled(): boolean {
  return Boolean(env.OPENAI_API_KEY)
}
