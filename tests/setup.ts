// Variáveis padrão para os testes não dependerem de .env
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-token'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
process.env.LOG_LEVEL = 'fatal'
process.env.NODE_ENV = 'test'
