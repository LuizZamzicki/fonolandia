// Banco de palavras do jogo. Cada palavra tem uma figura (emoji), as sílabas e o som inicial.
// As figuras substituem a leitura: a criança vê e ouve a palavra.
//
// `start` é o som inicial (a letra que a criança vai associar ao som). Para C e G só entram palavras
// com o som "duro" (CA, CO, CU, GA, GO, GU), para não confundir com o C de "cenoura" ou o G de "girafa".
// `rhyme` agrupa as palavras que rimam (mesmo final a partir da sílaba forte). Palavra sem `rhyme` não
// rima com nenhuma outra do banco.

export interface Word {
  id: string
  /** A palavra em maiúsculas, como aparece na tela. */
  word: string
  emoji: string
  syllables: string[]
  start: string
  rhyme?: string
}

type Entry = [word: string, emoji: string, syllables: string, start: string, rhyme?: string]

const ENTRIES: Entry[] = [
  // Vogais
  ['ABELHA', '🐝', 'A-BE-LHA', 'A', 'elha'],
  ['AVIÃO', '✈️', 'A-VI-ÃO', 'A', 'ão'],
  ['ÁRVORE', '🌳', 'ÁR-VO-RE', 'A'],
  ['ANEL', '💍', 'A-NEL', 'A', 'el'],
  ['ABACAXI', '🍍', 'A-BA-CA-XI', 'A'],
  ['ARANHA', '🕷️', 'A-RA-NHA', 'A'],
  ['ELEFANTE', '🐘', 'E-LE-FAN-TE', 'E', 'ante'],
  ['ESTRELA', '⭐', 'ES-TRE-LA', 'E', 'ela'],
  ['ESCOVA', '🪥', 'ES-CO-VA', 'E'],
  ['ESCADA', '🪜', 'ES-CA-DA', 'E', 'ada'],
  ['IGREJA', '⛪', 'I-GRE-JA', 'I'],
  ['ILHA', '🏝️', 'I-LHA', 'I'],
  ['ÍMÃ', '🧲', 'Í-MÃ', 'I'],
  ['IOIÔ', '🪀', 'IO-IÔ', 'I', 'ô'],
  ['OVO', '🥚', 'O-VO', 'O'],
  ['OLHO', '👁️', 'O-LHO', 'O'],
  ['ORELHA', '👂', 'O-RE-LHA', 'O', 'elha'],
  ['ÔNIBUS', '🚌', 'Ô-NI-BUS', 'O'],
  ['ÓCULOS', '👓', 'Ó-CU-LOS', 'O'],
  ['UVA', '🍇', 'U-VA', 'U', 'uva'],
  ['URSO', '🐻', 'UR-SO', 'U'],
  ['UNICÓRNIO', '🦄', 'U-NI-CÓR-NIO', 'U'],
  ['UNHA', '💅', 'U-NHA', 'U'],

  // P e B
  ['PATO', '🦆', 'PA-TO', 'P', 'ato'],
  ['PIPOCA', '🍿', 'PI-PO-CA', 'P', 'oca'],
  ['PEIXE', '🐟', 'PEI-XE', 'P'],
  ['PERA', '🍐', 'PE-RA', 'P'],
  ['PORCO', '🐷', 'POR-CO', 'P'],
  ['PÉ', '🦶', 'PÉ', 'P', 'é'],
  ['PÃO', '🍞', 'PÃO', 'P', 'ão'],
  ['PIPA', '🪁', 'PI-PA', 'P'],
  ['PALHAÇO', '🤡', 'PA-LHA-ÇO', 'P'],
  ['PINGUIM', '🐧', 'PIN-GUIM', 'P'],
  ['BOLA', '⚽', 'BO-LA', 'B'],
  ['BANANA', '🍌', 'BA-NA-NA', 'B'],
  ['BOLO', '🎂', 'BO-LO', 'B'],
  ['BALEIA', '🐋', 'BA-LEI-A', 'B', 'eia'],
  ['BEBÊ', '👶', 'BE-BÊ', 'B'],
  ['BARCO', '⛵', 'BAR-CO', 'B'],
  ['BOTA', '👢', 'BO-TA', 'B', 'ota'],
  ['BORBOLETA', '🦋', 'BOR-BO-LE-TA', 'B'],
  ['BALÃO', '🎈', 'BA-LÃO', 'B', 'ão'],
  ['BICICLETA', '🚲', 'BI-CI-CLE-TA', 'B'],
  ['BALA', '🍬', 'BA-LA', 'B', 'ala'],

  // T e D
  ['TOMATE', '🍅', 'TO-MA-TE', 'T', 'ate'],
  ['TARTARUGA', '🐢', 'TAR-TA-RU-GA', 'T'],
  ['TIGRE', '🐯', 'TI-GRE', 'T'],
  ['TELEFONE', '☎️', 'TE-LE-FO-NE', 'T'],
  ['TESOURA', '✂️', 'TE-SOU-RA', 'T', 'oura'],
  ['TREM', '🚂', 'TREM', 'T'],
  ['TAMBOR', '🥁', 'TAM-BOR', 'T', 'or'],
  ['TÊNIS', '👟', 'TÊ-NIS', 'T'],
  ['TEIA', '🕸️', 'TEI-A', 'T', 'eia'],
  ['TUBARÃO', '🦈', 'TU-BA-RÃO', 'T', 'ão'],
  ['DADO', '🎲', 'DA-DO', 'D', 'ado'],
  ['DENTE', '🦷', 'DEN-TE', 'D'],
  ['DINOSSAURO', '🦕', 'DI-NOS-SAU-RO', 'D'],
  ['DEDO', '☝️', 'DE-DO', 'D'],
  ['DRAGÃO', '🐉', 'DRA-GÃO', 'D', 'ão'],
  ['DIAMANTE', '💎', 'DI-A-MAN-TE', 'D', 'ante'],

  // F e V
  ['FACA', '🔪', 'FA-CA', 'F', 'aca'],
  ['FOCA', '🦭', 'FO-CA', 'F', 'oca'],
  ['FADA', '🧚', 'FA-DA', 'F', 'ada'],
  ['FOGO', '🔥', 'FO-GO', 'F'],
  ['FLOR', '🌸', 'FLOR', 'F', 'or'],
  ['FOLHA', '🍃', 'FO-LHA', 'F'],
  ['FORMIGA', '🐜', 'FOR-MI-GA', 'F'],
  ['FOGUETE', '🚀', 'FO-GUE-TE', 'F', 'ete'],
  ['FANTASMA', '👻', 'FAN-TAS-MA', 'F'],
  ['FOTO', '📷', 'FO-TO', 'F', 'oto'],
  ['VACA', '🐄', 'VA-CA', 'V', 'aca'],
  ['VELA', '🕯️', 'VE-LA', 'V', 'ela'],
  ['VULCÃO', '🌋', 'VUL-CÃO', 'V', 'ão'],
  ['VIOLÃO', '🎸', 'VI-O-LÃO', 'V', 'ão'],
  ['VASSOURA', '🧹', 'VAS-SOU-RA', 'V', 'oura'],
  ['VOVÓ', '👵', 'VO-VÓ', 'V'],
  ['VOVÔ', '👴', 'VO-VÔ', 'V', 'ô'],
  ['VAMPIRO', '🧛', 'VAM-PI-RO', 'V'],

  // M e N
  ['MALA', '🧳', 'MA-LA', 'M', 'ala'],
  ['MACACO', '🐒', 'MA-CA-CO', 'M'],
  ['MAÇÃ', '🍎', 'MA-ÇÃ', 'M'],
  ['MÃO', '✋', 'MÃO', 'M', 'ão'],
  ['MEL', '🍯', 'MEL', 'M', 'el'],
  ['MILHO', '🌽', 'MI-LHO', 'M'],
  ['MOTO', '🏍️', 'MO-TO', 'M', 'oto'],
  ['MORANGO', '🍓', 'MO-RAN-GO', 'M'],
  ['MEIA', '🧦', 'MEI-A', 'M', 'eia'],
  ['MAMADEIRA', '🍼', 'MA-MA-DEI-RA', 'M'],
  ['NAVIO', '🚢', 'NA-VI-O', 'N'],
  ['NARIZ', '👃', 'NA-RIZ', 'N'],
  ['NUVEM', '☁️', 'NU-VEM', 'N'],
  ['NEVE', '❄️', 'NE-VE', 'N'],
  ['NOTA', '🎵', 'NO-TA', 'N', 'ota'],
  ['NOVE', '9️⃣', 'NO-VE', 'N'],

  // C e G (som de CA, CO, CU e GA, GO, GU)
  ['CASA', '🏠', 'CA-SA', 'C'],
  ['CAVALO', '🐴', 'CA-VA-LO', 'C', 'alo'],
  ['CACHORRO', '🐶', 'CA-CHOR-RO', 'C'],
  ['COELHO', '🐰', 'CO-E-LHO', 'C'],
  ['CAMA', '🛏️', 'CA-MA', 'C'],
  ['COBRA', '🐍', 'CO-BRA', 'C'],
  ['CORAÇÃO', '❤️', 'CO-RA-ÇÃO', 'C', 'ão'],
  ['COROA', '👑', 'CO-RO-A', 'C'],
  ['COGUMELO', '🍄', 'CO-GU-ME-LO', 'C', 'elo'],
  ['CARACOL', '🐌', 'CA-RA-COL', 'C', 'ol'],
  ['CAMELO', '🐫', 'CA-ME-LO', 'C', 'elo'],
  ['GATO', '🐱', 'GA-TO', 'G', 'ato'],
  ['GALINHA', '🐔', 'GA-LI-NHA', 'G', 'inha'],
  ['GORILA', '🦍', 'GO-RI-LA', 'G'],
  ['GALO', '🐓', 'GA-LO', 'G', 'alo'],
  ['GOTA', '💧', 'GO-TA', 'G', 'ota'],
  ['GUARDA-CHUVA', '☂️', 'GUAR-DA-CHU-VA', 'G', 'uva'],
  ['GARFO', '🍴', 'GAR-FO', 'G'],
  ['GOLFINHO', '🐬', 'GOL-FI-NHO', 'G'],

  // S e Z
  ['SAPO', '🐸', 'SA-PO', 'S'],
  ['SOL', '☀️', 'SOL', 'S', 'ol'],
  ['SINO', '🔔', 'SI-NO', 'S'],
  ['SUCO', '🧃', 'SU-CO', 'S'],
  ['SORVETE', '🍦', 'SOR-VE-TE', 'S', 'ete'],
  ['SAPATO', '👞', 'SA-PA-TO', 'S', 'ato'],
  ['SEREIA', '🧜‍♀️', 'SE-REI-A', 'S', 'eia'],
  ['SANDUÍCHE', '🥪', 'SAN-DU-Í-CHE', 'S'],
  ['SOFÁ', '🛋️', 'SO-FÁ', 'S'],
  ['ZEBRA', '🦓', 'ZE-BRA', 'Z'],
  ['ZERO', '0️⃣', 'ZE-RO', 'Z'],
  ['ZUMBI', '🧟', 'ZUM-BI', 'Z'],
  ['ZANGADO', '😠', 'ZAN-GA-DO', 'Z', 'ado'],

  // L e R
  ['LUA', '🌙', 'LU-A', 'L'],
  ['LEÃO', '🦁', 'LE-ÃO', 'L', 'ão'],
  ['LIVRO', '📖', 'LI-VRO', 'L'],
  ['LÁPIS', '✏️', 'LÁ-PIS', 'L'],
  ['LIMÃO', '🍋', 'LI-MÃO', 'L', 'ão'],
  ['LOBO', '🐺', 'LO-BO', 'L'],
  ['LARANJA', '🍊', 'LA-RAN-JA', 'L'],
  ['LÂMPADA', '💡', 'LÂM-PA-DA', 'L'],
  ['LAGARTA', '🐛', 'LA-GAR-TA', 'L'],
  ['LUVA', '🧤', 'LU-VA', 'L', 'uva'],
  ['LINHA', '🧵', 'LI-NHA', 'L', 'inha'],
  ['LEITE', '🥛', 'LEI-TE', 'L'],
  ['RATO', '🐭', 'RA-TO', 'R', 'ato'],
  ['ROSA', '🌹', 'RO-SA', 'R', 'osa'],
  ['RELÓGIO', '⌚', 'RE-LÓ-GIO', 'R'],
  ['REI', '🤴', 'REI', 'R'],
  ['ROBÔ', '🤖', 'RO-BÔ', 'R', 'ô'],
  ['RAPOSA', '🦊', 'RA-PO-SA', 'R', 'osa'],
  ['RINOCERONTE', '🦏', 'RI-NO-CE-RON-TE', 'R'],
  ['RÉGUA', '📏', 'RÉ-GUA', 'R'],

  // Fora das ilhas: entram nas rimas e como figuras "erradas" no Caça-Sons
  ['CHOCOLATE', '🍫', 'CHO-CO-LA-TE', 'CH', 'ate'],
  ['JOANINHA', '🐞', 'JO-A-NI-NHA', 'J', 'inha'],
  ['JANELA', '🪟', 'JA-NE-LA', 'J', 'ela'],
  ['JACARÉ', '🐊', 'JA-CA-RÉ', 'J', 'é'],
]

export const WORDS: Word[] = ENTRIES.map(([word, emoji, syllables, start, rhyme]) => ({
  id: word.toLowerCase(),
  word,
  emoji,
  syllables: syllables.split('-'),
  start,
  rhyme,
}))

const BY_ID = new Map(WORDS.map((w) => [w.id, w]))

export function wordById(id: string): Word | undefined {
  return BY_ID.get(id)
}

export function wordsStartingWith(sound: string): Word[] {
  return WORDS.filter((w) => w.start === sound)
}

/** Duas palavras rimam quando têm o mesmo grupo de rima (e não são a mesma palavra). */
export function rhymes(a: Word, b: Word): boolean {
  return a.id !== b.id && a.rhyme !== undefined && a.rhyme === b.rhyme
}
