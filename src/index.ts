import 'dotenv/config'
import { Client, GatewayIntentBits, Partials, Message, VoiceState, VoiceConnection } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, getVoiceConnections, AudioPlayer } from '@discordjs/voice'
import { join } from 'path'
import * as fs from 'fs'
import { StringUtils } from 'turbocommons-ts'
import stringSimilarity from 'string-similarity-js'

// ==================== CONSTANTES ====================

const MINUTOS_LATIDOS_ALEATORIOS = [10, 25, 30, 45, 50]
const TEMPO_LIMITE_AUDIO_MS = 5000
const TEMPO_ESPERA_ENTRADA_MS = 2000
const URL_INVITE = 'https://discord.com/api/oauth2/authorize?client_id=1466193686542028982&permissions=3146752&scope=bot'

// ==================== ESTADO GLOBAL ====================

const timersLatidosPorGuild = new Map<string, NodeJS.Timeout>()

// ==================== FUNÇÕES UTILITÁRIAS ====================

function selecionarMinutoAleatorio(): number {
  const indice = Math.floor(Math.random() * MINUTOS_LATIDOS_ALEATORIOS.length)
  return MINUTOS_LATIDOS_ALEATORIOS[indice]
}

function converterMinutosParaMilissegundos(minutos: number): number {
  return minutos * 60 * 1000
}

function criarPlayerComLimiteDeTempo(
  audioPath: string,
  connection: VoiceConnection,
  limiteTempoMs: number,
  aoFinalizar?: () => void
): AudioPlayer {
  const player = createAudioPlayer()
  const resource = createAudioResource(audioPath)

  player.play(resource)
  connection.subscribe(player)

  const stopTimer = setTimeout(() => {
    if (player.state.status !== AudioPlayerStatus.Idle) {
      console.log(`⏱️  Áudio interrompido (limite de ${limiteTempoMs}ms)`)
      player.stop()
    }
  }, limiteTempoMs)

  player.on(AudioPlayerStatus.Idle, () => {
    clearTimeout(stopTimer)
    console.log('✅ Áudio finalizado')
    if (aoFinalizar) aoFinalizar()
  })

  player.on('error', (error) => {
    clearTimeout(stopTimer)
    console.error('❌ Erro ao tocar áudio:', error)
    if (aoFinalizar) aoFinalizar()
  })

  return player
}

// ==================== FUNÇÕES DE ÁUDIO ====================

function tocarAudioDeEntrada(guildId: string, connection: VoiceConnection): void {
  console.log('🔊 Tocando latido de entrada...')

  const audioPath = join(__dirname, '../audios/latido-unico.mp3')

  criarPlayerComLimiteDeTempo(audioPath, connection, TEMPO_LIMITE_AUDIO_MS, () => {
    iniciarCicloDeLatidosAleatorios(guildId, connection)
  })
}

function tocarLatidoAleatorio(guildId: string, connection: VoiceConnection): void {
  console.log('🐕 Tocando latido aleatório...')

  const audioPath = join(__dirname, '../audios/latido-unico.mp3')

  criarPlayerComLimiteDeTempo(audioPath, connection, TEMPO_LIMITE_AUDIO_MS, () => {
    agendarProximoLatido(guildId, connection)
  })
}

function tocarAudioPorNome(
  audioName: string,
  connection: VoiceConnection,
  limiteTempoMs: number = 5000
): void {
  const audiosFolder = join(__dirname, `../audios/`)
  const audioFiles = fs.readdirSync(audiosFolder)
    .map((file) => {
      const bootstrap = file.includes(audioName) ? 100 : 0
      const metric = bootstrap + stringSimilarity(audioName, file.replace(/\D/, ''))
        return { file, distance:  metric}
    })
    .sort((o1, o2) => o1.distance - o2.distance);

  console.log(audioFiles)

  const audioFilePath = join(audiosFolder, audioFiles.pop()?.file!)
  console.log(`🎵 Tocando áudio: ${audioFilePath}.mp3`)
  criarPlayerComLimiteDeTempo(audioFilePath!, connection, limiteTempoMs)
}

// ==================== GERENCIAMENTO DE LATIDOS ====================

function agendarProximoLatido(guildId: string, connection: VoiceConnection): void {
  const minutos = selecionarMinutoAleatorio()
  const milissegundos = converterMinutosParaMilissegundos(minutos)

  console.log(`⏰ Próximo latido em ${minutos} minuto(s)`)

  const timer = setTimeout(() => {
    tocarLatidoAleatorio(guildId, connection)
  }, milissegundos)

  timersLatidosPorGuild.set(guildId, timer)
}

function iniciarCicloDeLatidosAleatorios(guildId: string, connection: VoiceConnection): void {
  agendarProximoLatido(guildId, connection)
}

function cancelarLatidosAgendados(guildId: string): void {
  const timer = timersLatidosPorGuild.get(guildId)
  if (timer) {
    clearTimeout(timer)
    timersLatidosPorGuild.delete(guildId)
    console.log('   ⏹️  Timer de latido cancelado')
  }
}

// ==================== COMANDOS DM ====================

async function listarAudiosDisponiveis(message: Message): Promise<void> {
  console.log('📋 Comando help recebido')

  const fs = await import('fs')
  const audiosDir = join(__dirname, '../audios')

  try {
    const arquivos = fs.readdirSync(audiosDir)
    const arquivosMp3 = arquivos.filter(arquivo => arquivo.endsWith('.mp3'))

    if (arquivosMp3.length === 0) {
      await message.reply('📂 Nenhum áudio encontrado!')
      return
    }

    const listaAudios = arquivosMp3
      .map(arquivo => arquivo.replace('.mp3', ''))
      .join('\n• ')

    await message.reply(
      `🎵 **Áudios disponíveis:**\n• ${listaAudios}\n\n💡 Digite o nome do áudio para tocar!`
    )
  } catch (error) {
    console.error('❌ Erro ao listar áudios:', error)
    await message.reply('❌ Erro ao listar áudios disponíveis!')
  }
}

async function buscarConexaoAtiva(): Promise<{ connection: VoiceConnection | null, guildName: string }> {
  const connections = getVoiceConnections()

  for (const [guildId, voiceConnection] of connections) {
    const guild = client.guilds.cache.get(guildId)
    const guildName = guild?.name || 'Desconhecido'
    console.log(`🔍 Conexão encontrada no servidor: ${guildName}`)
    return { connection: voiceConnection, guildName }
  }

  return { connection: null, guildName: '' }
}

async function processarComandoAudio(message: Message, audioName: string): Promise<void> {
  const { connection, guildName } = await buscarConexaoAtiva()

  if (!connection) {
    console.log('⏭️  Bot não está em nenhum canal de voz')
    await message.reply('❌ Não estou conectado em nenhum canal de voz no momento!')
    return
  }

  await message.reply(`🔊 Tocando "${audioName}.mp3"`)

  tocarAudioPorNome(audioName, connection, 5000)
}

// ==================== GERENCIAMENTO DE VOZ ====================

function entrarNoCanalDeVoz(voiceChannel: any): VoiceConnection {
  console.log(`🎧 Entrando no canal: ${voiceChannel.name}`)

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  })

  connection.on('error', (error) => {
    console.error('❌ Erro na conexão de voz:', error)
  })

  return connection
}

function sairDoCanalDeVoz(guildId: string): void {
  console.log('   👋 Usuário saiu do canal - bot também vai sair')

  cancelarLatidosAgendados(guildId)

  const connection = getVoiceConnection(guildId)
  if (connection) {
    connection.destroy()
    console.log('   ✅ Bot desconectado')
  }
}

function lidarComEntradaNoCanal(voiceChannel: any, guildId: string): void {
  console.log('   ✅ Usuário entrou no canal')

  try {
    const connection = entrarNoCanalDeVoz(voiceChannel)

    setTimeout(() => {
      tocarAudioDeEntrada(guildId, connection)
    }, TEMPO_ESPERA_ENTRADA_MS)
  } catch (error) {
    console.error('❌ Erro ao entrar no canal:', error)
  }
}

// ==================== HANDLERS DE EVENTOS ====================

async function handleMensagemRecebida(message: Message): Promise<void> {
  const tipoMensagem = message.guild?.name || 'DM'
  console.log(
    `🔔 Mensagem recebida! Guild: ${tipoMensagem} | ` +
    `Autor: ${message.author.tag} | Bot: ${message.author.bot} | ` +
    `Conteúdo: "${message.content}"`
  )

  if (message.author.bot) {
    console.log('   ⏭️  Ignorando: mensagem de bot')
    return
  }

  if (!message.content.trim()) {
    console.log('   ⏭️  Ignorando: mensagem vazia')
    return
  }

  if (!message.guild) {
    console.log(`📨 DM recebida de ${message.author.tag}: "${message.content}"`)

    const comando = message.content.trim().toLowerCase()

    if (comando === 'help') {
      await listarAudiosDisponiveis(message)
      return
    }

    await processarComandoAudio(message, comando)
    return
  }

  console.log(`⏭️  Mensagem de servidor ignorada: "${message.content}"`)
}

function handleMudancaEstadoVoz(oldState: VoiceState, newState: VoiceState): void {
  console.log('📢 VoiceStateUpdate detectado!')
  console.log(`   Usuário: ${newState.member?.user.tag}`)
  console.log(`   Bot?: ${newState.member?.user.bot}`)
  console.log(`   Canal antigo: ${oldState.channel?.name || 'nenhum'}`)
  console.log(`   Canal novo: ${newState.channel?.name || 'nenhum'}`)

  if (newState.member?.user.bot) {
    console.log('   ⏭️  Ignorando bot')
    return
  }

  const usuarioSaiuDoCanal = oldState.channel && !newState.channel
  if (usuarioSaiuDoCanal) {
    sairDoCanalDeVoz(oldState.guild.id)
    return
  }

  const usuarioEntrouOuMudouCanal = newState.channel && newState.channelId !== oldState.channelId
  if (usuarioEntrouOuMudouCanal) {
    lidarComEntradaNoCanal(newState.channel, newState.guild.id)
    return
  }

  console.log('   ⏭️  Nenhuma ação necessária')
}

function handleBotPronto(): void {
  console.log(`🤖 Bot logado como ${client.user?.tag}`)
  console.log(`📊 Servidores conectados: ${client.guilds.cache.size}`)

  client.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id})`)
  })

  console.log('\n⏳ Aguardando eventos de voz...\n')
}

// ==================== CONFIGURAÇÃO DO CLIENTE ====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
})

// ==================== REGISTRO DE EVENTOS ====================

client.once('clientReady', handleBotPronto)
client.on('error', (error) => console.error('❌ Erro no cliente:', error))
client.on('warn', (info) => console.warn('⚠️  Aviso:', info))
client.on('messageCreate', handleMensagemRecebida)
client.on('voiceStateUpdate', handleMudancaEstadoVoz)

// ==================== INICIALIZAÇÃO ====================

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN não encontrado no arquivo .env')
}

client.login(process.env.DISCORD_TOKEN)
