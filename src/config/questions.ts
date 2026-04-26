/**
 * Pool de perguntas que o Xaréu faz pra conhecer melhor os usuários.
 *
 * Misturamos perguntas básicas (nome, cidade, time) que dão contexto pra
 * IA personalizar respostas, com perguntas mais zoeiras/curiosas que viram
 * combustível pra piada futura. Cada `key` é único e nunca é refeita
 * depois de respondida.
 */

export interface XareuQuestion {
  key: string
  question: string
}

export const QUESTIONS: XareuQuestion[] = [
  // — básicas (úteis pra contextualizar respostas) —
  { key: 'nome', question: 'au au, qual seu nome de verdade? (preciso saber pra te chamar quando latir)' },
  { key: 'cidade', question: 'de onde você é? cidade, estado…' },
  { key: 'profissao', question: 'o que você faz da vida? (trabalho/estudo)' },
  { key: 'time', question: 'qual seu time de futebol? (vou usar isso contra você depois)' },

  // — gostos pra contexto/piada —
  { key: 'genero_musical', question: 'que estilo de música você curte? quero saber se vou te julgar' },
  { key: 'banda_favorita', question: 'qual sua banda ou artista favorito? (sem mentir, abana o rabo)' },
  {
    key: 'comida_favorita',
    question: 'qual sua comida preferida? (au au, descreve em detalhe pra eu babar)',
  },
  { key: 'jogo', question: 'joga o quê? quero saber se você é casual ou tryhard' },
  { key: 'serie_filme', question: 'qual filme/série você assistiu mais de 5 vezes?' },

  // — zoeiras / curiosas —
  {
    key: 'apelido_odiado',
    question: 'qual apelido te deram que você odeia? (juro que não vou usar... muito)',
  },
  {
    key: 'vergonha',
    question: 'me conta uma vergonha sua que ainda assombra você de noite',
  },
  {
    key: 'mentira_infancia',
    question: 'qual a maior mentira que você contou pros seus pais quando era pequeno?',
  },
  {
    key: 'mania_estranha',
    question: 'tem alguma mania esquisita? tipo cheirar caderno novo, contar passos…',
  },
  {
    key: 'medo_bobo',
    question: 'qual seu medo mais bobo? (eu morro de medo de aspirador, não conta pra ninguém)',
  },
  {
    key: 'vicio_secreto',
    question: 'qual seu vício secreto? sério, não conto pra ninguém (talvez)',
  },
  {
    key: 'pior_decisao',
    question: 'qual a pior decisão que você tomou tendo certeza que ia dar certo?',
  },
  {
    key: 'comida_nojenta',
    question: 'qual a comida mais bizarra que você já experimentou?',
  },
  {
    key: 'crush_adolescente',
    question: 'qual era seu crush bizarro da adolescência? (não me venha com "ninguém")',
  },
  {
    key: 'flop_dancante',
    question: 'qual música hoje em dia você dança escondido sem orgulho nenhum?',
  },
  {
    key: 'compra_arrependida',
    question: 'qual foi a compra mais inútil que você já fez?',
  },
  {
    key: 'super_poder',
    question: 'se virasse super-herói, qual seu poder e qual seria sua fraqueza ridícula?',
  },
  {
    key: 'animal_seria',
    question: 'se fosse virar bicho, qual? (resposta certa: cachorro, óbvio)',
  },
  {
    key: 'maior_treta',
    question: 'qual a maior treta que você já se meteu? não precisa entregar nome',
  },

  // — utilidades —
  { key: 'hobby', question: 'o que você faz pra relaxar? (não vale "rolar TikTok")' },
  { key: 'pet', question: 'tem outro bicho aí? não me troque por gato.' },
  {
    key: 'idade',
    question: 'quantos anos você tem? (vou calcular se sou mais velho que você em anos de cachorro)',
  },
]
