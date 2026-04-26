/**
 * Funções utilitárias puras.
 */

export function selectRandomMinute(minutes: readonly number[]): number {
  const index = Math.floor(Math.random() * minutes.length)
  return minutes[index]
}

export function minutesToMilliseconds(minutes: number): number {
  return minutes * 60 * 1000
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function pickRandom<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

export function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime()
  return ms / (1000 * 60 * 60 * 24)
}
