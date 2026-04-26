import { User, UserFact, UserMemory } from '@prisma/client'
import { MOOD } from '../../../src/config/constants'
import { ContextBuilderService } from '../../../src/services/ContextBuilderService'
import { EmotionalContext } from '../../../src/services/EmotionEngine'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id',
    discordId: 'discord-1',
    username: 'fulano',
    displayName: 'Fulano da Silva',
    affinity: 60,
    mood: MOOD.FELIZ,
    xp: 0,
    tags: ['amigavel'],
    lastInteraction: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeMemory(summary: string): UserMemory {
  return {
    id: 'mem-1',
    userId: 'user-id',
    summary,
    lastUpdatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeFact(fact: string): UserFact {
  return {
    id: `fact-${fact}`,
    userId: 'user-id',
    fact,
    confidence: 0.8,
    lastSeenAt: new Date(),
    createdAt: new Date(),
  }
}

const emotion: EmotionalContext = {
  relationship: 'amigo',
  intensity: 0.7,
  style: 'amigavel',
  energy: 'media',
  hints: ['responda com emoção positiva'],
}

describe('ContextBuilderService', () => {
  function build() {
    let memory: UserMemory | null = null
    let facts: UserFact[] = []
    let interactions: { message: string | null; response: string | null }[] = []

    const memoryRepo = {
      findByUserId: jest.fn(async () => memory),
      upsert: jest.fn(),
    }
    const factRepo = {
      findByUserId: jest.fn(async () => facts),
      upsertExact: jest.fn(),
      deleteOlderThan: jest.fn(),
      deleteForUser: jest.fn(),
    }
    const interactionRepo = {
      recentByUser: jest.fn(async () => interactions),
      create: jest.fn(),
      countByUser: jest.fn(),
      countSince: jest.fn(),
    }

    const service = new ContextBuilderService(
      memoryRepo as never,
      factRepo as never,
      interactionRepo as never,
    )

    return {
      service,
      setMemory: (m: UserMemory | null) => {
        memory = m
      },
      setFacts: (f: UserFact[]) => {
        facts = f
      },
      setInteractions: (i: { message: string | null; response: string | null }[]) => {
        interactions = i
      },
    }
  }

  it('inclui personalidade e estado no system prompt', async () => {
    const { service } = build()
    const messages = await service.build({
      user: makeUser(),
      emotion,
      daysSinceLastInteraction: 1.2,
      message: 'oi xareu',
    })

    const systemBlocks = messages.filter((m) => m.role === 'system').map((m) => m.content)
    expect(systemBlocks.join('\n')).toMatch(/Xaréu/)
    expect(systemBlocks.join('\n')).toMatch(/afinidade: 60/)
    expect(systemBlocks.join('\n')).toMatch(/relação: amigo/)
    expect(systemBlocks.join('\n')).toMatch(/estilo de resposta: amigavel/)
  })

  it('renderiza fatos no prompt quando existem', async () => {
    const { service, setFacts } = build()
    setFacts([makeFact('gosta de futebol'), makeFact('trabalha com TI')])

    const messages = await service.build({
      user: makeUser(),
      emotion,
      daysSinceLastInteraction: 0.5,
      message: 'oi',
    })

    const content = messages.map((m) => m.content).join('\n')
    expect(content).toMatch(/gosta de futebol/)
    expect(content).toMatch(/trabalha com TI/)
  })

  it('mostra resumo quando memória existe', async () => {
    const { service, setMemory } = build()
    setMemory(makeMemory('Usuário comunicativo e brincalhão'))

    const messages = await service.build({
      user: makeUser(),
      emotion,
      daysSinceLastInteraction: 0,
      message: 'oi',
    })

    const content = messages.map((m) => m.content).join('\n')
    expect(content).toMatch(/Usuário comunicativo e brincalhão/)
  })

  it('inclui histórico recente como mensagens user/assistant', async () => {
    const { service, setInteractions } = build()
    setInteractions([
      { message: 'oi de novo', response: 'au au!' },
      { message: 'tudo bem?', response: 'tudo, abana o rabo' },
    ])

    const messages = await service.build({
      user: makeUser(),
      emotion,
      daysSinceLastInteraction: 0,
      message: 'última mensagem',
    })

    const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content)
    const assistantMessages = messages.filter((m) => m.role === 'assistant').map((m) => m.content)
    expect(userMessages).toContain('oi de novo')
    expect(userMessages).toContain('tudo bem?')
    expect(userMessages[userMessages.length - 1]).toBe('última mensagem')
    expect(assistantMessages).toContain('au au!')
    expect(assistantMessages).toContain('tudo, abana o rabo')
  })

  it('inclui hints da emoção no prompt', async () => {
    const { service } = build()
    const messages = await service.build({
      user: makeUser(),
      emotion: { ...emotion, hints: ['expresse saudade', 'use o nome'] },
      daysSinceLastInteraction: 5,
      message: 'oi',
    })

    const content = messages.map((m) => m.content).join('\n')
    expect(content).toMatch(/expresse saudade/)
    expect(content).toMatch(/use o nome/)
  })

  it('última mensagem é sempre o input atual', async () => {
    const { service } = build()
    const messages = await service.build({
      user: makeUser(),
      emotion,
      daysSinceLastInteraction: 0,
      message: 'mensagem final',
    })

    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'mensagem final' })
  })

  describe('reply (mensagem referenciada)', () => {
    it('inclui bloco MENSAGEM REFERENCIADA quando há reply', async () => {
      const { service } = build()
      const refUser = makeUser({
        id: 'ref-user',
        discordId: 'ref-discord',
        username: 'joseildo',
        displayName: 'Joseildo',
        affinity: 70,
      })

      const messages = await service.build({
        user: makeUser({ id: 'main-user', discordId: 'main-discord' }),
        emotion,
        daysSinceLastInteraction: 0,
        message: '@xareu o que vc acha?',
        referenced: {
          user: refUser,
          emotion: { ...emotion, relationship: 'amigo' },
          daysSinceLastInteraction: 1,
          content: 'amanhã vai ter churrasco em casa',
        },
      })

      const content = messages.map((m) => m.content).join('\n')
      expect(content).toMatch(/MENSAGEM REFERENCIADA/)
      expect(content).toMatch(/Joseildo/)
      expect(content).toMatch(/amanhã vai ter churrasco em casa/)
      expect(content).toMatch(/Direcione sua resposta a Joseildo/)
    })

    it('OBJETIVO muda quando há reply', async () => {
      const { service } = build()
      const messages = await service.build({
        user: makeUser(),
        emotion,
        daysSinceLastInteraction: 0,
        message: 'oi',
        referenced: {
          user: makeUser({ id: 'ref-id', discordId: 'ref-discord', username: 'maria' }),
          emotion,
          daysSinceLastInteraction: 0,
          content: 'algo importante',
        },
      })

      const content = messages.map((m) => m.content).join('\n')
      expect(content).toMatch(/Comente o conteúdo dela/)
    })

    it('não inclui bloco quando referenced é null', async () => {
      const { service } = build()
      const messages = await service.build({
        user: makeUser(),
        emotion,
        daysSinceLastInteraction: 0,
        message: 'oi',
      })

      const content = messages.map((m) => m.content).join('\n')
      expect(content).not.toMatch(/MENSAGEM REFERENCIADA/)
    })
  })
})
