import { AudioQueueService } from '../../../src/services/AudioQueueService'

describe('AudioQueueService', () => {
  const fakeConnection = {} as never

  function buildService() {
    const playFile = jest.fn().mockResolvedValue(undefined)
    const audioService = { playFile } as unknown as Parameters<typeof makeQueue>[0]
    function makeQueue(svc: unknown): AudioQueueService {
      return new AudioQueueService(svc as never)
    }
    return { service: makeQueue(audioService), playFile }
  }

  it('aceita primeira reprodução quando dentro do cooldown válido', () => {
    const { service } = buildService()
    const result = service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'foo.mp3',
      cooldownSeconds: 5,
      connection: fakeConnection,
    })
    expect(result.ok).toBe(true)
  })

  it('bloqueia segunda reprodução do mesmo usuário antes do cooldown vencer', () => {
    const { service } = buildService()
    service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'foo.mp3',
      cooldownSeconds: 5,
      connection: fakeConnection,
    })
    const second = service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'bar.mp3',
      cooldownSeconds: 5,
      connection: fakeConnection,
    })
    expect(second.ok).toBe(false)
    expect(second.cooldownRemaining).toBeGreaterThan(0)
  })

  it('cooldown é por usuário (outro usuário pode tocar)', () => {
    const { service } = buildService()
    service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'foo.mp3',
      cooldownSeconds: 5,
      connection: fakeConnection,
    })
    const other = service.enqueue({
      guildId: 'g1',
      userId: 'u2',
      fileName: 'bar.mp3',
      cooldownSeconds: 5,
      connection: fakeConnection,
    })
    expect(other.ok).toBe(true)
  })

  it('cooldown 0 não bloqueia', () => {
    const { service } = buildService()
    service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'foo.mp3',
      cooldownSeconds: 0,
      connection: fakeConnection,
    })
    const second = service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'bar.mp3',
      cooldownSeconds: 0,
      connection: fakeConnection,
    })
    expect(second.ok).toBe(true)
  })

  it('serializa a fila — chama playFile uma de cada vez por guilda', async () => {
    const { service, playFile } = buildService()
    service.enqueue({
      guildId: 'g1',
      userId: 'u1',
      fileName: 'a.mp3',
      cooldownSeconds: 0,
      connection: fakeConnection,
    })
    service.enqueue({
      guildId: 'g1',
      userId: 'u2',
      fileName: 'b.mp3',
      cooldownSeconds: 0,
      connection: fakeConnection,
    })
    await new Promise((r) => setTimeout(r, 30))
    expect(playFile).toHaveBeenCalledTimes(2)
    expect(playFile.mock.calls[0][1]).toBe('a.mp3')
    expect(playFile.mock.calls[1][1]).toBe('b.mp3')
  })
})
