import { Mood } from '../config/constants'
import { clamp } from '../utils/helpers'

export type Relationship = 'desconhecido' | 'conhecido' | 'amigo' | 'melhor_amigo'
export type ResponseStyle = 'seco' | 'neutro' | 'amigavel' | 'entusiasmado'
export type EnergyLevel = 'baixa' | 'media' | 'alta'

export interface EmotionInput {
  affinity: number
  mood: Mood | string
  daysSinceLastInteraction: number
  recentInteractions: number
}

export interface EmotionalContext {
  relationship: Relationship
  /** 0–1 — quão "carregada" emocionalmente deve ser a resposta */
  intensity: number
  /** estilo da resposta: seco, neutro, amigável, entusiasmado */
  style: ResponseStyle
  /** nível de energia: baixa, média, alta */
  energy: EnergyLevel
  /** instruções extras pra IA (palpites baseados no estado) */
  hints: string[]
}

export class EmotionEngine {
  evaluate(input: EmotionInput): EmotionalContext {
    const relationship = this.classifyRelationship(input.affinity)
    const intensity = this.computeIntensity(input)
    const style = this.pickStyle(relationship, input.mood)
    const energy = this.pickEnergy(input)
    const hints = this.buildHints(input, relationship)

    return { relationship, intensity, style, energy, hints }
  }

  private classifyRelationship(affinity: number): Relationship {
    if (affinity >= 80) return 'melhor_amigo'
    if (affinity >= 50) return 'amigo'
    if (affinity >= 20) return 'conhecido'
    return 'desconhecido'
  }

  private computeIntensity(input: EmotionInput): number {
    // Base: afinidade normalizada (0..1)
    const base = input.affinity / 100
    // Boost se interagiu muito recente
    const recencyBoost = input.recentInteractions >= 5 ? 0.15 : 0
    // Penalidade se sumiu há muito tempo (saudade fica mais intensa em afinidade alta)
    const longingBoost = input.daysSinceLastInteraction >= 3 && input.affinity >= 60 ? 0.2 : 0
    return clamp(base + recencyBoost + longingBoost, 0, 1)
  }

  private pickStyle(relationship: Relationship, mood: string): ResponseStyle {
    if (mood === 'bravo') return 'seco'
    if (mood === 'dormindo') return 'seco'

    switch (relationship) {
      case 'melhor_amigo':
        return 'entusiasmado'
      case 'amigo':
        return mood === 'animado' || mood === 'feliz' ? 'entusiasmado' : 'amigavel'
      case 'conhecido':
        return 'neutro'
      case 'desconhecido':
      default:
        return 'seco'
    }
  }

  private pickEnergy(input: EmotionInput): EnergyLevel {
    if (input.recentInteractions >= 5 && input.affinity >= 50) return 'alta'
    if (input.daysSinceLastInteraction >= 7) return 'baixa'
    if (input.affinity < 30) return 'baixa'
    return 'media'
  }

  private buildHints(input: EmotionInput, relationship: Relationship): string[] {
    const hints: string[] = []

    if (relationship === 'melhor_amigo') {
      hints.push('use o nome do usuário e referencie memórias passadas quando fizer sentido')
      hints.push('demonstre carinho e entusiasmo claro')
    }
    if (relationship === 'desconhecido') {
      hints.push('seja seco, desconfiado, sem efusividade')
    }
    if (input.daysSinceLastInteraction >= 3 && input.affinity >= 60) {
      hints.push('expresse saudade — usuário sumiu por dias')
    }
    if (input.recentInteractions >= 5) {
      hints.push('o usuário tá interagindo bastante agora — fique animado')
    }
    if (input.daysSinceLastInteraction >= 7) {
      hints.push('responda como quem acabou de acordar, mais lento')
    }

    return hints
  }
}
