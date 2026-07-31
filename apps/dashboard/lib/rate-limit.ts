// Proteção contra tentativa de adivinhar a senha por força bruta.
//
// O painel está exposto na internet com uma senha única. Sem limite, um bot
// testa milhares de senhas por minuto até acertar. Com limite, cada tentativa
// errada custa tempo e o ataque deixa de ser viável.
//
// Estado em memória, de propósito: o painel é stateless (sem banco) e roda num
// único container. Reiniciar limpa os contadores — aceitável, porque reiniciar
// não é algo que um atacante consiga provocar.

interface Tentativas {
  contagem: number;
  primeiraEm: number;
  bloqueadoAte: number;
}

const registro = new Map<string, Tentativas>();

/** Descarta entradas velhas para o Map não crescer sem limite. */
function limpar(agora: number): void {
  for (const [chave, dados] of registro) {
    if (dados.bloqueadoAte < agora && agora - dados.primeiraEm > JANELA_MS) {
      registro.delete(chave);
    }
  }
}

// ---------------------------------------------------------------------------
// Política de bloqueio
// ---------------------------------------------------------------------------
// O trade-off: números baixos travam o atacante rápido, mas também travam o
// operador que errou a senha três vezes. Números altos são tolerantes com quem
// esqueceu a senha, mas dão mais fôlego para o bot.
//
// Os valores abaixo são generosos com o operador de propósito — ele não é
// técnico e vai errar. Cinco tentativas cobrem o erro honesto; o bloqueio de
// 10 min derruba a taxa de um bot para ~30 tentativas/hora, o que torna
// inviável adivinhar qualquer senha que não seja trivial.

/** Quantos erros são tolerados antes de bloquear. */
const MAX_TENTATIVAS = 5;

/** Período em que os erros são contados (ms). */
const JANELA_MS = 15 * 60 * 1000; // 15 minutos

/** Quanto tempo o bloqueio dura depois de estourar o limite (ms). */
const BLOQUEIO_MS = 10 * 60 * 1000; // 10 minutos

// ---------------------------------------------------------------------------

export interface ResultadoLimite {
  permitido: boolean;
  /** Segundos restantes de bloqueio — para avisar o operador. */
  esperarSegundos: number;
}

/** Consulta se este IP pode tentar agora. Não registra a tentativa. */
export function podeTentar(ip: string): ResultadoLimite {
  const agora = Date.now();
  const dados = registro.get(ip);

  if (dados && dados.bloqueadoAte > agora) {
    return {
      permitido: false,
      esperarSegundos: Math.ceil((dados.bloqueadoAte - agora) / 1000),
    };
  }

  return { permitido: true, esperarSegundos: 0 };
}

/** Registra uma tentativa que falhou e bloqueia se estourou o limite. */
export function registrarFalha(ip: string): void {
  const agora = Date.now();
  limpar(agora);

  const dados = registro.get(ip);

  // Primeira falha, ou a janela anterior já expirou: recomeça a contagem.
  if (!dados || agora - dados.primeiraEm > JANELA_MS) {
    registro.set(ip, { contagem: 1, primeiraEm: agora, bloqueadoAte: 0 });
    return;
  }

  dados.contagem += 1;
  if (dados.contagem >= MAX_TENTATIVAS) {
    dados.bloqueadoAte = agora + BLOQUEIO_MS;
  }
}

/** Limpa o histórico do IP — chamado quando a senha entra certa. */
export function registrarSucesso(ip: string): void {
  registro.delete(ip);
}
