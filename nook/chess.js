// Chess rules for Nook World, with a small computer player.
//  - newGame() / fromFEN(fen): a game. play(state, 'e2e4') gives the next state, or null when the move is not legal.
//  - legalMoves(), movesFrom(), status() (check, checkmate, stalemate and the draws), captured(), lastMove(), toFEN().
//  - bestMove(state): the computer's move. It looks a couple of moves ahead (negamax with alpha-beta), then follows
//    the captures through, and scores positions by material and by where the pieces stand.
// Nothing here touches the page when it loads, so tests can import it in Node (chess.test.mjs).
//
// A state is a plain object, cheap to copy. play() always makes a new one and never changes the one it is given.
//   board      64 squares: a1 = 0, b1 = 1 … h1 = 7, a2 = 8 … h8 = 63. 'P','N','B','R','Q','K' white, lowercase black, null empty
//   turn       'w' or 'b'
//   castling   what is left of 'KQkq' ('' when nobody can castle)
//   ep         the square a pawn skipped with its double step on the last move (the en passant square), or -1
//   halfmove   moves since the last pawn move or capture (fifty-move rule); fullmove as in FEN
//   history    position keys since the last pawn move or capture (a position cannot repeat across one), for threefold repetition
//   last       { from, to } of the move that made this position, or null

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* ---------- squares ---------- */
const FILES = 'abcdefgh';
const name = i => FILES[i & 7] + ((i >> 3) + 1);
function index(sq) {
  if (typeof sq !== 'string' || sq.length !== 2) return -1;
  const f = FILES.indexOf(sq[0]), r = sq.charCodeAt(1) - 49;   // '1' is character 49
  return f < 0 || r < 0 || r > 7 ? -1 : r * 8 + f;
}
const isWhite = p => p <= 'Z';   // capital letters sort before lowercase ones
const other = side => side === 'w' ? 'b' : 'w';

// Where pieces can go from each square, worked out once: square lists for knights, kings and pawn captures,
// and for the sliding pieces one line of squares per direction, nearest first.
const ALL = Array.from({ length: 64 }, (_, i) => i);
const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
const jumpsFrom = (i, deltas) => deltas.filter(([df, dr]) => onBoard((i & 7) + df, (i >> 3) + dr)).map(([df, dr]) => i + dr * 8 + df);
function lineFrom(i, [df, dr]) {
  const out = [];
  for (let f = (i & 7) + df, r = (i >> 3) + dr; onBoard(f, r); f += df, r += dr) out.push(r * 8 + f);
  return out;
}
const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const KNIGHT = ALL.map(i => jumpsFrom(i, [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]));
const KING = ALL.map(i => jumpsFrom(i, [...STRAIGHT, ...DIAGONAL]));
const ROOK_LINES = ALL.map(i => STRAIGHT.map(d => lineFrom(i, d)));
const BISHOP_LINES = ALL.map(i => DIAGONAL.map(d => lineFrom(i, d)));
const PAWN_TAKES = { w: ALL.map(i => jumpsFrom(i, [[-1, 1], [1, 1]])), b: ALL.map(i => jumpsFrom(i, [[-1, -1], [1, -1]])) };
const ARMY = { w: ['P', 'N', 'B', 'R', 'Q', 'K'], b: ['p', 'n', 'b', 'r', 'q', 'k'] };

/* ---------- attacks ---------- */
// Is square sq attacked by side `by`? Look outwards from the square for each kind of attacker.
function attacked(b, sq, by) {
  const [P, N, B, R, Q, K] = ARMY[by];
  for (const s of PAWN_TAKES[other(by)][sq]) if (b[s] === P) return true;   // white pawns hit sq from where a black pawn on sq would hit
  for (const s of KNIGHT[sq]) if (b[s] === N) return true;
  for (const s of KING[sq]) if (b[s] === K) return true;
  return slidesInto(b, ROOK_LINES[sq], R, Q) || slidesInto(b, BISHOP_LINES[sq], B, Q);
}
function slidesInto(b, lines, piece, queen) {
  for (const line of lines) for (const s of line) {
    const p = b[s];
    if (p) { if (p === piece || p === queen) return true; break; }
  }
  return false;
}
// p is a working position: a state's fields plus kw / kb, where the two kings stand
const inCheck = p => attacked(p.board, p.turn === 'w' ? p.kw : p.kb, other(p.turn));

/* ---------- moves ---------- */
// Internal moves use square numbers. cap is the piece taken (for en passant, the pawn beside), promo 'q' | 'r' | 'b' | 'n'.
const move = (from, to, piece, cap, promo = null, castle = null, ep = false) => ({ from, to, piece, cap, promo, castle, ep });

// Every move that follows how the pieces move, before checking whether it leaves the mover's own king in check.
function pseudoMoves(p) {
  const b = p.board, white = p.turn === 'w', out = [];
  for (let i = 0; i < 64; i++) {
    const pc = b[i];
    if (!pc || isWhite(pc) !== white) continue;
    switch (pc.toUpperCase()) {
      case 'P': pawnMoves(p, i, pc, out); break;
      case 'N': jumps(b, i, pc, KNIGHT[i], out); break;
      case 'B': slides(b, i, pc, BISHOP_LINES[i], out); break;
      case 'R': slides(b, i, pc, ROOK_LINES[i], out); break;
      case 'Q': slides(b, i, pc, ROOK_LINES[i], out); slides(b, i, pc, BISHOP_LINES[i], out); break;
      case 'K': jumps(b, i, pc, KING[i], out); castles(p, i, pc, out); break;
    }
  }
  return out;
}
function jumps(b, i, pc, targets, out) {
  for (const to of targets) { const t = b[to]; if (!t || isWhite(t) !== isWhite(pc)) out.push(move(i, to, pc, t)); }
}
function slides(b, i, pc, lines, out) {
  for (const line of lines) for (const to of line) {
    const t = b[to];
    if (!t) { out.push(move(i, to, pc, null)); continue; }
    if (isWhite(t) !== isWhite(pc)) out.push(move(i, to, pc, t));
    break;
  }
}
function pawnMoves(p, i, pc, out) {
  const b = p.board, white = pc === 'P', fwd = white ? 8 : -8, lastRank = white ? 7 : 0;
  const add = (to, cap, ep = false) => {
    if ((to >> 3) === lastRank) for (const q of 'qrbn') out.push(move(i, to, pc, cap, q));   // one move per promotion choice
    else out.push(move(i, to, pc, cap, null, null, ep));
  };
  if (!b[i + fwd]) {
    add(i + fwd, null);
    if ((i >> 3) === (white ? 1 : 6) && !b[i + 2 * fwd]) add(i + 2 * fwd, null);
  }
  for (const to of PAWN_TAKES[white ? 'w' : 'b'][i]) {
    const t = b[to];
    if (t) { if (isWhite(t) !== white) add(to, t); }
    else if (to === p.ep) add(to, white ? 'p' : 'P', true);   // en passant: the pawn taken stands beside, not on `to`
  }
}

// Castling needs the right still in p.castling (king and rook have not moved, rook not taken), empty squares between,
// and the king must not be in check, pass through an attacked square, or land on one.
const CASTLES = [
  { right: 'K', king: 4, to: 6, rook: 7, between: [5, 6], path: [4, 5, 6] },
  { right: 'Q', king: 4, to: 2, rook: 0, between: [1, 2, 3], path: [4, 3, 2] },
  { right: 'k', king: 60, to: 62, rook: 63, between: [61, 62], path: [60, 61, 62] },
  { right: 'q', king: 60, to: 58, rook: 56, between: [57, 58, 59], path: [60, 59, 58] }
];
function castles(p, i, pc, out) {
  if (!p.castling) return;
  const b = p.board, rook = pc === 'K' ? 'R' : 'r', them = other(p.turn);
  for (const c of CASTLES) {
    if (c.king !== i || isWhite(c.right) !== isWhite(pc) || !p.castling.includes(c.right) || b[c.rook] !== rook) continue;
    if (c.between.some(s => b[s]) || c.path.some(s => attacked(b, s, them))) continue;
    out.push(move(i, c.to, pc, null, null, c.right.toUpperCase()));
  }
}

// Castling rights lost when a move starts or ends on one of these squares (a king or rook moves, or a rook is taken).
const RIGHTS_AT = ALL.map(() => '');
Object.assign(RIGHTS_AT, { 0: 'Q', 4: 'KQ', 7: 'K', 56: 'q', 60: 'kq', 63: 'k' });
const rookOf = m => m.to > m.from ? [m.from + 3, m.from + 1] : [m.from - 4, m.from - 1];   // castling: [rook from, rook to]

// Play move m on working position p in place. Returns what unmake() needs to put it back.
function make(p, m) {
  const b = p.board, undo = { castling: p.castling, ep: p.ep, halfmove: p.halfmove, fullmove: p.fullmove };
  const white = isWhite(m.piece), pawn = m.piece === 'P' || m.piece === 'p';
  b[m.from] = null;
  b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : m.piece;
  if (m.ep) b[m.to + (white ? -8 : 8)] = null;
  if (m.castle) { const [rf, rt] = rookOf(m); b[rt] = b[rf]; b[rf] = null; }
  const lost = RIGHTS_AT[m.from] + RIGHTS_AT[m.to];
  if (lost && p.castling) p.castling = [...p.castling].filter(c => !lost.includes(c)).join('');
  p.ep = pawn && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  p.halfmove = pawn || m.cap ? 0 : p.halfmove + 1;
  if (!white) p.fullmove++;
  if (m.piece === 'K') p.kw = m.to; else if (m.piece === 'k') p.kb = m.to;
  p.turn = other(p.turn);
  return undo;
}
function unmake(p, m, undo) {
  const b = p.board, white = isWhite(m.piece);
  b[m.from] = m.piece;
  b[m.to] = m.ep ? null : m.cap;
  if (m.ep) b[m.to + (white ? -8 : 8)] = m.cap;
  if (m.castle) { const [rf, rt] = rookOf(m); b[rf] = b[rt]; b[rt] = null; }
  if (m.piece === 'K') p.kw = m.from; else if (m.piece === 'k') p.kb = m.from;
  p.turn = other(p.turn);
  Object.assign(p, undo);
}

// The legal moves: try each one and keep it if the mover's own king is not left in check.
// capturesOnly keeps just captures and promotions (for the computer's look at the captures that follow).
function legal(p, capturesOnly = false) {
  const us = p.turn, them = other(us), out = [];
  for (const m of pseudoMoves(p)) {
    if (capturesOnly && !m.cap && !m.promo) continue;
    const undo = make(p, m);
    if (!attacked(p.board, us === 'w' ? p.kw : p.kb, them)) out.push(m);
    unmake(p, m, undo);
  }
  return out;
}

/* ---------- states ---------- */
// A working copy of a state that make() / unmake() may change.
const working = s => ({
  board: s.board.slice(), turn: s.turn, castling: s.castling, ep: s.ep, halfmove: s.halfmove, fullmove: s.fullmove,
  kw: s.board.indexOf('K'), kb: s.board.indexOf('k')
});
// The key two positions share when they count as the same for repetition: pieces, side to move, castling rights,
// and the en passant square only while a pawn really can take there.
function keyOf(p) {
  let k = '';
  for (let i = 0; i < 64; i++) k += p.board[i] || '.';
  const ep = p.ep >= 0 && legal(p).some(m => m.ep) ? name(p.ep) : '-';
  return k + p.turn + (p.castling || '-') + ep;
}
const stateOf = (p, history, last) => ({
  board: p.board, turn: p.turn, castling: p.castling, ep: p.ep, halfmove: p.halfmove, fullmove: p.fullmove, history, last
});

export function newGame() { return fromFEN(START_FEN); }

export function fromFEN(fen) {
  const bad = why => { throw new Error(`Bad FEN (${why}): ${fen}`); };
  if (typeof fen !== 'string') bad('not a string');
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 4 || fields.length > 6) bad('needs 4 to 6 fields');
  const [rows, turn, castling, ep, half = '0', full = '1'] = fields;
  const board = readBoard(rows, bad);
  if (turn !== 'w' && turn !== 'b') bad('side to move');
  if (!/^(-|[KQkq]{1,4})$/.test(castling) || new Set(castling).size !== castling.length) bad('castling');
  if (!/^(-|[a-h][36])$/.test(ep)) bad('en passant square');
  if (!/^\d+$/.test(half) || !/^\d+$/.test(full)) bad('move counters');
  const p = { board, turn, castling: '', ep: -1, halfmove: +half, fullmove: Math.max(1, +full), kw: board.indexOf('K'), kb: board.indexOf('k') };
  // keep only the castling rights whose king and rook are still at home
  p.castling = CASTLES.filter(c => castling.includes(c.right) && board[c.king] === (isWhite(c.right) ? 'K' : 'k') &&
    board[c.rook] === (isWhite(c.right) ? 'R' : 'r')).map(c => c.right).join('');
  if (ep !== '-') {
    const e = index(ep), behind = turn === 'w' ? -8 : 8;   // the pawn that double-stepped stands just past e
    if ((e >> 3) !== (turn === 'w' ? 5 : 2)) bad('en passant square does not fit the side to move');
    if (board[e + behind] === (turn === 'w' ? 'p' : 'P') && !board[e] && !board[e - behind]) p.ep = e;
  }
  if (attacked(board, turn === 'w' ? p.kb : p.kw, turn)) bad('the side not to move is in check');
  return stateOf(p, [keyOf(p)], null);
}
function readBoard(rows, bad) {
  const ranks = rows.split('/'), board = new Array(64).fill(null);
  if (ranks.length !== 8) bad('needs 8 ranks');
  ranks.forEach((row, k) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') f += +ch;
      else if ('pnbrqkPNBRQK'.includes(ch) && f < 8) board[(7 - k) * 8 + f++] = ch;
      else bad(`rank ${8 - k}`);
    }
    if (f !== 8) bad(`rank ${8 - k}`);
  });
  if (board.filter(x => x === 'K').length !== 1 || board.filter(x => x === 'k').length !== 1) bad('needs one king each');
  if ([0, 7].some(r => board.slice(r * 8, r * 8 + 8).some(x => x === 'P' || x === 'p'))) bad('pawn on the first or last rank');
  return board;
}

export function toFEN(state) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', gap = 0;
    for (let f = 0; f < 8; f++) {
      const pc = state.board[r * 8 + f];
      if (!pc) { gap++; continue; }
      row += (gap || '') + pc; gap = 0;
    }
    rows.push(row + (gap || ''));
  }
  return [rows.join('/'), state.turn, state.castling || '-', state.ep >= 0 ? name(state.ep) : '-', state.halfmove, state.fullmove].join(' ');
}

export function pieceAt(state, sq) { const i = index(sq); return i < 0 ? null : state.board[i] || null; }
export function turn(state) { return state.turn; }

// Moves as the outside sees them. piece is as on the board ('P' for white, 'p' for black); castle is 'K' or 'Q' for either side.
const uciOf = m => name(m.from) + name(m.to) + (m.promo || '');
const outward = m => ({
  from: name(m.from), to: name(m.to), uci: uciOf(m), piece: m.piece, capture: !!m.cap,
  promo: m.promo, castle: m.castle, enPassant: m.ep
});
export function legalMoves(state) { return legal(working(state)).map(outward); }
export function movesFrom(state, sq) { return legalMoves(state).filter(m => m.from === sq); }

// 'e7e8' without a letter promotes to a queen.
export function play(state, uci) {
  if (typeof uci !== 'string') return null;
  const u = uci.trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)) return null;
  const p = working(state), from = index(u.slice(0, 2)), to = index(u.slice(2, 4)), promo = u[4] || null;
  const m = legal(p).find(m => m.from === from && m.to === to && (m.promo ? m.promo === (promo || 'q') : !promo));
  if (!m) return null;
  make(p, m);
  const key = keyOf(p);
  return stateOf(p, p.halfmove === 0 ? [key] : (state.history || []).concat(key), { from: name(from), to: name(to) });
}

export function lastMove(state) { return state.last ? { from: state.last.from, to: state.last.to } : null; }

/* ---------- how a game ends ---------- */
// Nobody can ever checkmate: kings alone, one bishop or one knight on the board, or only bishops all on one colour of square.
function insufficient(b) {
  const minors = [];
  for (let i = 0; i < 64; i++) {
    const pc = b[i];
    if (!pc || pc === 'K' || pc === 'k') continue;
    const t = pc.toUpperCase();
    if (t !== 'B' && t !== 'N') return false;   // a pawn, rook or queen can still mate
    minors.push({ t, shade: ((i & 7) + (i >> 3)) % 2 });
  }
  return minors.length <= 1 || minors.every(m => m.t === 'B' && m.shade === minors[0].shade);
}
function repeated(state) {
  const h = state.history || [], key = h[h.length - 1];
  return key !== undefined && h.filter(k => k === key).length >= 3;
}

export function status(state) {
  const p = working(state), check = inCheck(p), stuck = legal(p).length === 0;
  let result = null;
  if (stuck) result = check ? 'checkmate' : 'stalemate';
  else if (insufficient(p.board)) result = 'insufficient';
  else if (state.halfmove >= 100) result = 'fifty';
  else if (repeated(state)) result = 'repetition';
  return { turn: state.turn, check, over: result !== null, result, winner: result === 'checkmate' ? other(state.turn) : null };
}

// Pieces each side has lost, against a full set, smallest first. Promoted pieces above the full set make up for missing pawns.
const FULL = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
export function captured(state) {
  const out = { w: [], b: [] };
  for (const side of ['w', 'b']) {
    const have = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 };
    for (const pc of state.board) if (pc && (isWhite(pc) ? 'w' : 'b') === side) have[pc.toUpperCase()]++;
    let promoted = 0;
    for (const t of 'NBRQ') promoted += Math.max(0, have[t] - FULL[t]);
    for (const t of 'PNBRQ') {
      const lost = Math.max(0, FULL[t] - have[t] - (t === 'P' ? promoted : 0));
      for (let n = 0; n < lost; n++) out[side].push(side === 'w' ? t : t.toLowerCase());
    }
  }
  return out;
}

/* ---------- perft: count the move tree, to check the rules against known numbers ---------- */
export function perft(state, depth) {
  const p = working(state);
  const count = d => {
    const moves = legal(p);
    if (d <= 1) return moves.length;
    let n = 0;
    for (const m of moves) { const undo = make(p, m); n += count(d - 1); unmake(p, m, undo); }
    return n;
  };
  return depth <= 0 ? 1 : count(depth);
}

/* ---------- the computer player ---------- */
const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// Piece-square tables: a bonus (or penalty) for a piece standing on each square, drawn from White's side with rank 8 on top.
// Black uses the same tables flipped. These are the well-known "simplified evaluation" tables.
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
};
// Late in the game the king should come out to the middle instead of hiding.
const KING_LATE = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

// Score in centipawns for the side to move.
function evaluate(p) {
  const b = p.board;
  let pieces = 0, score = 0;
  for (let i = 0; i < 64; i++) { const pc = b[i]; if (pc && pc !== 'P' && pc !== 'p') pieces += VALUE[pc.toUpperCase()]; }
  const late = pieces <= 1700;   // about a rook and a bishop each, or less
  for (let i = 0; i < 64; i++) {
    const pc = b[i];
    if (!pc) continue;
    const t = pc.toUpperCase(), w = pc === t;
    const sq = w ? (7 - (i >> 3)) * 8 + (i & 7) : i;   // the tables have rank 8 first; black reads them upside down
    const v = VALUE[t] + (t === 'K' && late ? KING_LATE : PST[t])[sq];
    score += w ? v : -v;
  }
  return p.turn === 'w' ? score : -score;
}

// Captures first, the biggest piece taken by the smallest attacker first, promotions with them, quiet moves after.
function ordered(moves) {
  for (const m of moves) {
    m.rank = (m.cap ? 10000 + 10 * VALUE[m.cap.toUpperCase()] - VALUE[m.piece.toUpperCase()] : 0) + (m.promo ? 9000 + VALUE[m.promo.toUpperCase()] : 0);
  }
  return moves.sort((a, b) => b.rank - a.rank);
}

const MATE = 100000, NEAR = 15, QUIET_DEPTH = 6;
function negamax(p, depth, alpha, beta, ply) {
  if (depth <= 0) return captures(p, alpha, beta, ply, QUIET_DEPTH);
  const moves = ordered(legal(p));
  if (!moves.length) return inCheck(p) ? -MATE + ply : 0;   // checkmated (sooner is worse) or stalemate
  return tryMoves(p, moves, alpha, beta, -Infinity, (a, b) => negamax(p, depth - 1, a, b, ply + 1));
}
// At the end of the look ahead keep following captures, so a piece is not counted as safe while it is about to be taken.
// The side to move may also stop ("stand pat") if that is better, unless it is in check, when every way out is tried.
function captures(p, alpha, beta, ply, left) {
  const next = (a, b) => captures(p, a, b, ply + 1, left - 1);
  if (inCheck(p)) {
    const moves = ordered(legal(p));
    if (!moves.length) return -MATE + ply;
    return left <= 0 ? evaluate(p) : tryMoves(p, moves, alpha, beta, -Infinity, next);
  }
  const stand = evaluate(p);
  if (stand >= beta || left <= 0) return stand;
  return tryMoves(p, ordered(legal(p, true)), Math.max(alpha, stand), beta, stand, next);
}
// Alpha-beta over a list of moves, each scored by child(alpha, beta) from the other side's view.
// Stops as soon as one move is too good for the other side to allow.
function tryMoves(p, moves, alpha, beta, best, child) {
  for (const m of moves) {
    const undo = make(p, m), score = -child(-beta, -alpha);
    unmake(p, m, undo);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

// Picks at random among the moves within NEAR centipawns of the best, so games differ. A mate is always taken the quickest way.
export function bestMove(state, depth = 2) {
  const p = working(state), moves = ordered(legal(p)), d = Math.max(1, Math.floor(depth) || 1);
  if (!moves.length) return null;
  let best = -Infinity;
  const scored = moves.map(m => {
    // only scores above best - NEAR need to be exact, so the window can start there
    const undo = make(p, m), score = -negamax(p, d - 1, -Infinity, -(best - NEAR), 1);
    unmake(p, m, undo);
    if (score > best) best = score;
    return { m, score };
  });
  const mating = Math.abs(best) > MATE / 2;
  const good = scored.filter(s => mating ? s.score === best : s.score > best - NEAR);
  return uciOf(good[Math.floor(Math.random() * good.length)].m);
}
