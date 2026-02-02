import { VoiceConnection } from '@discordjs/voice'

/**
 * Resultado da busca de conexão ativa
 */
export interface ActiveConnectionResult {
  connection: VoiceConnection | null
  guildName: string
}

/**
 * Informações de arquivo de áudio
 */
export interface AudioFileInfo {
  file: string
  distance: number
}
