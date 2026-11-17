# Fonolândia – Jogo de Fonemas

Plataforma gamificada para crianças em alfabetização aprenderem os fonemas, com painel para a professora acompanhar cada aluno. Projeto de Pedagogia (requisito: envolver tecnologia).

## Contexto

- Público: crianças em processo de alfabetização, inclusive as que ainda não leem → tudo tem **áudio e figuras**.
- Útil para a professora: acertos por criança e por som, trocas frequentes (P/B, T/D, F/V, M/N…) e evolução.
- Página web (PWA): roda no navegador do tablet, celular ou computador, sem instalação e **sem internet** depois do primeiro acesso.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes da lógica (perguntas, progresso, estatísticas)
npm run build    # versão para publicar (pasta dist/)
```

Primeiro acesso: toque em **Cadastrar a turma**, crie um PIN de 4 números e cadastre as crianças (nome + bichinho).

## Para a criança

- **Quem vai jogar?** — cada criança toca no seu bichinho (aparelho compartilhado pela turma).
- **Mapa de ilhas** — cada ilha é um grupo de sons, em ordem:
  Vogais → P/B → T/D → F/V → M/N → C/G → S/Z → L/R.
- Cada ilha tem 5 fases; a próxima abre quando a anterior ganha estrela:
  1. 🔎 **Caça-Sons** — ouvir o som e tocar nas figuras que começam com ele (as figuras "erradas" incluem o som par: no P aparecem palavras com B).
  2. 🧩 **Qual som falta?** — `_IPA`: escolher a letra (as opções incluem o som par).
  3. 🧱 **Monta a Palavra** — ouvir a palavra e tocar nas sílabas na ordem.
  4. 🎵 **Rima ou Não Rima?** — duas figuras, decidir se rimam.
  5. 👑 **Chefão** — mistura os quatro, com palavras mais longas e uma sílaba "pegadinha" (PA × BA).
- **Tuca, o papagaio** fala toda instrução (voz em português do aparelho); tocar nele ou no 🔊 repete.
- O erro ensina: a dica falada diz com que som a figura começa de verdade ("bola começa com o som do bê").
- Toda figura tem o **nome escrito embaixo** (o emoji sozinho pode confundir: a câmera é "foto"). A exceção é o "Qual som falta?", em que a palavra com a lacuna já aparece abaixo da figura.
- **Recompensas**: 1 a 3 estrelas por fase (acertos de primeira), baú com figurinha (2+ estrelas; com 3, chance de figurinha rara), álbum com 30 figurinhas, troféu por ilha, bichinhos novos que se desbloqueiam com estrelas e 🔥 dias seguidos.
- **Adaptativo**: os sons que a criança mais erra aparecem mais nas fases.

## 🎤 Corrida da Voz

O personagem é uma letra que corre sozinha. Cada parede tem um buraco com a forma de uma letra: a criança faz o **som** da letra ("sss", "mmm", "bâ"), e não o nome dela, e o personagem se transforma para passar. As paredes formam uma palavra curta (P-A-T-O → "Você formou PATO!"); com poucos sons ensinados, viram uma sequência de letras.

- **Bateu na parede** com a letra errada? Só volta um pouquinho e tenta de novo, sem perder nada. Depois de algumas batidas, o Tuca dá a dica: "Faça o som do começo de sapo!".
- **Me ensina a sua voz**: antes de correr, a criança faz o som de cada letra uma vez (cerca de 1 minuto). O jogo passa a reconhecer a voz dela. Quando abre uma ilha nova, pede só os sons novos.
- **Como reconhece**: no próprio tablet, sem internet e sem enviar áudio para lugar nenhum. Cada som vira uma "impressão digital" (MFCC) e é comparado com as gravações (DTW), testando a voz "esticada" de alguns jeitos para compensar a diferença entre vozes (`src/audio/`). Só as impressões digitais ficam guardadas, nunca o áudio.
- **Só palavras "transparentes"**, em que cada letra tem o seu som básico: entram PATO, BOLA e SAPO; ficam de fora CASA (o S soa Z), PERA (R fraco), PÃO e SOL.
- **Professora → Vozes**: gravar os sons com a voz da turma (vale para todas as crianças) ou de uma criança, ver se uma gravação ficou parecida com outro som e testar o reconhecimento.
- **Microfone**: só funciona em **https** (ou localhost). Sem microfone, joga-se tocando nos botões de letra.
- **Fora do painel**: o jogo não entra nas estatísticas da professora.

**Testes feitos** (com vozes sintéticas do macOS, sem criança de verdade):

- Com a **própria voz** ensinada, o reconhecimento acertou **93%** de 152 sons, e no navegador, de ponta a ponta, **10 de 10**.
- Com a voz de **outra pessoa** foi bem pior: na voz mais diferente das outras, 6 de 19. Por isso o jogo pede para a criança ensinar a própria voz.
- Os erros que sobram são entre sons parecidos (P×B, P×T, S×Z).
- Falta testar com crianças de verdade, no tablet da sala.

Sem competição: não há placar entre crianças nem ranking.

## Painel da professora (protegido por PIN)

- **Turma**: número de crianças, fases jogadas na semana, acerto da turma, trocas mais comuns e lista das crianças com acerto, estrelas, último acesso e alerta de trocas clássicas (3 ou mais).
- **Sons**: mapa de calor criança × som (verde ≥ 80%, amarelo 60–79%, vermelho < 60%, com o número sempre visível).
- **Criança**: acerto por som, trocas ("escolheu B quando o som era P · 4×") com **dica de intervenção** para cada par, evolução semanal, acerto por jogo, últimas fases, editar/tirar da turma.
- **Ajustes**: liberar todas as fases, ligar/desligar voz e sons, exportar respostas em CSV, trocar o PIN, nuvem.

## Dados e nuvem (Supabase, opcional)

Sem configuração, tudo fica guardado **no aparelho** (IndexedDB), funcionando offline.

Para juntar vários tablets numa turma:

1. Crie um projeto no Supabase e rode `supabase/migrations/20261111000000_v01_turmas.sql` (SQL Editor ou `supabase db push`).
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. No painel → Ajustes → Nuvem: a professora cria a conta e a turma (recebe um código de 8 letras).
4. Em cada tablet: Ajustes → Nuvem → digitar o código. O que já existe no aparelho é enviado; depois sincroniza sozinho (ao terminar fase, a cada minuto e quando a internet volta).

Segurança: com o código, um aparelho vê nomes, bichinhos e estrelas da turma e grava rodadas novas; as respostas detalhadas (acertos e trocas) só a professora logada lê. As crianças não fazem login e só o primeiro nome é guardado.

## Estrutura

| Pasta | O quê |
| --- | --- |
| `src/data/` | banco de palavras (figura, sílabas, som inicial, rima) e as ilhas/sons/trocas |
| `src/game/` | geração das perguntas, progresso, recompensas, estatísticas (+ testes) |
| `src/games/` | as telas dos 4 jogos |
| `src/screens/` | quem joga, mapa, fase, resultado, álbum, corrida da voz, painel da professora |
| `src/audio/` | microfone, detecção de início/fim do som e reconhecimento dos fonemas (+ testes) |
| `src/store/` | banco local (IndexedDB), gravações dos sons e sincronização com o Supabase |
| `src/lib/` | voz, sons (Web Audio), confete, preferências |

Base técnica herdada do HyperGlota: Vite + React + TypeScript, PWA, fonte Nunito, botões "táteis", sons gerados e confete.

## Ideias para depois

- Gravar a voz da professora para os sons isolados (a voz sintética fala bem palavras, mas não fonemas soltos).
- Mais sons: J/CH/X, LH/NH, R fraco (ARARA), sílabas complexas (BR, PL).
- Relatório em PDF por criança para reunião de pais.
- Modo "aula": a professora escolhe os sons do dia para toda a turma.
