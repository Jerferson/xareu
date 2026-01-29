import 'dotenv/config'
import { Client, GatewayIntentBits } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice'
import { join } from 'path'
// https://discord.com/api/oauth2/authorize?client_id=1466193686542028982&permissions=3146752&scope=bot

// Array de minutos para intervalos aleatórios
const MINUTOS_ALEATORIOS = [1, 2, 3, 4]

// Map para armazenar os timers ativos por guild
const timersAtivos = new Map<string, NodeJS.Timeout>()

// Função para tocar o latido aleatoriamente
function agendarLatidoAleatorio(guildId: string, connection: any) {
  // Seleciona um minuto aleatório
  const minutos = MINUTOS_ALEATORIOS[Math.floor(Math.random() * MINUTOS_ALEATORIOS.length)]
  const milissegundos = minutos * 60 * 1000

  console.log(`⏰ Próximo latido em ${minutos} minuto(s)`)

  const timer = setTimeout(() => {
    console.log('🐕 Tocando latido aleatório...')

    const player = createAudioPlayer()
    const audioPath = join(__dirname, '../audios/latido-unico.mp3')
    const resource = createAudioResource(audioPath)

    player.play(resource)
    connection.subscribe(player)

    // Interrompe o áudio após 3,5 segundos
    const stopTimer = setTimeout(() => {
      if (player.state.status !== AudioPlayerStatus.Idle) {
        console.log('⏱️  Latido interrompido (limite de 3,5s)')
        player.stop()
      }
    }, 3500)

    player.on(AudioPlayerStatus.Idle, () => {
      clearTimeout(stopTimer)
      console.log('✅ Latido finalizado')
      // Agenda o próximo latido
      agendarLatidoAleatorio(guildId, connection)
    })

    player.on('error', (error) => {
      clearTimeout(stopTimer)
      console.error('❌ Erro ao tocar latido:', error)
      // Mesmo com erro, agenda o próximo
      agendarLatidoAleatorio(guildId, connection)
    })
  }, milissegundos)

  // Armazena o timer
  timersAtivos.set(guildId, timer)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once('clientReady', () => {
  console.log(`🤖 Bot logado como ${client.user?.tag}`)
  console.log(`📊 Servidores conectados: ${client.guilds.cache.size}`)
  client.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id})`)
  })
  console.log('\n⏳ Aguardando eventos de voz...\n')
})

client.on('error', (error) => {
  console.error('❌ Erro no cliente:', error)
})

client.on('warn', (info) => {
  console.warn('⚠️  Aviso:', info)
})

client.on('messageCreate', async (message) => {
  // Ignora mensagens de bots
  if (message.author.bot) return

  // Ignora mensagens vazias
  if (!message.content.trim()) return

  // Verifica se o bot está conectado em um canal de voz neste servidor
  const connection = getVoiceConnection(message.guildId!)
  if (!connection) return

  const audioName = message.content.trim().toLowerCase()
  const audioPath = join(__dirname, `../audios/${audioName}.mp3`)

  // Verifica se o arquivo existe
  const fs = await import('fs')
  if (!fs.existsSync(audioPath)) {
    console.log(`⏭️  Áudio "${audioName}.mp3" não encontrado`)
    return
  }

  console.log(`🎵 Tocando áudio solicitado: ${audioName}.mp3`)

  const player = createAudioPlayer()
  const resource = createAudioResource(audioPath)

  player.play(resource)
  connection.subscribe(player)

  // Interrompe o áudio após 3,5 segundos
  const stopTimer = setTimeout(() => {
    if (player.state.status !== AudioPlayerStatus.Idle) {
      console.log(`⏱️  Áudio "${audioName}.mp3" interrompido (limite de 3,5s)`)
      player.stop()
    }
  }, 5000)

  player.on(AudioPlayerStatus.Idle, () => {
    clearTimeout(stopTimer)
    console.log(`✅ Áudio "${audioName}.mp3" finalizado`)
  })

  player.on('error', (error) => {
    clearTimeout(stopTimer)
    console.error(`❌ Erro ao tocar "${audioName}.mp3":`, error)
  })
})

client.on('voiceStateUpdate', (oldState, newState) => {
  console.log('📢 VoiceStateUpdate detectado!')
  console.log(`   Usuário: ${newState.member?.user.tag}`)
  console.log(`   Bot?: ${newState.member?.user.bot}`)
  console.log(`   Canal antigo: ${oldState.channel?.name || 'nenhum'} (ID: ${oldState.channelId || 'null'})`)
  console.log(`   Canal novo: ${newState.channel?.name || 'nenhum'} (ID: ${newState.channelId || 'null'})`)

  // ignora bots
  if (newState.member?.user.bot) {
    console.log('   ⏭️  Ignorando bot')
    return
  }

  // verifica se o usuário saiu do canal de voz
  if (oldState.channel && !newState.channel) {
    console.log('   👋 Usuário saiu do canal - bot também vai sair')

    // Cancela o timer ativo
    const timer = timersAtivos.get(oldState.guild.id)
    if (timer) {
      clearTimeout(timer)
      timersAtivos.delete(oldState.guild.id)
      console.log('   ⏹️  Timer de latido cancelado')
    }

    const connection = getVoiceConnection(oldState.guild.id)
    if (connection) {
      connection.destroy()
      console.log('   ✅ Bot desconectado')
    }
    return
  }

  // verifica se o usuário entrou ou mudou para um canal de voz
  if (newState.channel && newState.channelId !== oldState.channelId) {
    const channel = newState.channel

    console.log(`   ✅ Condição atendida - tentando entrar no canal`)

    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      })

      console.log(`🎧 Entrando no canal: ${channel.name}`)

      connection.on('error', (error) => {
        console.error('❌ Erro na conexão de voz:', error)
      })

      // Aguarda 2 segundos e toca o áudio de entrada
      setTimeout(() => {
        console.log('🔊 Tocando áudio de entrada...')

        const player = createAudioPlayer()
        const audioPath = join(__dirname, '../audios/bem-ti-vi.mp3')
        const resource = createAudioResource(audioPath)

        player.play(resource)
        connection.subscribe(player)

        // Interrompe o áudio após 3,5 segundos
        const stopTimer = setTimeout(() => {
          if (player.state.status !== AudioPlayerStatus.Idle) {
            console.log('⏱️  Áudio de entrada interrompido (limite de 3,5s)')
            player.stop()
          }
        }, 3500)

        player.on(AudioPlayerStatus.Idle, () => {
          clearTimeout(stopTimer)
          console.log('✅ Áudio de entrada finalizado')
          // Inicia o ciclo de latidos aleatórios
          agendarLatidoAleatorio(channel.guild.id, connection)
        })

        player.on('error', (error) => {
          clearTimeout(stopTimer)
          console.error('❌ Erro ao tocar áudio de entrada:', error)
          // Mesmo com erro, inicia os latidos aleatórios
          agendarLatidoAleatorio(channel.guild.id, connection)
        })
      }, 2000)
    } catch (error) {
      console.error('❌ Erro ao entrar no canal:', error)
    }
  } else {
    console.log('   ⏭️  Condição não atendida - não entrando no canal')
  }
})

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN não encontrado no arquivo .env')
}

client.login(process.env.DISCORD_TOKEN)
