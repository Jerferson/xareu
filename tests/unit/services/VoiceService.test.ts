// Mock do @discordjs/voice antes de qualquer import
const connections = new Map<string, any>()

const mockJoinVoiceChannel = jest.fn((config: any) => {
  const connection: any = {
    state: { status: 'ready' },
    joinConfig: {
      channelId: config.channelId,
      guildId: config.guildId,
    },
    destroy: jest.fn(function(this: any) {
      this.state.status = 'destroyed'
      connections.delete(config.guildId)
    }),
    setMaxListeners: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
  }
  connections.set(config.guildId, connection)
  return connection
})

const mockGetVoiceConnection = jest.fn((guildId: string) => {
  return connections.get(guildId)
})

jest.mock('@discordjs/voice', () => ({
  joinVoiceChannel: mockJoinVoiceChannel,
  getVoiceConnection: mockGetVoiceConnection,
  getVoiceConnections: jest.fn(() => connections),
  createAudioPlayer: jest.fn(() => ({
    on: jest.fn(),
    play: jest.fn(),
    stop: jest.fn(),
  })),
  createAudioResource: jest.fn((path: string) => ({ path })),
  AudioPlayerStatus: {
    Idle: 'idle',
    Playing: 'playing',
  },
  VoiceConnectionStatus: {
    Ready: 'ready',
    Destroyed: 'destroyed',
  },
}))

import { VoiceService } from '../../../src/services/VoiceService'
import { AudioService } from '../../../src/services/AudioService'
import { createTestSetup } from '../../fixtures/mockDiscordClient'

const mockVoiceModule = {
  joinVoiceChannel: mockJoinVoiceChannel,
  getVoiceConnection: mockGetVoiceConnection,
}

describe('VoiceService - Casinha do Xeréu', () => {
  let voiceService: VoiceService
  let audioService: AudioService
  let testSetup: ReturnType<typeof createTestSetup>

  beforeEach(() => {
    testSetup = createTestSetup()
    audioService = new AudioService()
    voiceService = new VoiceService(testSetup.client as any, audioService)
    jest.clearAllMocks()
  })

  describe('Cenário 1: Acordar e ir para a casinha', () => {
    it('deve ir para a casinha quando acordar pela primeira vez', () => {
      // Given: Bot está offline
      const { guild } = testSetup

      // When: Primeiro usuário entra
      voiceService.handleUserJoinedChannel(guild.id)

      // Then: Bot vai para casinha
      expect(mockVoiceModule.joinVoiceChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: testSetup.channels.casinhaChannel.id,
          guildId: guild.id,
        })
      )
      expect(voiceService.isInCasinhaChannel(guild.id)).toBe(true)
      expect(voiceService.isCollarTaken(guild.id)).toBe(false)
    })

    it('deve resetar estado ao acordar com conexão existente', () => {
      // Given: Bot tem conexão existente de sessão anterior
      const { guild } = testSetup
      mockVoiceModule.joinVoiceChannel({
        channelId: 'some-channel',
        guildId: guild.id,
        adapterCreator: () => {}
      })

      // When: Usuário entra e bot acorda
      voiceService.handleUserJoinedChannel(guild.id)

      // Then: Deve resetar estado e ir para casinha
      expect(voiceService.isCollarTaken(guild.id)).toBe(false)
      expect(voiceService.isInCasinhaChannel(guild.id)).toBe(true)
    })

    it('não deve fazer nada se não houver casinha', () => {
      // Given: Servidor sem casinha
      const guildWithoutCasinha = new (testSetup.guild.constructor as any)('guild-2', 'No Casinha Server')
      testSetup.client.addGuild(guildWithoutCasinha)

      // When: Usuário entra
      const callsBefore = mockVoiceModule.joinVoiceChannel.mock.calls.length
      voiceService.handleUserJoinedChannel(guildWithoutCasinha.id)

      // Then: Não deve conectar
      expect(mockVoiceModule.joinVoiceChannel).toHaveBeenCalledTimes(callsBefore)
    })
  })

  describe('Cenário 3: Iniciar modo de seguir com coleira', () => {
    beforeEach(() => {
      // Setup: Bot está na casinha
      voiceService.goToCasinha(testSetup.guild.id)
    })

    it('deve começar a seguir quando usuário pega a coleira', () => {
      // Given: Bot na casinha
      expect(voiceService.isInCasinhaChannel(testSetup.guild.id)).toBe(true)

      // When: Usuário pega a coleira
      voiceService.giveCollar(testSetup.guild.id, 'user-1')

      // Then: Deve marcar que coleira foi pega
      expect(voiceService.isCollarTaken(testSetup.guild.id)).toBe(true)
      expect(voiceService.hasCollar(testSetup.guild.id, 'user-1')).toBe(true)
      expect(voiceService.isInCasinhaChannel(testSetup.guild.id)).toBe(false)
    })
  })

  describe('Cenário 7: Voltar para casinha quando ficar sozinho', () => {
    it('deve voltar para casinha se há pessoas no servidor mas não no canal', () => {
      // Given: Bot está em um canal e ficou sozinho
      const { guild, channels, members } = testSetup

      // Simula que há pessoas em outros canais
      members.user2.voice.channel = channels.channel2
      channels.channel2.members.set(members.user2.user.id, members.user2)

      // When: Bot fica sozinho no canal atual
      voiceService.handleBotAlone(guild.id)

      // Then: Deve voltar para casinha
      const lastCall = mockVoiceModule.joinVoiceChannel.mock.calls.slice(-1)[0]
      expect(lastCall[0].channelId).toBe(channels.casinhaChannel.id)
      expect(voiceService.isInCasinhaChannel(guild.id)).toBe(true)
      expect(voiceService.isCollarTaken(guild.id)).toBe(false)
    })
  })

  describe('Cenário 8: Não voltar se há pessoas no canal', () => {
    it('deve verificar corretamente se está sozinho', () => {
      // Given: Bot em canal com 2 usuários
      const { guild, channels, members } = testSetup

      mockVoiceModule.joinVoiceChannel({
        channelId: channels.channel1.id,
        guildId: guild.id,
        adapterCreator: () => {}
      })

      members.botMember.voice.channel = channels.channel1
      members.user1.voice.channel = channels.channel1
      members.user2.voice.channel = channels.channel1

      channels.channel1.members.set(members.botMember.user.id, members.botMember)
      channels.channel1.members.set(members.user1.user.id, members.user1)
      channels.channel1.members.set(members.user2.user.id, members.user2)

      // When: Verifica se está sozinho
      const isAlone = voiceService.isBotAloneInChannel(guild.id)

      // Then: Não deve estar sozinho
      expect(isAlone).toBe(false)
    })

    it('deve estar sozinho se só houver bots no canal', () => {
      // Given: Canal só com bot
      const { guild, channels, members } = testSetup

      // Criar conexão mockada
      const connection = mockVoiceModule.joinVoiceChannel({
        channelId: channels.channel1.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator
      })

      // Simular que getVoiceConnection retorna a conexão
      mockVoiceModule.getVoiceConnection.mockReturnValue(connection)

      members.botMember.voice.channel = channels.channel1
      channels.channel1.members.set(members.botMember.user.id, members.botMember)

      // When: Verifica se está sozinho
      const isAlone = voiceService.isBotAloneInChannel(guild.id)

      // Then: Deve estar sozinho (ignora bots)
      expect(isAlone).toBe(true)
    })
  })

  describe('Cenário 9: Dormir quando servidor vazio', () => {
    it('deve desconectar e limpar estados quando servidor fica vazio', () => {
      // Given: Bot conectado
      const { guild, channels } = testSetup
      const connection = mockVoiceModule.joinVoiceChannel({
        channelId: channels.channel1.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator
      })

      // Mock getVoiceConnection para retornar a conexão
      mockVoiceModule.getVoiceConnection.mockReturnValue(connection)

      // When: Servidor fica vazio
      voiceService.handleBotAlone(guild.id)

      // Then: Deve desconectar
      expect(connection.destroy).toHaveBeenCalled()
    })
  })

  describe('Cenário 14: Parar de seguir ao voltar para casinha', () => {
    it('deve liberar coleira quando voltar para casinha', () => {
      // Given: Bot está seguindo (usuário tem coleira)
      const { guild } = testSetup
      voiceService.giveCollar(guild.id, 'user-1')
      expect(voiceService.isCollarTaken(guild.id)).toBe(true)

      // When: Volta para casinha (coleira liberada)
      voiceService.releaseCollar(guild.id, 'user-1')

      // Then: Deve parar de seguir
      expect(voiceService.isCollarTaken(guild.id)).toBe(false)
      expect(voiceService.isInCasinhaChannel(guild.id)).toBe(true)
    })
  })

  describe('Cenário 18: Detectar se bot está sozinho', () => {
    it('deve contar apenas humanos ao verificar se está sozinho', () => {
      // Given: Canal com bot e outro bot
      const { guild, channels, members } = testSetup
      const anotherBot = new (members.botMember.constructor as any)('bot-2', 'OtherBot#1234', true)

      const connection = mockVoiceModule.joinVoiceChannel({
        channelId: channels.channel1.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator
      })

      mockVoiceModule.getVoiceConnection.mockReturnValue(connection)

      members.botMember.voice.channel = channels.channel1
      anotherBot.voice.channel = channels.channel1
      channels.channel1.members.set(members.botMember.user.id, members.botMember)
      channels.channel1.members.set(anotherBot.user.id, anotherBot)

      // When: Verifica se está sozinho
      const isAlone = voiceService.isBotAloneInChannel(guild.id)

      // Then: Deve estar sozinho (ignora outros bots)
      expect(isAlone).toBe(true)
    })
  })

  describe('Cenário 19: Detectar usuários no servidor', () => {
    it('deve verificar todos os canais de voz do servidor', () => {
      // Given: Usuário em canal diferente
      const { guild, channels, members } = testSetup

      members.user1.voice.channel = channels.channel2
      channels.channel2.members.set(members.user1.user.id, members.user1)

      // When: Verifica se há usuários no servidor
      const hasUsers = voiceService.hasUsersInVoice(guild as any)

      // Then: Deve detectar usuário
      expect(hasUsers).toBe(true)
    })

    it('deve retornar false se só houver bots', () => {
      // Given: Só bots no servidor
      const { guild, channels, members } = testSetup

      members.botMember.voice.channel = channels.channel1
      channels.channel1.members.set(members.botMember.user.id, members.botMember)

      // When: Verifica se há usuários
      const hasUsers = voiceService.hasUsersInVoice(guild as any)

      // Then: Não deve contar bots
      expect(hasUsers).toBe(false)
    })
  })
})
