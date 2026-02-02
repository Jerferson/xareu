# 🏗️ Arquitetura do Xaréu Bot

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.ts (Entry Point)                   │
│                     Inicializa e executa o bot                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Bot.ts                                 │
│                   Classe Principal do Bot                        │
│  - Configura Discord Client                                      │
│  - Inicializa Services                                           │
│  - Registra Event Handlers                                       │
└─────┬──────────────────────────────────────────────────┬────────┘
      │                                                    │
      │ Cria e injeta                                     │
      ▼                                                    ▼
┌──────────────────────┐                    ┌─────────────────────────┐
│      HANDLERS        │                    │       SERVICES          │
│  Event Processors    │                    │   Business Logic        │
├──────────────────────┤                    ├─────────────────────────┤
│                      │                    │                         │
│ MessageHandler       │◄───────uses───────►│  CommandService         │
│ - handle()           │                    │  - processDM()          │
│                      │                    │  - listAvailableAudios()│
│                      │                    │  - processAudioCommand()│
├──────────────────────┤                    ├─────────────────────────┤
│                      │                    │                         │
│ VoiceStateHandler    │◄───────uses───────►│  VoiceService           │
│ - handle()           │                    │  - joinVoiceChannel()   │
│                      │                    │  - leaveVoiceChannel()  │
│                      │                    │  - handleChannelEntry() │
│                      │                    │  - playAudioByName()    │
└──────────────────────┘                    ├─────────────────────────┤
                                            │                         │
                                            │  AudioService           │
                                            │  - playAudioByName()    │
                                            │  - playEntryAudio()     │
                                            │  - playRandomBark()     │
                                            │  - listAvailableAudios()│
                                            └─────────────────────────┘
                                                        │
                                                        │ uses
                                                        ▼
                                            ┌─────────────────────────┐
                                            │    UTILS & CONFIG       │
                                            ├─────────────────────────┤
                                            │  constants.ts           │
                                            │  - BOT_CONFIG           │
                                            │  - AUDIO_CONFIG         │
                                            ├─────────────────────────┤
                                            │  helpers.ts             │
                                            │  - selectRandomMinute() │
                                            │  - minutesToMs()        │
                                            ├─────────────────────────┤
                                            │  types/index.ts         │
                                            │  - Interfaces           │
                                            │  - Type Definitions     │
                                            └─────────────────────────┘
```

## Fluxo de Dados

### 1. Mensagem DM Recebida
```
Discord Event → Bot.ts → MessageHandler → CommandService → VoiceService/AudioService
                                                              ↓
                                                      Toca áudio no Discord
```

### 2. Usuário Entra no Canal de Voz
```
Discord Event → Bot.ts → VoiceStateHandler → VoiceService → AudioService
                                                  ↓              ↓
                                          Join Channel    Play Entry Audio
                                                  ↓
                                        Schedule Random Barks
```

### 3. Usuário Sai do Canal de Voz
```
Discord Event → Bot.ts → VoiceStateHandler → VoiceService
                                                  ↓
                                          Cancel Timers
                                                  ↓
                                          Leave Channel
```

## Responsabilidades

### 📦 Services (Camada de Negócio)
- **AudioService**: Reprodução, busca e listagem de áudios
- **VoiceService**: Gerencia conexões de voz e ciclo de latidos
- **CommandService**: Processa comandos DM

### 🎯 Handlers (Camada de Apresentação)
- **MessageHandler**: Filtra e processa mensagens
- **VoiceStateHandler**: Detecta mudanças de estado de voz

### ⚙️ Config & Utils
- **constants.ts**: Configurações centralizadas
- **helpers.ts**: Funções utilitárias puras
- **types/**: Definições de tipos TypeScript

### 🤖 Bot.ts
- Orquestra todos os componentes
- Gerencia ciclo de vida
- Dependency Injection

## Princípios de Design

### ✅ SOLID

- **S**ingle Responsibility: Cada classe tem uma única responsabilidade
- **O**pen/Closed: Extensível sem modificar código existente
- **L**iskov Substitution: Services podem ser substituídos por mocks em testes
- **I**nterface Segregation: Interfaces específicas e focadas
- **D**ependency Inversion: Depende de abstrações, não implementações

### 🎯 Separation of Concerns

- **Handlers**: Apenas validam e delegam
- **Services**: Contêm toda lógica de negócio
- **Utils**: Funções puras reutilizáveis
- **Config**: Valores constantes centralizados

### 🔄 Dependency Injection

```typescript
// Exemplo de DI no Bot.ts
this.audioService = new AudioService()
this.voiceService = new VoiceService(this.client, this.audioService)
this.commandService = new CommandService(this.audioService, this.voiceService)
```

Facilita testes e manutenção!

## Vantagens da Arquitetura

1. **Testabilidade** 🧪
   - Cada classe pode ser testada isoladamente
   - Fácil criar mocks e stubs

2. **Manutenibilidade** 🔧
   - Código organizado e previsível
   - Mudanças localizadas em módulos específicos

3. **Escalabilidade** 📈
   - Adicionar features não quebra código existente
   - Fácil estender com novos serviços

4. **Legibilidade** 📖
   - Estrutura clara e intuitiva
   - Nomenclatura consistente

5. **Colaboração** 🤝
   - Múltiplos desenvolvedores podem trabalhar simultaneamente
   - Conflitos de merge minimizados

## Próximos Passos

- [ ] Adicionar testes unitários
- [ ] Implementar logger estruturado
- [ ] Adicionar validação de schemas
- [ ] Criar sistema de plugins
- [ ] Implementar cache de áudios
