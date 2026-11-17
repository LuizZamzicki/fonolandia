// Recompensas: avatares que se desbloqueiam com estrelas e figurinhas que saem do baú.

import type { Round } from '../store/types'

export interface Avatar {
  id: string
  emoji: string
  name: string
  /** Estrelas necessárias para desbloquear. */
  stars: number
}

export const AVATARS: Avatar[] = [
  { id: 'cachorro', emoji: '🐶', name: 'Cachorro', stars: 0 },
  { id: 'gato', emoji: '🐱', name: 'Gato', stars: 0 },
  { id: 'coelho', emoji: '🐰', name: 'Coelho', stars: 0 },
  { id: 'raposa', emoji: '🦊', name: 'Raposa', stars: 0 },
  { id: 'urso', emoji: '🐻', name: 'Urso', stars: 0 },
  { id: 'panda', emoji: '🐼', name: 'Panda', stars: 0 },
  { id: 'sapo', emoji: '🐸', name: 'Sapo', stars: 8 },
  { id: 'macaco', emoji: '🐵', name: 'Macaco', stars: 16 },
  { id: 'leao', emoji: '🦁', name: 'Leão', stars: 25 },
  { id: 'tigre', emoji: '🐯', name: 'Tigre', stars: 35 },
  { id: 'pinguim', emoji: '🐧', name: 'Pinguim', stars: 50 },
  { id: 'unicornio', emoji: '🦄', name: 'Unicórnio', stars: 70 },
  { id: 'dragao', emoji: '🐲', name: 'Dragão', stars: 95 },
]

const AVATAR_BY_ID = new Map(AVATARS.map((a) => [a.id, a]))

export function avatarEmoji(id: string): string {
  return AVATAR_BY_ID.get(id)?.emoji ?? '🙂'
}

export const FREE_AVATARS = AVATARS.filter((a) => a.stars === 0)

export interface Sticker {
  id: string
  emoji: string
  name: string
  rare?: boolean
}

export const STICKERS: Sticker[] = [
  { id: 'polvo', emoji: '🐙', name: 'Polvo' },
  { id: 'flamingo', emoji: '🦩', name: 'Flamingo' },
  { id: 'pavao', emoji: '🦚', name: 'Pavão' },
  { id: 'papagaio', emoji: '🦜', name: 'Papagaio' },
  { id: 'baleia', emoji: '🐳', name: 'Baleia' },
  { id: 'girafa', emoji: '🦒', name: 'Girafa' },
  { id: 'canguru', emoji: '🦘', name: 'Canguru' },
  { id: 'preguica', emoji: '🦥', name: 'Preguiça' },
  { id: 'lontra', emoji: '🦦', name: 'Lontra' },
  { id: 'coala', emoji: '🐨', name: 'Coala' },
  { id: 'ourico', emoji: '🦔', name: 'Ouriço' },
  { id: 'peixinho', emoji: '🐠', name: 'Peixinho' },
  { id: 'caranguejo', emoji: '🦀', name: 'Caranguejo' },
  { id: 'tartaruga', emoji: '🐢', name: 'Tartaruga' },
  { id: 'abelha', emoji: '🐝', name: 'Abelha' },
  { id: 'joaninha', emoji: '🐞', name: 'Joaninha' },
  { id: 'girassol', emoji: '🌻', name: 'Girassol' },
  { id: 'cacto', emoji: '🌵', name: 'Cacto' },
  { id: 'melancia', emoji: '🍉', name: 'Melancia' },
  { id: 'rosquinha', emoji: '🍩', name: 'Rosquinha' },
  { id: 'cupcake', emoji: '🧁', name: 'Bolinho' },
  { id: 'pirulito', emoji: '🍭', name: 'Pirulito' },
  { id: 'carrossel', emoji: '🎠', name: 'Carrossel' },
  { id: 'roda-gigante', emoji: '🎡', name: 'Roda-gigante' },
  { id: 'arco-iris', emoji: '🌈', name: 'Arco-íris', rare: true },
  { id: 'planeta', emoji: '🪐', name: 'Planeta', rare: true },
  { id: 'disco-voador', emoji: '🛸', name: 'Disco voador', rare: true },
  { id: 'tiranossauro', emoji: '🦖', name: 'Tiranossauro', rare: true },
  { id: 'unicornio', emoji: '🦄', name: 'Unicórnio', rare: true },
  { id: 'trofeu', emoji: '🏆', name: 'Troféu', rare: true },
]

/** Número estável a partir do id da rodada (o mesmo baú dá a mesma figurinha em qualquer aparelho). */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const COMMON = STICKERS.filter((s) => !s.rare)
const RARE = STICKERS.filter((s) => s.rare)

/** Rodadas com 2 ou 3 estrelas abrem um baú. Com 3 estrelas, 1 chance em 4 de figurinha rara. */
export function stickerForRound(round: Pick<Round, 'id' | 'stars'>): Sticker | null {
  if (round.stars < 2) return null
  const h = hash(round.id)
  if (round.stars === 3 && h % 4 === 0) return RARE[(h >>> 2) % RARE.length]
  return COMMON[(h >>> 2) % COMMON.length]
}

/** Álbum: quantas de cada figurinha a criança tem. */
export function album(rounds: Round[], studentId: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rounds) {
    if (r.studentId !== studentId) continue
    const sticker = stickerForRound(r)
    if (sticker) counts.set(sticker.id, (counts.get(sticker.id) ?? 0) + 1)
  }
  return counts
}
