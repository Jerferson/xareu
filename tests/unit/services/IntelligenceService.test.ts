import { User } from '@prisma/client'
import { AFFINITY_CONFIG, MOOD, TAGS } from '../../../src/config/constants'
import { EventBus } from '../../../src/events/EventBus'
import { IntelligenceService } from '../../../src/services/IntelligenceService'
import { MoodService } from '../../../src/services/MoodService'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id',
    discordId: 'discord-1',
    username: 'fulano',
    displayName: null,
    affinity: 50,
    mood: MOOD.NEUTRO,
    xp: 0,
    tags: [],
    lastInteraction: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('IntelligenceService', () => {
  function buildHarness(initialUser?: User) {
    let user = initialUser ?? null
    const userRepo = {
      findByDiscordId: jest.fn(async () => user),
      upsertByDiscordId: jest.fn(async (input) => {
        user = makeUser({
          discordId: input.discordId,
          username: input.username,
          displayName: input.displayName ?? null,
        })
        return user
      }),
      updateAffinity: jest.fn(async (_id, delta: number) => {
        if (!user) throw new Error('no user')
        user = {
          ...user,
          affinity: Math.max(AFFINITY_CONFIG.MIN, Math.min(AFFINITY_CONFIG.MAX, user.affinity + delta)),
        }
        return user
      }),
      updateMood: jest.fn(async (_id, mood: string) => {
        if (!user) throw new Error('no user')
        user = { ...user, mood }
        return user
      }),
      addXp: jest.fn(),
      setTags: jest.fn(async (_id, tags: string[]) => {
        if (!user) throw new Error('no user')
        user = { ...user, tags }
        return user
      }),
      touchLastInteraction: jest.fn(),
      findStaleUsers: jest.fn(),
    }
    const interactionRepo = {
      create: jest.fn(async () => ({}) as never),
      countSince: jest.fn(async () => 1),
      countByUser: jest.fn(async () => 5),
      recentByUser: jest.fn(async () => []),
    }
    const eventBus = new EventBus()
    const moodService = new MoodService()
    const service = new IntelligenceService(
      userRepo as never,
      interactionRepo as never,
      moodService,
      eventBus,
    )
    return { service, userRepo, interactionRepo, getUser: () => user }
  }

  it('cria usuário se não existir', async () => {
    const { service, userRepo } = buildHarness()
    const u = await service.getOrCreateUser({ discordId: 'd-1', username: 'novo' })
    expect(u.discordId).toBe('d-1')
    expect(userRepo.upsertByDiscordId).toHaveBeenCalled()
  })

  it('aplica decay quando lastInteraction é antigo', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const { service, userRepo } = buildHarness(makeUser({ affinity: 50, lastInteraction: fiveDaysAgo }))
    await service.getOrCreateUser({ discordId: 'discord-1', username: 'fulano' })
    expect(userRepo.updateAffinity).toHaveBeenCalled()
    const delta = userRepo.updateAffinity.mock.calls[0][1]
    expect(delta).toBeLessThan(0)
  })

  it('não aplica decay se lastInteraction recente', async () => {
    const { service, userRepo } = buildHarness(makeUser({ affinity: 50, lastInteraction: new Date() }))
    await service.getOrCreateUser({ discordId: 'discord-1', username: 'fulano' })
    expect(userRepo.updateAffinity).not.toHaveBeenCalled()
  })

  it('petisco aumenta afinidade em +8', async () => {
    const { service, userRepo } = buildHarness(makeUser({ affinity: 50 }))
    await service.recordInteraction({ discordId: 'discord-1', username: 'fulano', type: 'petisco' })
    const calls = userRepo.updateAffinity.mock.calls.map((c) => c[1])
    expect(calls).toContain(8)
  })

  it('ignored diminui afinidade', async () => {
    const { service, userRepo } = buildHarness(makeUser({ affinity: 50 }))
    await service.recordInteraction({ discordId: 'discord-1', username: 'fulano', type: 'ignored' })
    const calls = userRepo.updateAffinity.mock.calls.map((c) => c[1])
    expect(calls.some((c) => c < 0)).toBe(true)
  })

  it('clampa afinidade no máximo (100)', async () => {
    const { service, getUser } = buildHarness(makeUser({ affinity: 99 }))
    await service.recordInteraction({ discordId: 'discord-1', username: 'fulano', type: 'petisco' })
    expect(getUser()?.affinity).toBe(100)
  })

  it('clampa afinidade no mínimo (0)', async () => {
    const { service, getUser } = buildHarness(makeUser({ affinity: 1 }))
    await service.recordInteraction({ discordId: 'discord-1', username: 'fulano', type: 'ignored' })
    expect(getUser()?.affinity).toBe(0)
  })

  it('deriva tag AMIGAVEL com afinidade alta', async () => {
    const { service, userRepo, getUser } = buildHarness(makeUser({ affinity: 80 }))
    await service.recordInteraction({ discordId: 'discord-1', username: 'fulano', type: 'mention' })
    expect(userRepo.setTags).toHaveBeenCalled()
    expect(getUser()?.tags).toContain(TAGS.AMIGAVEL)
  })

  it('deriva tag IGNORA com afinidade baixa', async () => {
    const { service, getUser } = buildHarness(makeUser({ affinity: 25 }))
    await service.recordInteraction({ discordId: 'discord-1', username: 'fulano', type: 'ignored' })
    expect(getUser()?.tags).toContain(TAGS.IGNORA)
  })

  it('memory retorna null se usuário não existe', async () => {
    const { service } = buildHarness()
    const memory = await service.getMemory('inexistente')
    expect(memory).toBeNull()
  })

  it('memory popula contagens e dias', async () => {
    const { service } = buildHarness(makeUser())
    const memory = await service.getMemory('discord-1')
    expect(memory).not.toBeNull()
    expect(memory?.recentInteractions).toBe(1)
    expect(memory?.totalInteractions).toBe(5)
  })
})
