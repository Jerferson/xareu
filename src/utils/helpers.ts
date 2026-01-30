/**
 * Funções utilitárias gerais
 */

/**
 * Seleciona um minuto aleatório de uma lista
 */
export function selectRandomMinute(minutes: readonly number[]): number {
  const index = Math.floor(Math.random() * minutes.length)
  return minutes[index]
}

/**
 * Converte minutos para milissegundos
 */
export function minutesToMilliseconds(minutes: number): number {
  return minutes * 60 * 1000
}

/**
 * Formata mensagem de log com timestamp
 */
export function logWithTimestamp(message: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}
