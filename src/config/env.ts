import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN é obrigatório'),
  DISCORD_CLIENT_ID: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(300),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.85),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  AFFINITY_DECAY_PER_DAY: z.coerce.number().default(2),
  AFFINITY_GAIN_PER_INTERACTION: z.coerce.number().default(3),
  AI_CONTEXT_WINDOW: z.coerce.number().int().positive().default(10),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function loadEnv(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`)
  }
  cached = parsed.data
  return cached
}

export const env = new Proxy({} as Env, {
  get: (_target, prop: keyof Env) => loadEnv()[prop],
})
