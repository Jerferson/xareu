import { EventEmitter } from 'node:events'
import { logger } from '../utils/logger'
import { XareuEvent, XareuEventType } from './types'

type Handler<T extends XareuEventType> = (event: Extract<XareuEvent, { type: T }>) => void | Promise<void>

export class EventBus {
  private readonly emitter = new EventEmitter({ captureRejections: true })

  constructor() {
    this.emitter.setMaxListeners(50)
    this.emitter.on('error', (err) => logger.error({ err }, 'EventBus handler error'))
  }

  on<T extends XareuEventType>(type: T, handler: Handler<T>): void {
    this.emitter.on(type, (event) => {
      Promise.resolve(handler(event as Extract<XareuEvent, { type: T }>)).catch((err) =>
        logger.error({ err, type }, 'EventBus async handler error'),
      )
    })
  }

  emit(event: XareuEvent): void {
    logger.debug({ event }, 'event emitted')
    this.emitter.emit(event.type, event)
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}
