/**
 * Eventos internos do Xaréu (alimentam memória, humor e decisões).
 */

export type XareuEvent =
  | { type: 'voice.user.joined'; guildId: string; userId: string; channelId: string; channelName: string }
  | { type: 'voice.user.left'; guildId: string; userId: string }
  | { type: 'voice.user.entered_casinha'; guildId: string; userId: string }
  | { type: 'message.dm.received'; userId: string; content: string }
  | { type: 'message.mention.received'; guildId: string; userId: string; channelId: string; content: string }
  | { type: 'audio.played'; guildId: string; userId: string; audioName: string }
  | { type: 'petisco.given'; guildId: string; userId: string }
  | { type: 'user.ignored'; userId: string }

export type XareuEventType = XareuEvent['type']
