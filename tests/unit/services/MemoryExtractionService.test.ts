import { MemoryExtractionService } from '../../../src/services/MemoryExtractionService'

describe('MemoryExtractionService', () => {
  function buildService(): MemoryExtractionService {
    // Repos não são tocados pelos testes de heurística — passamos stubs vazios
    const stub = {} as never
    return new MemoryExtractionService(stub, stub, stub, stub, stub)
  }

  describe('shouldExtract', () => {
    const service = buildService()

    it('rejeita mensagens muito curtas', () => {
      expect(service.shouldExtract('oi')).toBe(false)
      expect(service.shouldExtract('au au')).toBe(false)
    })

    it('rejeita mensagens com poucas palavras', () => {
      expect(service.shouldExtract('eu sou')).toBe(false)
    })

    it('rejeita mensagens longas mas sem palavras-chave de auto-revelação', () => {
      expect(service.shouldExtract('que dia maluco hoje mano não faço ideia do que está acontecendo')).toBe(
        false,
      )
    })

    it('aceita mensagens com auto-revelação ("trabalho")', () => {
      expect(service.shouldExtract('eu trabalho com programação faz uns 8 anos')).toBe(true)
    })

    it('aceita mensagens com "gosto" mesmo com palavras no meio (regressão)', () => {
      expect(service.shouldExtract('eu também gosto de viajar e de ouvir música')).toBe(true)
    })

    it('aceita mensagens com "meu nome"', () => {
      expect(service.shouldExtract('meu nome verdadeiro é Jerferson e eu moro em Floripa')).toBe(true)
    })

    it('aceita mensagens com "estudo"', () => {
      expect(service.shouldExtract('estudo engenharia de software pela ufsc desde 2019')).toBe(true)
    })

    it('aceita mensagens com "amo"', () => {
      expect(service.shouldExtract('eu amo música e principalmente rock dos anos 80')).toBe(true)
    })

    it('é case-insensitive', () => {
      expect(service.shouldExtract('EU TRABALHO COM TI E AMO LINUX TUDO')).toBe(true)
    })

    it('não casa palavras parciais ("gostoso" não vira "gosto")', () => {
      expect(service.shouldExtract('esse café ficou super gostoso pra caramba hoje')).toBe(false)
    })
  })
})
