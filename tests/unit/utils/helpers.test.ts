import {
  clamp,
  daysSince,
  minutesToMilliseconds,
  pickRandom,
  selectRandomMinute,
} from '../../../src/utils/helpers'

describe('helpers', () => {
  it('selectRandomMinute retorna um item da lista', () => {
    const minutes = [10, 25, 30] as const
    for (let i = 0; i < 20; i++) {
      expect(minutes).toContain(selectRandomMinute(minutes))
    }
  })

  it('minutesToMilliseconds converte corretamente', () => {
    expect(minutesToMilliseconds(1)).toBe(60_000)
    expect(minutesToMilliseconds(0)).toBe(0)
    expect(minutesToMilliseconds(0.5)).toBe(30_000)
  })

  it('clamp respeita limites', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(20, 0, 10)).toBe(10)
  })

  it('pickRandom retorna undefined para lista vazia', () => {
    expect(pickRandom([])).toBeUndefined()
  })

  it('pickRandom sempre retorna item da lista', () => {
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 20; i++) {
      expect(items).toContain(pickRandom(items))
    }
  })

  it('daysSince calcula a diferença', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(daysSince(oneDayAgo)).toBeCloseTo(1, 1)
  })
})
