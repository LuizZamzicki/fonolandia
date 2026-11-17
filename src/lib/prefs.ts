// Preferências simples guardadas no aparelho (só conveniência: sem elas, vale o padrão).

const PREFIX = 'fonolandia:pref:'

export function readPref(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(PREFIX + key)
    return value === null ? fallback : value === '1'
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: boolean): void {
  try {
    localStorage.setItem(PREFIX + key, value ? '1' : '0')
  } catch {
    // Sem armazenamento: a escolha vale só até fechar a tela
  }
}

/** Lista de textos guardada no aparelho (ex.: letras do alfabeto já abertas). */
export function readList(key: string): string[] {
  try {
    const value = localStorage.getItem(PREFIX + key)
    return value ? (JSON.parse(value) as string[]) : []
  } catch {
    return []
  }
}

export function addToList(key: string, item: string): void {
  try {
    const list = readList(key)
    if (!list.includes(item)) localStorage.setItem(PREFIX + key, JSON.stringify([...list, item]))
  } catch {
    // Sem armazenamento: só não fica registrado
  }
}

/** Indica se a lista já foi gravada alguma vez (mesmo vazia). */
export function hasList(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) !== null
  } catch {
    return false
  }
}

export function writeList(key: string, items: string[]): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(items))
  } catch {
    // Sem armazenamento: só não fica registrado
  }
}
