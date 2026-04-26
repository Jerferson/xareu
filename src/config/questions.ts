/**
 * Pool de perguntas que o Xaréu faz pra conhecer melhor os usuários.
 *
 * Cada pergunta deve ser:
 * - Curta e casual (vai ser anexada ao final da resposta normal)
 * - Coerente com a personalidade canina ("au au, e aí, ...")
 * - Sobre algo duradouro (não "como tá hoje?")
 *
 * O `key` é único e usado pra rastrear quais perguntas já foram feitas
 * pra cada usuário, evitando repetição.
 */

export interface XareuQuestion {
  key: string
  question: string
}

export const QUESTIONS: XareuQuestion[] = [
  { key: 'nome', question: 'au au, qual seu nome de verdade?' },
  { key: 'cidade', question: 'de onde você é? cidade, estado…' },
  { key: 'profissao', question: 'com o que você trabalha ou estuda?' },
  { key: 'time', question: 'qual seu time de futebol? (preciso saber pra te zoar direito)' },
  { key: 'genero_musical', question: 'qual estilo de música você curte mais?' },
  { key: 'banda_favorita', question: 'qual sua banda ou artista favorito?' },
  { key: 'comida_favorita', question: 'qual sua comida preferida? (au au, fala da boa)' },
  { key: 'jogo', question: 'joga algum jogo? qual te vicia mais?' },
  { key: 'serie_filme', question: 'qual filme ou série você não cansa de ver?' },
  { key: 'pet', question: 'tem outro bicho aí em casa? (não me troque por gato)' },
  { key: 'hobby', question: 'o que você faz no fim de semana pra relaxar?' },
  { key: 'esporte', question: 'pratica algum esporte ou só assiste?' },
  { key: 'idade', question: 'quantos anos você tem? (não vou contar pra ninguém)' },
  { key: 'sonho', question: 'qual sonho ou meta você tá perseguindo agora?' },
  { key: 'manha_noite', question: 'pessoa de manhã ou de noite? quando você é mais ativo?' },
]
