import { MOOD } from '../../../src/config/constants'
import { MoodService } from '../../../src/services/MoodService'

describe('MoodService', () => {
  const service = new MoodService()

  it('decide DORMINDO quando 7+ dias sem interagir', () => {
    expect(service.decide({ affinity: 90, daysSinceLastInteraction: 8, recentInteractions: 0 })).toBe(
      MOOD.DORMINDO,
    )
  })

  it('decide ANIMADO com afinidade alta + muitas interações recentes', () => {
    expect(service.decide({ affinity: 80, daysSinceLastInteraction: 0.5, recentInteractions: 5 })).toBe(
      MOOD.ANIMADO,
    )
  })

  it('decide CARENTE quando ama mas usuário sumiu há 2+ dias', () => {
    expect(service.decide({ affinity: 80, daysSinceLastInteraction: 3, recentInteractions: 0 })).toBe(
      MOOD.CARENTE,
    )
  })

  it('decide BRAVO com afinidade muito baixa', () => {
    expect(service.decide({ affinity: 15, daysSinceLastInteraction: 0, recentInteractions: 0 })).toBe(
      MOOD.BRAVO,
    )
  })

  it('decide FELIZ com afinidade alta sem critério mais específico', () => {
    expect(service.decide({ affinity: 65, daysSinceLastInteraction: 0.5, recentInteractions: 1 })).toBe(
      MOOD.FELIZ,
    )
  })

  it('decide NEUTRO no caso default', () => {
    expect(service.decide({ affinity: 40, daysSinceLastInteraction: 1, recentInteractions: 1 })).toBe(
      MOOD.NEUTRO,
    )
  })
})
