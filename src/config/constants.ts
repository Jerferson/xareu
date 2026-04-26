/**
 * Constantes de comportamento do bot.
 * Configurações por servidor ficam em GuildConfig (DB).
 */

export const BOT_CONFIG = {
  /** Minutos possíveis para latidos aleatórios */
  RANDOM_BARK_MINUTES: [10, 25, 30, 45, 50] as const,

  /** Tempo limite para reprodução de áudio (em milissegundos) */
  AUDIO_TIME_LIMIT_MS: 5000,

  /** Delay após Ready antes de tocar o latido — gateway de voz precisa estabilizar */
  ENTRY_WAIT_TIME_MS: 800,

  /** Nome padrão da casinha (override por GuildConfig) */
  DEFAULT_CASINHA_NAME: 'Casinha do Xeréu',
} as const

export const AUDIO_CONFIG = {
  AUDIOS_FOLDER: 'audios',
  /** Áudio padrão para latido único */
  DEFAULT_BARK_FILE: 'latido-unico.mp3',
  /** Extensões aceitas */
  SUPPORTED_EXTENSIONS: ['.mp3'] as const,
} as const

export const AFFINITY_CONFIG = {
  MIN: 0,
  MAX: 100,
  DEFAULT: 50,
  /** Intervalo (ms) entre interações para contar como "spam" e não ganhar afinidade */
  ANTI_SPAM_WINDOW_MS: 30_000,
} as const

export const MOOD = {
  FELIZ: 'feliz',
  CARENTE: 'carente',
  BRAVO: 'bravo',
  ANIMADO: 'animado',
  DORMINDO: 'dormindo',
  NEUTRO: 'neutro',
} as const

export type Mood = (typeof MOOD)[keyof typeof MOOD]

export const TAGS = {
  AMIGAVEL: 'amigavel',
  IGNORA: 'ignora',
  BRINCA_MUITO: 'brinca-muito',
  NOVATO: 'novato',
  ANTIGO: 'antigo',
  CARENTE: 'carente',
} as const

export type UserTag = (typeof TAGS)[keyof typeof TAGS]
