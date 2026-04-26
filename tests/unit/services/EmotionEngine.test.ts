import { MOOD } from '../../../src/config/constants'
import { EmotionEngine } from '../../../src/services/EmotionEngine'

describe('EmotionEngine', () => {
  const engine = new EmotionEngine()

  describe('relationship', () => {
    it('classifica como desconhecido com afinidade < 20', () => {
      const r = engine.evaluate({
        affinity: 10,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.relationship).toBe('desconhecido')
    })

    it('classifica como conhecido entre 20 e 49', () => {
      const r = engine.evaluate({
        affinity: 35,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.relationship).toBe('conhecido')
    })

    it('classifica como amigo entre 50 e 79', () => {
      const r = engine.evaluate({
        affinity: 65,
        mood: MOOD.FELIZ,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.relationship).toBe('amigo')
    })

    it('classifica como melhor_amigo com afinidade >= 80', () => {
      const r = engine.evaluate({
        affinity: 90,
        mood: MOOD.ANIMADO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.relationship).toBe('melhor_amigo')
    })
  })

  describe('style', () => {
    it('humor bravo força estilo seco', () => {
      const r = engine.evaluate({
        affinity: 90,
        mood: MOOD.BRAVO,
        daysSinceLastInteraction: 0,
        recentInteractions: 5,
      })
      expect(r.style).toBe('seco')
    })

    it('humor dormindo força estilo seco', () => {
      const r = engine.evaluate({
        affinity: 70,
        mood: MOOD.DORMINDO,
        daysSinceLastInteraction: 8,
        recentInteractions: 0,
      })
      expect(r.style).toBe('seco')
    })

    it('melhor amigo é entusiasmado', () => {
      const r = engine.evaluate({
        affinity: 90,
        mood: MOOD.FELIZ,
        daysSinceLastInteraction: 0,
        recentInteractions: 3,
      })
      expect(r.style).toBe('entusiasmado')
    })

    it('amigo com humor animado vira entusiasmado', () => {
      const r = engine.evaluate({
        affinity: 60,
        mood: MOOD.ANIMADO,
        daysSinceLastInteraction: 0,
        recentInteractions: 3,
      })
      expect(r.style).toBe('entusiasmado')
    })

    it('desconhecido é seco', () => {
      const r = engine.evaluate({
        affinity: 10,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.style).toBe('seco')
    })
  })

  describe('energy', () => {
    it('alta com afinidade >= 50 e muitas interações recentes', () => {
      const r = engine.evaluate({
        affinity: 60,
        mood: MOOD.FELIZ,
        daysSinceLastInteraction: 0,
        recentInteractions: 6,
      })
      expect(r.energy).toBe('alta')
    })

    it('baixa quando ausente há 7+ dias', () => {
      const r = engine.evaluate({
        affinity: 70,
        mood: MOOD.DORMINDO,
        daysSinceLastInteraction: 8,
        recentInteractions: 0,
      })
      expect(r.energy).toBe('baixa')
    })

    it('baixa quando afinidade < 30', () => {
      const r = engine.evaluate({
        affinity: 15,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.energy).toBe('baixa')
    })

    it('média no caso default', () => {
      const r = engine.evaluate({
        affinity: 50,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 1,
        recentInteractions: 1,
      })
      expect(r.energy).toBe('media')
    })
  })

  describe('intensity', () => {
    it('é proporcional à afinidade base', () => {
      const r = engine.evaluate({
        affinity: 40,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.intensity).toBeCloseTo(0.4, 2)
    })

    it('boost quando interagiu muito recente', () => {
      const base = engine.evaluate({
        affinity: 40,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      }).intensity
      const boosted = engine.evaluate({
        affinity: 40,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 6,
      }).intensity
      expect(boosted).toBeGreaterThan(base)
    })

    it('saudade quando afinidade alta + ausência prolongada', () => {
      const r = engine.evaluate({
        affinity: 70,
        mood: MOOD.CARENTE,
        daysSinceLastInteraction: 5,
        recentInteractions: 0,
      })
      expect(r.intensity).toBeGreaterThan(0.7)
    })

    it('clampa em 1', () => {
      const r = engine.evaluate({
        affinity: 100,
        mood: MOOD.ANIMADO,
        daysSinceLastInteraction: 5,
        recentInteractions: 10,
      })
      expect(r.intensity).toBeLessThanOrEqual(1)
    })
  })

  describe('hints', () => {
    it('melhor amigo recebe hints de carinho', () => {
      const r = engine.evaluate({
        affinity: 90,
        mood: MOOD.FELIZ,
        daysSinceLastInteraction: 0,
        recentInteractions: 1,
      })
      expect(r.hints.some((h) => h.toLowerCase().includes('carinho'))).toBe(true)
    })

    it('desconhecido recebe hint de desconfiança', () => {
      const r = engine.evaluate({
        affinity: 10,
        mood: MOOD.NEUTRO,
        daysSinceLastInteraction: 0,
        recentInteractions: 0,
      })
      expect(r.hints.some((h) => h.includes('seco') || h.includes('desconfiado'))).toBe(true)
    })

    it('saudade quando afinidade alta + ausência', () => {
      const r = engine.evaluate({
        affinity: 80,
        mood: MOOD.CARENTE,
        daysSinceLastInteraction: 4,
        recentInteractions: 0,
      })
      expect(r.hints.some((h) => h.toLowerCase().includes('saudade'))).toBe(true)
    })
  })
})
