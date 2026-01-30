# 🤝 Guia de Contribuição - Xaréu Bot

Obrigado por considerar contribuir com o Xaréu! Este guia vai te ajudar a entender a arquitetura do projeto e como fazer contribuições de qualidade.

## 📋 Índice
- [Arquitetura do Projeto](#arquitetura-do-projeto)
- [Padrões de Código](#padrões-de-código)
- [Como Adicionar Novas Features](#como-adicionar-novas-features)
- [Testando Suas Mudanças](#testando-suas-mudanças)

## 🏗️ Arquitetura do Projeto

### Estrutura de Diretórios

```
src/
├── config/          # Configurações e constantes
├── services/        # Lógica de negócio
├── handlers/        # Event handlers do Discord
├── utils/           # Funções utilitárias
├── types/           # Tipos TypeScript
├── Bot.ts           # Classe principal
└── index.ts         # Ponto de entrada
```

### Princípios Aplicados

- **Single Responsibility**: Cada classe tem uma única responsabilidade
- **Dependency Injection**: Serviços são injetados via construtor
- **Separation of Concerns**: Handlers delegam para Services
- **Immutability**: Constantes são readonly quando possível

## 📝 Padrões de Código

### Nomenclatura

```typescript
// Classes: PascalCase
class AudioService {}

// Métodos e variáveis: camelCase
playRandomBark()
const audioPath = '...'

// Constantes: UPPER_SNAKE_CASE
const AUDIO_TIME_LIMIT_MS = 5000

// Interfaces: PascalCase com prefixo I (opcional)
interface ActiveConnectionResult {}
```

### Comentários

Use JSDoc para documentar classes e métodos públicos:

```typescript
/**
 * Toca um áudio específico pelo nome
 * @param audioName Nome do áudio a ser tocado
 * @param connection Conexão de voz ativa
 * @param timeLimitMs Tempo limite em milissegundos
 */
playAudioByName(audioName: string, connection: VoiceConnection, timeLimitMs: number = 5000): void {
  // implementação
}
```

### Tratamento de Erros

Sempre use try-catch em operações que podem falhar:

```typescript
try {
  const files = fs.readdirSync(audiosDir)
  // ...
} catch (error) {
  console.error('❌ Erro ao listar áudios:', error)
  return []
}
```

## 🚀 Como Adicionar Novas Features

### 1. Adicionando um Novo Serviço

```typescript
// src/services/NomeDoService.ts
export class NomeDoService {
  private dependency: OutroService

  constructor(dependency: OutroService) {
    this.dependency = dependency
  }

  metodoPublico(): void {
    // implementação
  }

  private metodoPrivado(): void {
    // implementação
  }
}
```

Depois, injete no Bot.ts:

```typescript
// src/Bot.ts
this.nomeDoService = new NomeDoService(this.outroDependencia)
```

### 2. Adicionando um Novo Handler

```typescript
// src/handlers/NomeHandler.ts
import { EventType } from 'discord.js'
import { Service } from '../services/Service'

export class NomeHandler {
  private service: Service

  constructor(service: Service) {
    this.service = service
  }

  handle(event: EventType): void {
    // Valida entrada
    // Delega para serviço
  }
}
```

Registre no Bot.ts:

```typescript
// src/Bot.ts
this.client.on('nomeEvento', (data) => this.nomeHandler.handle(data))
```

### 3. Adicionando Novas Constantes

```typescript
// src/config/constants.ts
export const NOVA_CONFIG = {
  VALOR_1: 'algo',
  VALOR_2: 100,
} as const
```

## 🧪 Testando Suas Mudanças

### Antes de Commitar

1. **Compile o projeto**
```bash
npm run build
```

2. **Execute localmente**
```bash
npm run dev
```

3. **Teste as funcionalidades**
- Entre em um canal de voz
- Envie DMs para o bot
- Verifique os logs no console

### Checklist de PR

- [ ] Código compila sem erros
- [ ] Funcionalidade testada localmente
- [ ] Comentários JSDoc adicionados
- [ ] Constantes extraídas (não hardcoded)
- [ ] Console.log com emojis apropriados 😄
- [ ] README atualizado (se necessário)

## 💡 Exemplos de Contribuições

### Feature Simples: Novo Comando DM

```typescript
// src/services/CommandService.ts
async processDM(message: Message): Promise<void> {
  const command = message.content.trim().toLowerCase()

  if (command === 'help') {
    await this.listAvailableAudios(message)
    return
  }

  // NOVO COMANDO
  if (command === 'status') {
    await this.showStatus(message)
    return
  }

  await this.processAudioCommand(message, command)
}

private async showStatus(message: Message): Promise<void> {
  const { connection, guildName } = await this.voiceService.findActiveConnection()
  if (connection) {
    await message.reply(`🟢 Conectado em: ${guildName}`)
  } else {
    await message.reply('🔴 Não conectado em nenhum servidor')
  }
}
```

### Feature Complexa: Sistema de Personalidade

1. Crie um novo serviço: `PersonalityService.ts`
2. Adicione configurações em `constants.ts`
3. Injete no `Bot.ts`
4. Use nos handlers existentes

## 🎨 Convenções de Emojis

Use emojis consistentes nos logs:

- 🤖 Bot events (login, ready)
- 🔔 Message received
- 📨 DM received
- 🎧 Voice channel join
- 👋 Voice channel leave
- 🔊 Audio playing
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 🔍 Search/Find
- ⏭️ Skip/Ignore

## 📚 Recursos Úteis

- [Discord.js Docs](https://discord.js.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## 🐕 Mantenha o Espírito do Xaréu!

Lembre-se: o Xaréu é zoeiro, mas organizado. Suas contribuições devem:
- Ser divertidas mas não invasivas
- Adicionar valor sem complicar
- Manter a personalidade multicultural e descontraída do bot

---

**Dúvidas?** Abra uma Issue ou entre em contato! 🦴
