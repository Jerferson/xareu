import { GuildConfigRepository } from '../repositories/GuildConfigRepository'
import { AIService } from '../services/AIService'
import { AudioQueueService } from '../services/AudioQueueService'
import { AudioService } from '../services/AudioService'
import { EmotionEngine } from '../services/EmotionEngine'
import { IntelligenceService } from '../services/IntelligenceService'
import { VoiceService } from '../services/VoiceService'
import { EventBus } from '../events/EventBus'
import { ColeiraCommand } from './ColeiraCommand'
import { ConfigCommand } from './ConfigCommand'
import { HelpCommand } from './HelpCommand'
import { PetiscoCommand } from './PetiscoCommand'
import { PlayCommand } from './PlayCommand'
import { StatusCommand } from './StatusCommand'
import { XareuCommand } from './types'

export interface CommandDeps {
  audioService: AudioService
  audioQueue: AudioQueueService
  voiceService: VoiceService
  intelligence: IntelligenceService
  emotionEngine: EmotionEngine
  guildConfigRepo: GuildConfigRepository
  aiService: AIService
  eventBus: EventBus
}

export function buildCommands(deps: CommandDeps): Map<string, XareuCommand> {
  const cmds: XareuCommand[] = [
    new HelpCommand(),
    new PlayCommand(
      deps.audioService,
      deps.audioQueue,
      deps.voiceService,
      deps.intelligence,
      deps.guildConfigRepo,
    ),
    new PetiscoCommand(deps.intelligence, deps.audioQueue, deps.voiceService),
    new ColeiraCommand(deps.guildConfigRepo, deps.voiceService, deps.intelligence),
    new StatusCommand(deps.intelligence, deps.emotionEngine),
    new ConfigCommand(deps.guildConfigRepo, deps.voiceService),
  ]
  const map = new Map<string, XareuCommand>()
  for (const c of cmds) map.set(c.data.name, c)
  return map
}

export type { XareuCommand } from './types'
