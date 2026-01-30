# 🐶 Xaréu — O Cachorro Mais Zoeiro do Discord

<div align="center">

### *"Au au, humano! Cadê minha coleira?"*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

**Um cachorrinho multicultural 🌍 que transforma seu servidor Discord em uma verdadeira bagunça organizada**

[Funcionalidades](#-o-que-o-xaréu-faz-hoje) • [Personalidade](#-conhecendo-o-xaréu) • [Instalação](#-como-adotar-o-xaréu) • [Roadmap](#-roadmap) • [Contribuir](#-contribuições)

</div>

---

## 🦴 Conhecendo o Xaréu

Xaréu não é só um bot — é **O PET** do seu servidor Discord.

Ele é aquele cachorro que:
- 🐕 **Não larga do seu pé** (literalmente entra onde você entra)
- 🤪 **Zoeiro profissional** (late na hora errada, mas do jeito certo)
- 👥 **Sociável demais** (odeia ficar sozinho na casinha)
- � **Multicultural** (mistura referências e memes de várias culturas)
- 🧠 **Em evolução** (cada dia aprende uma arte nova)

### ⚠️ Aviso aos donos de primeira viagem:
> Xaréu não é um daqueles bots certinhos que ficam parados esperando comandos.
> Ele late, acompanha, faz barulho e PARTICIPA da conversa.
> Se você quer um bot "profissional", talvez o Xaréu não seja pra você... 😏

---

## 🔊 O que o Xaréu faz hoje

### 🎧 Sistema de Acompanhamento (a.k.a "Colado em você")

```
Você entra → Xaréu entra 🐕
Você sai → Xaréu sai 👋
Você muda de canal → Xaréu muda junto 🏃‍♂️
```

É tipo aquele cachorro que te segue até no banheiro. Sim, é exatamente isso.

### 🐶 Sons e Reações

- 🎵 **Late ao entrar** (porque educação é importante)
- 🎲 **Late aleatoriamente** (intervalos de 10, 30, 45 ou 50 minutos)
- 🔊 **Áudios personalizados** de até 5 segundos (manda um DM pra ele!)

### 💬 Comandos via DM

Manda uma DM pro Xaréu com:
- `help` → Lista TODOS os sons que ele sabe fazer
- `nome-do-audio` → Toca o áudio no canal onde ele tá

**🎯 Busca Inteligente™** (valeu @joseildofilho!)
```
Você: "latido"
Xaréu: 🔍 Achou "latido-unico.mp3"
```
Não precisa mais decorar nome exato. O Xaréu te entende! 🧠

---

## 🦈 A Personalidade Única do Xaréu

### Filosofia de Vida:
1. **Zoar, mas com respeito** 😎
2. **Presente, mas não invasivo** (tá bom, talvez um pouquinho)
3. **Valoriza a matilha** 🐺

### Comportamento Adaptativo (em breve):
No futuro, Xaréu vai:
- Latir mais pra quem brinca mais com ele
- Ficar quietinho quando perceber que ninguém tá afim
- Desenvolver personalidades únicas por servidor

**É tipo ter um Tamagotchi, mas melhor e mais peludo** 🦴

---

## 🛣️ Roadmap (O que vem por aí)

### 🏠 A Casinha do Xaréu
```typescript
// Nova funcionalidade:
canal_fixo: "casinha-do-xareu"
comando: "!vem_ca_xareu"
comportamento: Xaréu sai da casinha e vai até você
```
Finalmente o bichinho vai ter um cantinho dele! 🏡

### 🦮 Sistema de Coleira
```
🎯 Quem tem a coleira = dono oficial do Xaréu
📌 Xaréu segue APENAS quem tá com a coleira
🔄 Coleira pode ser passada pra outra pessoa
⏰ Só pode ter a coleira se estiver online
```

Disputa de coleira = novo meta do servidor 😂

### 💤 Modo Descanso
```
Bot iniciado → Xaréu na casinha 😴
Alguém chama → Xaréu acorda e vai correndo 🏃
Timeout → Volta pra casinha automaticamente
```

Porque até cachorro virtual precisa dormir.

### 🎮 Futuras Features Loucas
- [ ] Sistema de fome (precisa de petiscos virtuais)
- [ ] Humor baseado em interações
- [ ] Easter eggs secretos
- [ ] Reações a palavras-chave
- [ ] Sistema de truques (senta, rola, finge de morto)

*Tá maluco? Abre uma Issue e vamos conversar!* 💭

---

## 🚀 Como Adotar o Xaréu

### Pré-requisitos
```bash
Node.js 18+ (o Xaréu é moderno)
npm ou yarn (escolha seu veneno)
Token do Discord (obviamente)
```

### Instalação
```bash
# Clone o repositório
git clone https://github.com/seu-usuario/discord-voice-bot.git
cd discord-voice-bot

# Instale as dependências
npm install

# Configure o .env
echo "DISCORD_TOKEN=seu_token_aqui" > .env

# Solte o Xaréu!
npm run dev
```

### Configuração do Bot no Discord
1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma aplicação
3. Ative estes intents:
   - ✅ `MESSAGE CONTENT INTENT`
   - ✅ `GUILD VOICE STATES`
   - ✅ `GUILD MESSAGES`
4. Gere o token e cole no `.env`
5. Use este link de convite:
```
https://discord.com/api/oauth2/authorize?client_id=SEU_CLIENT_ID&permissions=3146752&scope=bot
```

### 📁 Adicionando Áudios
```bash
# Cole seus arquivos .mp3 em:
audios/
  ├── latido-unico.mp3
  ├── bem-ti-vi.mp3
  └── seu-audio-legal.mp3
```

**Dica:** Áudios de até 5 segundos funcionam melhor! 🎵

---

## 🤝 Contribuições

**O Xaréu cresce melhor quando treinado em grupo!** 🐕‍🦺

### Como Contribuir:
1. 🍴 Dê um fork no projeto
2. 🌿 Crie uma branch (`git checkout -b feature/truque-novo`)
3. 💻 Faça suas mudanças
4. ✅ Commit (`git commit -m 'Ensinei o Xaréu a dar cambalhota'`)
5. 📤 Push (`git push origin feature/truque-novo`)
6. 🎯 Abra um Pull Request

### ⚠️ Regras de Ouro para Manter o Xaréu sendo Xaréu:

**1. 🎭 Personalidade Inegociável**
- ✨ Mantenha o tom zoeiro e descontraído
- 🐕 Xaréu late, brinca e zoa — isso é essencial
- 🚫 Nada de transformar ele num bot "profissional" e sem graça
- 💛 Funcionalidades novas devem ter a cara dele

**2. 🧪 Teste Antes de Soltar o Bichinho**
- ✅ Compile o projeto (`npm run build`)
- 🎮 Teste localmente (`npm run dev`)
- 🐛 Ninguém quer um Xaréu bugado latindo errado

**3. 📝 Documente Como Se Fosse Pro Seu Amigo**
- 💬 Seja descritivo nos PRs
- 🤓 Use os arquivos de documentação quando necessário
- 🎯 Explique PORQUÊ você fez aquela mudança

### 📚 Documentação para Contribuidores
- 📖 [CONTRIBUTING.md](CONTRIBUTING.md) - Guia completo de contribuição e padrões de código
- 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitetura detalhada do projeto

**Issues são bem-vindas!** Label `idea` para sugestões malucas 🚀

---

## 🧑‍💻 Contribuidores

**A matilha que treina o Xaréu:**

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/joseildofilho">
        <img src="https://github.com/joseildofilho.png" width="100px;" alt=""/>
        <br />
        <sub><b>@joseildofilho</b></sub>
      </a>
      <br />
      <sub>🎯 Busca inteligente de áudios</sub>
    </td>
    <td align="center">
      <a href="#">
        <img src="https://via.placeholder.com/100/808080/FFFFFF?text=YOU" width="100px;" alt=""/>
        <br />
        <sub><b>Você?</b></sub>
      </a>
      <br />
      <sub>🦴 Próximo treinador</sub>
    </td>
  </tr>
</table>

**Quer ver sua foto aqui? Bora contribuir!** 🐾

---

## 📊 Stats do Projeto

```typescript
const xareu = {
  linhasCode: 300+,
  latidosPorDia: '∞',
  zueirasImplementadas: 'Muitas',
  felicidadeGerada: 'Máxima 🎉'
}
```

---

## 📜 Licença

Este projeto é **open-source** e livre como um cachorro sem coleira.

```
Use ✅
Modifique ✅
Distribua ✅
Contribua ✅
Deixe o Xaréu sozinho ❌
```

---

<div align="center">

### 🐕 *"A vida é melhor com um Xaréu ao seu lado"*

**Made with 💛 and many 🦴 by the community**

[⬆ Voltar ao topo](#-xaréu--o-cachorro-mais-zoeiro-do-discord)

</div>
