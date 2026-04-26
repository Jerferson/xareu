# 🐶 Xaréu — O Pet Inteligente do Discord

> *"Au au, humano! Cadê minha coleira?"*

**Xaréu v2** é um cachorro virtual com **memória, personalidade e relacionamento individual**. Ele reage a você baseado em quanto vocês interagem, lembra das conversas e usa IA pra responder no servidor e no DM.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.js.org/)
[![Postgres](https://img.shields.io/badge/Postgres-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://platform.openai.com/)

---

## 🦴 O que ele faz

### Voz
- 🏠 **Casinha** — espera os humanos num canal específico (configurável por servidor) e dorme quando o servidor fica vazio
- 🐕 **Modo seguir** — acompanha o dono da coleira entre canais; o `joinVoiceChannel` aguarda o estado `Ready` antes de tocar áudio (sem latido cortado)
- 🎵 **96 áudios** na biblioteca + **latido periódico** (mesmo som, intervalo aleatório de 10/25/30/45/50 min)
- 🎀 **Coleira inteligente**:
  - `/coleira pegar` — bot vai até você na hora
  - `/coleira passar @x` — bot vai até x
  - `/coleira largar` — bot volta pra casinha imediatamente
  - **Auto-coleira**: quando ninguém tem a coleira, o primeiro a entrar na casinha vira o novo dono automaticamente
  - **Confiança mínima**: Xaréu só obedece quem tem **afinidade ≥ 50** — abaixo disso ele rosna; ganhe confiança com `/petisco` ou conversando com ele
- 🐺 **Rosna pra desconhecidos** — quem tem afinidade < 30 escuta `rosnando.mp3` em vez do latido quando o Xaréu entra no canal
- 🥚 **Novos usuários começam com afinidade 20** — precisam interagir um pouco antes de cair nas graças do Xaréu
- 🪃 **Debouncing de 600ms** — trocas rápidas de canal não disparam o erro `IP discovery - socket closed`
- ♻️ **State recovery** — se o processo reiniciar, o bot infere a partir do canal atual se está na casinha ou seguindo
- ⏱️ **Cooldown por usuário** — sem spam de áudio
- 🔊 **Volume configurável por servidor**

### Memória e personalidade
- 🧠 **Afinidade 0-100** por usuário, com **decay diário** automático
- 🐾 **Humor dinâmico**: feliz · animado · carente · bravo · dormindo · neutro
- 🏷️ **Tags automáticas**: amigavel, ignora, brinca-muito, novato, antigo, carente
- 🦴 **Petiscos** dão afinidade extra (`/petisco`)
- 📖 **Histórico** de cada interação salvo no Postgres

### IA (OpenAI)
- 💬 Responde **menções no servidor** com personalidade canina
- 💌 **DMs longas** entram no chat com IA, curtinhas viram comando de áudio
- 🧩 Cada prompt inclui afinidade, humor, tags e histórico recente do usuário
- ⏳ **Rate limit por usuário** via Redis

### Comandos
| Slash | O que faz |
|---|---|
| `/help` | Mostra comandos + lista de áudios |
| `/play <busca>` | Toca áudio (busca fuzzy) |
| `/petisco` | Ganha afinidade |
| `/coleira pegar\|passar\|largar\|quem` | Gerencia o dono — `pegar`/`passar` movem o bot na hora; `largar` volta pra casinha |
| `/status` | Mostra sua relação com o Xaréu |
| `/config casinha\|volume\|cooldown\|ai\|ver` | Configurações (admin) |

---

## 🚀 Setup

### Pré-requisitos
- Node.js 20+
- Docker + Docker Compose
- Token do Discord ([Developer Portal](https://discord.com/developers/applications))
- Chave da OpenAI (opcional — sem ela o bot usa respostas pré-definidas)

### 1. Clonar e instalar
```bash
git clone <url-do-repo>
cd discord-voice-bot
npm install
cp .env.example .env
# edite .env com seu DISCORD_TOKEN, DISCORD_CLIENT_ID e OPENAI_API_KEY
```

### 2. Subir Postgres + Redis
```bash
npm run docker:up
```
Por padrão, usamos as portas **5434 (Postgres)** e **6381 (Redis)** pra não conflitar com bancos locais. Ajuste em `.env` se precisar.

### 3. Aplicar migrations
```bash
npm run prisma:migrate
```

### 4. Registrar slash commands
```bash
# Globalmente (até 1h de propagação)
npm run commands:register

# Ou pra uma guilda específica (instantâneo)
GUILD_ID=seu_guild_id npm run commands:register
```

### 5. Rodar
```bash
# Dev (hot reload)
npm run dev

# Produção (após build)
npm run build && npm start
```

### Setup do bot no Discord
1. Crie a aplicação em https://discord.com/developers/applications
2. Em **Bot** → Privileged Gateway Intents, ative:
   - `MESSAGE CONTENT INTENT` (necessário pra ler DMs e menções)
3. Convide com permissões `3146752`:
   ```
   https://discord.com/api/oauth2/authorize?client_id=SEU_CLIENT_ID&permissions=3146752&scope=bot%20applications.commands
   ```
4. No servidor, crie um canal de voz com o nome **"Casinha do Xeréu"** (ou customize via `/config casinha <nome>`)

---

## 🐳 Docker (deploy)

Tudo em um comando:
```bash
docker compose --profile bot up -d --build
```
Sobe Postgres, Redis e o bot. As migrations rodam automaticamente no startup.

Logs:
```bash
npm run docker:logs
```

---

## 🏗️ Arquitetura

```
src/
├── Bot.ts                    # Composition root
├── index.ts                  # Entry + graceful shutdown
│
├── config/
│   ├── env.ts                # Validação de env via Zod
│   └── constants.ts          # Constantes de comportamento
│
├── infrastructure/
│   ├── database.ts           # Prisma client (singleton)
│   ├── redis.ts              # Redis client (singleton)
│   └── openai.ts             # OpenAI client (singleton)
│
├── repositories/             # Acesso a dados (Prisma)
│   ├── UserRepository.ts
│   ├── InteractionRepository.ts
│   └── GuildConfigRepository.ts
│
├── events/
│   ├── EventBus.ts           # Pub/sub interno
│   └── types.ts              # Eventos tipados (XareuEvent)
│
├── services/                 # Regra de negócio
│   ├── AudioService.ts       # I/O de áudio (filtro mp3, busca fuzzy)
│   ├── AudioQueueService.ts  # Fila + cooldown por usuário
│   ├── VoiceService.ts       # Conexões de voz (multi-guild)
│   ├── IntelligenceService.ts # Memória, afinidade, decay, tags
│   ├── MoodService.ts        # Máquina de estados de humor
│   ├── AIService.ts          # OpenAI + rate limit + fallback
│   └── CommandService.ts     # DMs e menções
│
├── handlers/
│   ├── MessageHandler.ts
│   ├── VoiceStateHandler.ts
│   └── InteractionHandler.ts # Slash commands
│
├── commands/                 # Slash commands
│   ├── HelpCommand.ts
│   ├── PlayCommand.ts
│   ├── PetiscoCommand.ts
│   ├── ColeiraCommand.ts
│   ├── StatusCommand.ts
│   └── ConfigCommand.ts
│
├── scripts/
│   └── registerCommands.ts   # Registro de slash commands
│
└── utils/
    ├── logger.ts             # Pino estruturado
    └── helpers.ts
```

### Modelo de dados
```
User (afinidade, humor, xp, tags, lastInteraction)
  └─ Interaction[] (type, message, response, metadata)

GuildConfig (casinhaName, volume, cooldown, aiEnabled, leashOwnerId)
```

### Fluxo de uma menção
```
Discord → MessageHandler → CommandService.processMention
  → AIService.respond (consulta IntelligenceService.getMemory)
    → memory: afinidade + humor + tags + histórico
    → OpenAI chat.completions
  → IntelligenceService.recordInteraction (atualiza afinidade/humor/tags)
```

### Robustez da camada de voz
- `joinChannel` é async e usa `entersState(Ready, 10s)`: só toca áudio depois que o gateway de voz confirma — corrige o caso "bot diz que entrou mas Discord ainda mostra ele em outro canal"
- Retry automático destruindo a conexão se o primeiro `Ready` não vier em 10s
- WeakSet rastreia conexões com listeners já anexados — `joinVoiceChannel` reusa o objeto, sem vazamento de listeners
- Debouncing de 600ms no `VoiceStateHandler` — trocas rápidas só processam a última, evitando o erro `Cannot perform IP discovery - socket closed` do `@discordjs/voice`

---

## 🧪 Qualidade

```bash
npm test            # 42 testes
npm run lint        # ESLint flat config
npm run format      # Prettier
npm run build       # tsc strict
```

CI no GitHub Actions roda lint + format + build + test em cada PR.

---

## 🛣️ Roadmap

Implementado:
- [x] Memória por usuário com Postgres
- [x] Afinidade + decay temporal
- [x] Sistema de humor (6 estados)
- [x] IA (OpenAI) com personalidade contextual
- [x] Rate limit (Redis)
- [x] Slash commands
- [x] Sistema de coleira
- [x] Petiscos
- [x] Multi-guild
- [x] Graceful shutdown
- [x] Docker compose
- [x] CI

A explorar:
- [ ] TTS opcional (ElevenLabs/Coqui)
- [ ] Reações com emoji por palavras-chave
- [ ] Sistema de XP / níveis
- [ ] Painel web de admin
- [ ] Truques: senta, rola, finge de morto
- [ ] Pet status assinado em embed (perfil)
- [ ] Modo "Xaréu fala sozinho" — dispara mensagem após X horas sem ninguém

---

## 🤝 Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md). PRs são muito bem-vindos!

**Regras de ouro:**
- Mantenha a personalidade zoeira (sem virar bot corporativo)
- `npm test` deve passar
- `npm run lint` zerado
- Documente se mudou comportamento

---

## 📜 Licença

ISC. Use, modifique, distribua. Só não maltrate o cachorro.

---

🐕 *"A vida é melhor com um Xaréu ao seu lado"*
