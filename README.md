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
  - **Auto-coleira**: quando ninguém tem a coleira, o primeiro a entrar na casinha com afinidade ≥ 50 vira o novo dono
  - **Confiança mínima**: Xaréu só aceita coleira de quem tem **afinidade ≥ 50**
  - **Revalidação contínua**: se a afinidade do dono cair abaixo de 50 (decay temporal), a coleira é anulada automaticamente na próxima movimentação ou ao entrar na casinha — bot volta sozinho pra casinha
- 🔊 **Sons reativos** (alguém entrando no canal onde o bot já está):
  - afinidade < 30 → 🐺 `rosnando.mp3` (volume +80%)
  - afinidade ≥ 30 → 🐕 latido amigável de cumprimento
  - bot **chegando** num canal novo (seguindo alguém) → sempre latido amigável
- 🦴 **Mastiga ao receber petisco** — cada `/petisco` toca `mastigando-crocante.mp3` no canal de voz se o bot estiver conectado
- 🥚 **Novos usuários começam com afinidade 20** — precisam interagir até subir pra ≥ 50 antes de pegar a coleira
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

### Tabela de afinidade

| Ação | Delta | Cooldown |
|---|---|---|
| `/petisco` | +8 | 6h se afinidade ≥ 95 |
| Menção no servidor (responde com IA) | +3 | rate limit 10/min |
| DM longa (vira conversa com IA) | +3 | rate limit 10/min |
| Áudio tocado | +1 | cooldown configurável |
| Entrar em canal de voz | +1 | — |
| Decay diário (passivo) | −2/dia | aplicado on-demand |

**Thresholds**:
- Default de novos usuários: **20**
- Afinidade < **30** → Xaréu rosna ao você entrar no canal dele
- Afinidade < **50** → não consegue pegar a coleira; se já era dono, perde na próxima ação

### IA (OpenAI)
- 💬 Responde **menções no servidor** com personalidade canina
- 💌 **DMs longas** entram no chat com IA, curtinhas viram comando de áudio
- 🧩 Cada prompt inclui afinidade, humor, tags, **resumo do usuário e fatos memorizados**
- ⏳ **Rate limit por usuário** via Redis
- 🧠 **Memória semântica** — após cada conversa relevante, o Xaréu extrai fatos ("gosta de X", "trabalha com Y") e mantém um resumo evolutivo de quem você é
- 🎭 **EmotionEngine** — calcula relação (desconhecido / conhecido / amigo / melhor amigo), intensidade emocional, estilo de resposta e energia antes de chamar a IA — o tom muda de acordo

### Comandos
| Slash | O que faz |
|---|---|
| `/help` | Mostra comandos + lista de áudios |
| `/play <busca>` | Toca áudio com **autocomplete inteligente** — sugere até 25 áudios filtrados por substring em qualquer posição (ex: `ria` casa `ria-de-mim`, `padaria`, `queria`) |
| `/petisco` | Ganha afinidade + toca som de mastigando no canal de voz |
| `/coleira pegar\|passar\|largar\|quem` | Gerencia o dono — `pegar`/`passar` movem o bot na hora; `largar` volta pra casinha |
| `/status` | Mostra sua relação com o Xaréu |
| `/config casinha\|volume\|cooldown\|ai\|ver` | Configurações (admin) |

### Conversação inteligente
- **Mencionar `@Xaréu`** em canal de texto → resposta contextual usando memória + emoção
- **Mencionar `@Xaréu` em reply** de outra mensagem → o bot lê a mensagem original, carrega memória do autor original, e direciona a resposta a essa pessoa (mesmo se você só mandar a menção sem texto adicional)
- **DM** longa → conversa com IA; DM curta → tentativa de tocar áudio

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
│   ├── UserMemoryRepository.ts
│   ├── UserFactRepository.ts
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
│   ├── IntelligenceService.ts    # Memória, afinidade, decay, tags
│   ├── MoodService.ts            # Máquina de estados de humor
│   ├── EmotionEngine.ts          # Relação + estilo + energia + hints (puro)
│   ├── ContextBuilderService.ts  # Monta prompt da IA (personalidade + estado + facts + summary + histórico)
│   ├── MemoryExtractionService.ts # Extrai facts/summary via OpenAI (background)
│   ├── AIService.ts              # OpenAI + rate limit + fallback
│   └── CommandService.ts         # DMs e menções
│
├── handlers/
│   ├── MessageHandler.ts
│   ├── VoiceStateHandler.ts
│   └── InteractionHandler.ts # Roteia chatInput + autocomplete
│
├── commands/                 # Slash commands (alguns com autocomplete)
│   ├── HelpCommand.ts
│   ├── PlayCommand.ts        # com autocomplete fuzzy
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
  ├─ Interaction[] (type, message, response, metadata)
  ├─ UserMemory (summary, lastUpdatedAt) — 1:1
  └─ UserFact[] (fact, confidence, lastSeenAt)

GuildConfig (casinhaName, volume, cooldown, aiEnabled, leashOwnerId)
```

### Memória semântica & camada emocional

```
Mensagem do usuário
  ↓
MessageHandler → CommandService.processMention/processDM
  ↓
AIService.respond
  ├─ IntelligenceService.getMemory (afinidade, humor, dias, tags)
  ├─ EmotionEngine.evaluate → { relationship, intensity, style, energy, hints }
  ├─ ContextBuilderService.build → prompt completo (personalidade + estado + facts + summary + histórico)
  └─ OpenAI chat.completions
  ↓
Resposta enviada ao usuário
  ↓ (em background, fire-and-forget)
MemoryExtractionService.process
  ├─ heurística shouldExtract (tamanho + palavras de auto-revelação)
  ├─ OpenAI com response_format json_object → { new_facts, updated_summary, confidence }
  ├─ validação Zod
  └─ persiste em UserFact (dedup) + UserMemory (summary incremental)
```

**EmotionEngine** (puro, sem IA): mapeia afinidade → relação:
- 0–19 → desconhecido (estilo seco, energia baixa)
- 20–49 → conhecido (estilo neutro)
- 50–79 → amigo (estilo amigável)
- 80–100 → melhor amigo (estilo entusiasmado, hint de carinho)

Hints contextuais: saudade (afinidade alta + sumiu há dias), animação (muitas interações recentes), modo "acordando" (sumiu há 7+ dias).

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
- [x] **Memória semântica** (UserMemory + UserFact extraídos via OpenAI)
- [x] **EmotionEngine** (relação, estilo, energia, intensidade)
- [x] **ContextBuilderService** (prompt rico com facts + summary + histórico + emoção)
- [x] **Respostas em reply** — Xaréu lê a mensagem original e responde direcionado ao autor
- [x] **Autocomplete fuzzy no `/play`** — substring em qualquer posição
- [x] Rate limit (Redis)
- [x] Slash commands
- [x] Sistema de coleira (com revalidação contínua de afinidade)
- [x] Petiscos com som
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
