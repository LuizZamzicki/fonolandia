// Tudo o que o Tuca fala, num lugar só. A professora pode gravar cada frase com a voz dela (Área da
// professora → Minha voz); o jogo encontra a gravação pelo texto. As frases com palavra no meio são
// montadas em partes (ex.: "Qual letra está faltando em" + "pato"), para cada parte poder ser gravada
// uma vez só e servir para todas as palavras.

import { AVATARS, STICKERS } from '../game/rewards'
import type { Part } from '../lib/speech'
import { ISLANDS, SOUNDS, soundInfo } from './sounds'
import { WORDS, wordById, type Word } from './words'

export const PHRASES = {
  // Entrada
  helloWho: 'Olá! Quem vai jogar?',
  helloTuca: 'Olá! Eu sou o Tuca.',
  who: 'Quem vai jogar?',
  firstTime: 'Olá! Eu sou o Tuca. Para começar, a professora cadastra a turma.',
  hi: 'Oi',
  // Mapa e resultado
  locked: 'Essa fase ainda está trancada. Termine a anterior!',
  stars1: 'Você conseguiu! Jogue de novo para ganhar mais estrelas.',
  stars2: 'Muito bem! Falta pouco para três estrelas!',
  stars3: 'Incrível! Três estrelas!',
  tapChest: 'Toque no baú!',
  youGotSticker: 'Você ganhou a figurinha',
  // Caça-Sons
  cacaTap: 'Toque nas figuras que começam com o som do',
  asIn: 'como em',
  startsWith: 'começa com o som do',
  // Qual som falta?
  faltaAsk: 'Qual letra está faltando em',
  notThis: 'Não é',
  listenAgain: 'Escute de novo:',
  // Monta a Palavra
  montaBuild: 'Monte a palavra',
  montaOrder: 'Toque nas sílabas na ordem certa.',
  listen: 'Escute:',
  // Rima
  rhymeAsk: 'Rima ou não rima?',
  oops: 'Ops!',
  and: 'e',
  rhyme: 'rimam!',
  noRhyme: 'não rimam.',
  // Corrida da Voz
  teachAsk: 'Antes de correr, me ensina a sua voz? Eu mostro uma letra e você faz o som dela.',
  teachDone: 'Pronto! Agora eu conheço a sua voz!',
  make: 'Faça',
  asAtStart: 'como no começo de',
  makeStartOf: 'Faça o som do começo de',
  makeThis: 'Faça o som desta letra!',
  runVoice: 'Eu vou correr! Para passar pela parede, faça o som da letra que está nela.',
  runTap: 'Eu vou correr! Para passar pela parede, toque na letra que está nela.',
  youFormed: 'Você formou',
  niceSounds: 'Muito bem! Que sons bonitos!',
} as const

const w = (word: Word) => word.word.toLowerCase()
const sound = (key: string): Part => ({ sound: key })

// --- Falas montadas em partes --------------------------------------------------------

export function cacaInstruction(target: string): Part[] {
  const example = wordById(soundInfo(target)!.example)!
  return [PHRASES.cacaTap, sound(target), ',', PHRASES.asIn, `${w(example)}.`]
}

export function startsWithHint(word: Word): Part[] {
  return [w(word), PHRASES.startsWith, sound(word.start), '.']
}

export function faltaInstruction(word: Word): Part[] {
  return [PHRASES.faltaAsk, `${w(word)}?`]
}

export function faltaWrong(letter: string, word: Word): Part[] {
  return [PHRASES.notThis, sound(letter), '.', PHRASES.listenAgain, `${w(word)}.`]
}

export function montaInstruction(word: Word): Part[] {
  return [PHRASES.montaBuild, `${w(word)}.`, PHRASES.montaOrder]
}

export function montaListen(word: Word): Part[] {
  return [PHRASES.listen, ...word.syllables.map((s) => `${s.toLowerCase()}...`)]
}

export function rimaInstruction(a: Word, b: Word): Part[] {
  return [`${w(a)}...`, `${w(b)}.`, PHRASES.rhymeAsk]
}

export function rimaExplanation(a: Word, b: Word, rhymes: boolean, correct: boolean): Part[] {
  return [...(correct ? [] : [PHRASES.oops]), w(a), PHRASES.and, w(b), rhymes ? PHRASES.rhyme : PHRASES.noRhyme]
}

/** O pedido falado da Corrida da Voz: o som, nunca o nome da letra. */
export function soundPromptLine(letter: string, vowel: boolean): Part[] {
  const info = soundInfo(letter)
  const example = info ? wordById(info.example) : undefined
  if (!info || !example) return [PHRASES.makeThis]
  if (vowel) return [PHRASES.make, sound(letter), ',', PHRASES.asAtStart, `${w(example)}!`]
  return [PHRASES.makeStartOf, `${w(example)}!`]
}

// --- O que dá para gravar ----------------------------------------------------------

export interface ClipItem {
  /** Chave da gravação (ver store/recordings). */
  key: string
  /** O que a professora deve falar. */
  label: string
  /** Dica de como falar. */
  hint?: string
}

export interface ClipGroup {
  id: string
  title: string
  description: string
  items: ClipItem[]
}

/** Como fazer cada som (o som, não o nome da letra). */
export const HOW: Record<string, string> = {
  A: 'á',
  E: 'é',
  I: 'i',
  O: 'ó',
  U: 'u',
  P: 'pâ (curtinho)',
  B: 'bâ (curtinho)',
  T: 'tâ (curtinho)',
  D: 'dâ (curtinho)',
  C: 'câ, como em casa',
  G: 'gâ, como em gato',
  F: 'ffff (segure)',
  V: 'vvvv (segure)',
  M: 'mmmm (boca fechada)',
  N: 'nnnn',
  S: 'ssss (cobrinha)',
  Z: 'zzzz (abelha)',
  L: 'llll',
  R: 'rrrr, como em rato',
}

function textItems(texts: Iterable<string>, phraseKey: (t: string) => string): ClipItem[] {
  const seen = new Set<string>()
  const items: ClipItem[] = []
  for (const label of texts) {
    const key = phraseKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    items.push({ key, label })
  }
  return items
}

/** Tudo o que a professora pode gravar, em grupos. `names` são os nomes das crianças da turma. */
export function clipGroups(phraseKey: (t: string) => string, soundKey: (l: string) => string, names: string[]): ClipGroup[] {
  const syllables = WORDS.flatMap((word) => word.syllables.map((s) => s.toLowerCase())).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return [
    {
      id: 'sons',
      title: 'Sons das letras',
      description: 'O som de cada letra, não o nome: “ssss”, “mmmm”, “bâ”. É o mais importante.',
      items: SOUNDS.map((s) => ({ key: soundKey(s.key), label: s.key, hint: HOW[s.key] })),
    },
    {
      id: 'frases',
      title: 'Frases do Tuca',
      description: 'Instruções e elogios. As frases curtas (“como em”, “e”) se juntam com as palavras.',
      items: textItems(Object.values(PHRASES), phraseKey),
    },
    {
      id: 'palavras',
      title: 'Palavras',
      description: 'O nome de cada figura, falado devagar e bem claro.',
      items: textItems(
        [...WORDS].sort((a, b) => a.word.localeCompare(b.word, 'pt-BR')).map((word) => word.word.toLowerCase()),
        phraseKey,
      ).map((item) => ({ ...item, hint: WORDS.find((x) => x.word.toLowerCase() === item.label)?.emoji })),
    },
    {
      id: 'silabas',
      title: 'Sílabas',
      description: 'Usadas no Monta a Palavra.',
      items: textItems(syllables, phraseKey),
    },
    {
      id: 'nomes',
      title: 'Nomes',
      description: 'Crianças da turma, ilhas do mapa, figurinhas e bichinhos.',
      items: textItems(
        [
          ...names,
          ...ISLANDS.map((i) => i.name),
          ...STICKERS.map((s) => s.name),
          ...AVATARS.map((a) => a.name),
        ],
        phraseKey,
      ),
    },
  ]
}
