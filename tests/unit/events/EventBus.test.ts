import { EventBus } from '../../../src/events/EventBus'

describe('EventBus', () => {
  it('chama handler tipado para evento emitido', () => {
    const bus = new EventBus()
    const handler = jest.fn()
    bus.on('voice.user.joined', handler)
    bus.emit({ type: 'voice.user.joined', guildId: 'g', userId: 'u', channelId: 'c', channelName: 'casinha' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].type).toBe('voice.user.joined')
  })

  it('não chama handlers de outros tipos', () => {
    const bus = new EventBus()
    const handler = jest.fn()
    bus.on('voice.user.left', handler)
    bus.emit({ type: 'voice.user.joined', guildId: 'g', userId: 'u', channelId: 'c', channelName: 'casinha' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('aceita handlers async sem quebrar', async () => {
    const bus = new EventBus()
    const handler = jest.fn(async () => undefined)
    bus.on('petisco.given', handler)
    bus.emit({ type: 'petisco.given', guildId: 'g', userId: 'u' })
    await new Promise((r) => setImmediate(r))
    expect(handler).toHaveBeenCalled()
  })

  it('removeAllListeners limpa', () => {
    const bus = new EventBus()
    const handler = jest.fn()
    bus.on('voice.user.left', handler)
    bus.removeAllListeners()
    bus.emit({ type: 'voice.user.left', guildId: 'g', userId: 'u' })
    expect(handler).not.toHaveBeenCalled()
  })
})
