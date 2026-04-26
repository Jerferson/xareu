import { User } from '@prisma/client'
import { MOOD, Mood } from '../config/constants'
import { daysSince } from '../utils/helpers'

export interface MoodContext {
  affinity: number
  daysSinceLastInteraction: number
  recentInteractions: number
}

/**
 * Decide o humor do Xaréu para um usuário.
 * Critérios prioritários (top → bottom):
 *  1. Sem interagir há 7+ dias → dormindo
 *  2. Afinidade alta + muitas interações recentes → animado
 *  3. Afinidade alta sem interação recente → carente
 *  4. Afinidade muito baixa → bravo
 *  5. Afinidade alta → feliz
 *  6. caso contrário → neutro
 */
export class MoodService {
  decide(ctx: MoodContext): Mood {
    if (ctx.daysSinceLastInteraction >= 7) return MOOD.DORMINDO
    if (ctx.affinity >= 70 && ctx.recentInteractions >= 5) return MOOD.ANIMADO
    if (ctx.affinity >= 70 && ctx.daysSinceLastInteraction >= 2) return MOOD.CARENTE
    if (ctx.affinity <= 20) return MOOD.BRAVO
    if (ctx.affinity >= 60) return MOOD.FELIZ
    return MOOD.NEUTRO
  }

  fromUser(user: User, recentInteractions: number): Mood {
    return this.decide({
      affinity: user.affinity,
      daysSinceLastInteraction: daysSince(user.lastInteraction),
      recentInteractions,
    })
  }
}
