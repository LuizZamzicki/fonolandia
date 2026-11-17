// Os sons trabalhados no jogo, as trocas que a professora acompanha e as ilhas do mapa.

export interface SoundInfo {
  /** Letra que representa o som (chave usada em todo o app). */
  key: string
  /** Como a voz fala a letra ("bê", "efe"...). */
  spoken: string
  /** Palavra-exemplo (id do banco de palavras). */
  example: string
}

export const SOUNDS: SoundInfo[] = [
  { key: 'A', spoken: 'á', example: 'abelha' },
  { key: 'E', spoken: 'é', example: 'elefante' },
  { key: 'I', spoken: 'i', example: 'igreja' },
  { key: 'O', spoken: 'ó', example: 'ovo' },
  { key: 'U', spoken: 'u', example: 'uva' },
  { key: 'P', spoken: 'pê', example: 'pato' },
  { key: 'B', spoken: 'bê', example: 'bola' },
  { key: 'T', spoken: 'tê', example: 'tomate' },
  { key: 'D', spoken: 'dê', example: 'dado' },
  { key: 'F', spoken: 'éfe', example: 'faca' },
  { key: 'V', spoken: 'vê', example: 'vaca' },
  { key: 'M', spoken: 'ême', example: 'mala' },
  { key: 'N', spoken: 'êne', example: 'navio' },
  { key: 'C', spoken: 'cê', example: 'casa' },
  { key: 'G', spoken: 'gê', example: 'gato' },
  { key: 'S', spoken: 'ésse', example: 'sapo' },
  { key: 'Z', spoken: 'zê', example: 'zebra' },
  { key: 'L', spoken: 'éle', example: 'lua' },
  { key: 'R', spoken: 'érre', example: 'rato' },
]

const SOUND_BY_KEY = new Map(SOUNDS.map((s) => [s.key, s]))

export function soundInfo(key: string): SoundInfo | undefined {
  return SOUND_BY_KEY.get(key)
}

/** Trocas comuns na alfabetização (sons parecidos: só muda a vibração da voz ou o ponto de saída do ar). */
export const CONFUSION_PAIRS: [string, string][] = [
  ['P', 'B'],
  ['T', 'D'],
  ['F', 'V'],
  ['M', 'N'],
  ['C', 'G'],
  ['S', 'Z'],
  ['L', 'R'],
]

/** O "par" de um som (P → B), quando existe. */
export function pairOf(key: string): string | undefined {
  for (const [a, b] of CONFUSION_PAIRS) {
    if (a === key) return b
    if (b === key) return a
  }
  return undefined
}

export type GameKind = 'caca' | 'falta' | 'monta' | 'rima'

export interface Level {
  /** Ex.: "pb-2". */
  id: string
  game: GameKind | 'chefao'
  /** Sons que a fase usa. */
  sounds: string[]
}

export interface Island {
  id: string
  name: string
  emoji: string
  /** Cor da ilha no mapa (fundo e borda). */
  color: string
  sounds: string[]
  levels: Level[]
}

const ISLAND_DEFS: Omit<Island, 'levels'>[] = [
  { id: 'vogais', name: 'Ilha das Vogais', emoji: '🏝️', color: '#ff9f43', sounds: ['A', 'E', 'I', 'O', 'U'] },
  { id: 'pb', name: 'Praia do P e do B', emoji: '🏖️', color: '#ee5a8f', sounds: ['P', 'B'] },
  { id: 'td', name: 'Floresta do T e do D', emoji: '🌴', color: '#10ac84', sounds: ['T', 'D'] },
  { id: 'fv', name: 'Vulcão do F e do V', emoji: '🌋', color: '#ee5253', sounds: ['F', 'V'] },
  { id: 'mn', name: 'Montanha do M e do N', emoji: '⛰️', color: '#5f27cd', sounds: ['M', 'N'] },
  { id: 'cg', name: 'Caverna do C e do G', emoji: '🪨', color: '#576574', sounds: ['C', 'G'] },
  { id: 'sz', name: 'Mar do S e do Z', emoji: '🌊', color: '#0abde3', sounds: ['S', 'Z'] },
  { id: 'lr', name: 'Castelo do L e do R', emoji: '🏰', color: '#c0398a', sounds: ['L', 'R'] },
]

const LEVEL_GAMES: Level['game'][] = ['caca', 'falta', 'monta', 'rima', 'chefao']

export const ISLANDS: Island[] = ISLAND_DEFS.map((island) => ({
  ...island,
  levels: LEVEL_GAMES.map((game, i) => ({ id: `${island.id}-${i + 1}`, game, sounds: island.sounds })),
}))

export const ALL_LEVELS: Level[] = ISLANDS.flatMap((i) => i.levels)

const LEVEL_BY_ID = new Map(ALL_LEVELS.map((l) => [l.id, l]))

export function levelById(id: string): Level | undefined {
  return LEVEL_BY_ID.get(id)
}

export function islandOfLevel(levelId: string): Island | undefined {
  return ISLANDS.find((i) => i.levels.some((l) => l.id === levelId))
}

export const GAME_INFO: Record<Level['game'], { name: string; emoji: string; gradient: string }> = {
  caca: { name: 'Caça-Sons', emoji: '🔎', gradient: 'linear-gradient(135deg, #5b8cff, #6d5efc)' },
  falta: { name: 'Qual som falta?', emoji: '🧩', gradient: 'linear-gradient(135deg, #ff7a59, #ff4f8b)' },
  monta: { name: 'Monta a Palavra', emoji: '🧱', gradient: 'linear-gradient(135deg, #1fc7a4, #1a9fd6)' },
  rima: { name: 'Rima ou Não Rima?', emoji: '🎵', gradient: 'linear-gradient(135deg, #a855f7, #6d5efc)' },
  chefao: { name: 'Desafio do Chefão', emoji: '👑', gradient: 'linear-gradient(135deg, #f5b915, #ff8a1f)' },
}
