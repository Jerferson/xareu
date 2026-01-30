/**
 * Configurações e constantes do bot
 */

export const BOT_CONFIG = {
  /** Minutos possíveis para latidos aleatórios */
  RANDOM_BARK_MINUTES: [10, 25, 30, 45, 50],

  /** Tempo limite para reprodução de áudio (em milissegundos) */
  AUDIO_TIME_LIMIT_MS: 5000,

  /** Tempo de espera após entrada no canal antes de tocar áudio (em milissegundos) */
  ENTRY_WAIT_TIME_MS: 2000,

  /** URL de convite do bot */
  INVITE_URL: 'https://discord.com/api/oauth2/authorize?client_id=1466193686542028982&permissions=3146752&scope=bot',
} as const

export const AUDIO_CONFIG = {
  /** Caminho relativo para a pasta de áudios */
  AUDIOS_FOLDER: 'audios',

  /** Arquivo de áudio padrão para latido único */
  DEFAULT_BARK_FILE: 'latido-unico.mp3',
} as const
