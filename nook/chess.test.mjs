// Tests for chess.js: run from the repo root with  npx vitest run nook/chess.test.mjs
// The perft numbers (how many move sequences there are to a given depth) are the well-known ones from the
// Chess Programming Wiki. If any rule is even slightly wrong, they come out different.
import { describe, it, expect } from 'vitest';
import {
  START_FEN, newGame, fromFEN, toFEN, pieceAt, turn, legalMoves, movesFrom, play, status, lastMove, captured, bestMove, perft
} from './chess.js';

// play a list of moves from a state, failing loudly if one is not legal
function playAll(state, moves) {
  for (const uci of moves.split(' ')) {
    const next = play(state, uci);
    if (!next) throw new Error(`not legal: ${uci} in ${toFEN(state)}`);
    state = next;
  }
  return state;
}
const ucis = state => legalMoves(state).map(m => m.uci).sort();
const ucisFrom = (state, sq) => movesFrom(state, sq).map(m => m.uci).sort();

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POSITION_3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POSITION_4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
const POSITION_5 = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

describe('perft', () => {
  const cases = [
    ['the start position', START_FEN, [20, 400, 8902]],
    ['Kiwipete (castling, en passant, pins)', KIWIPETE, [48, 2039, 97862]],
    ['position 3 (en passant that uncovers check)', POSITION_3, [14, 191, 2812, 43238]],
    ['position 4 (in check, promotions)', POSITION_4, [6, 264, 9467]],
    ['position 5 (promotion with capture)', POSITION_5, [44, 1486, 62379]]
  ];
  for (const [label, fen, counts] of cases) {
    it(`${label}: ${counts.join(', ')}`, () => {
      const s = fromFEN(fen);
      counts.forEach((n, i) => expect(perft(s, i + 1)).toBe(n));
    });
  }
  it('depth 0 is one leaf', () => { expect(perft(newGame(), 0)).toBe(1); });
});

describe('FEN', () => {
  it('reads and writes positions back unchanged', () => {
    for (const fen of [START_FEN, KIWIPETE, POSITION_3, POSITION_4, POSITION_5]) expect(toFEN(fromFEN(fen))).toBe(fen);
    expect(toFEN(newGame())).toBe(START_FEN);
  });
  it('keeps the en passant square, the clocks and the move number up to date', () => {
    let s = play(newGame(), 'e2e4');
    expect(toFEN(s)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    s = play(s, 'e7e5');
    expect(toFEN(s)).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2');
    s = play(s, 'g1f3');
    expect(toFEN(s)).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  });
  it('throws on garbage', () => {
    const bad = [
      '', 'hello', null, 42, undefined,
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1',              // 7 ranks
      'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',     // 9 squares
      'rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',    // 9 pawns on a rank
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1',     // not a piece
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',     // side to move
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQxq - 0 1',     // castling
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e5 0 1',    // en passant square
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e3 0 1',    // en passant square for the wrong side
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1',     // clock
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w kq - 0 1',       // no white king
      'rnbqkbnP/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w KQq - 0 1',      // pawn on the last rank
      '4k3/8/8/8/8/8/8/4R1K1 w - - 0 1'                               // black is in check but it is white's move
    ];
    for (const fen of bad) expect(() => fromFEN(fen), String(fen)).toThrow();
  });
  it('drops castling rights whose king or rook has left home', () => {
    expect(toFEN(fromFEN('4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1')).split(' ')[2]).toBe('K');
  });
  it('pieceAt and turn', () => {
    const s = newGame();
    expect(pieceAt(s, 'e1')).toBe('K'); expect(pieceAt(s, 'd8')).toBe('q'); expect(pieceAt(s, 'a2')).toBe('P');
    expect(pieceAt(s, 'e4')).toBe(null); expect(pieceAt(s, 'z9')).toBe(null);
    expect(turn(s)).toBe('w'); expect(turn(play(s, 'e2e4'))).toBe('b');
  });
});

describe('moves', () => {
  it('describes each move', () => {
    const s = newGame();
    expect(legalMoves(s)).toHaveLength(20);
    expect(legalMoves(s).find(m => m.uci === 'e2e4')).toEqual({
      from: 'e2', to: 'e4', uci: 'e2e4', piece: 'P', capture: false, promo: null, castle: null, enPassant: false
    });
    expect(ucisFrom(s, 'g1')).toEqual(['g1f3', 'g1h3']);
    expect(movesFrom(s, 'e1')).toEqual([]);
    expect(movesFrom(play(s, 'e2e4'), 'e7').map(m => m.piece)).toEqual(['p', 'p']);   // black pieces are lowercase
  });
  it('a pinned piece cannot move off the line to its king', () => {
    expect(movesFrom(fromFEN('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1'), 'e2')).toEqual([]);
    expect(ucisFrom(fromFEN('4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1'), 'e2')).toEqual(['e2e3', 'e2e4', 'e2e5', 'e2e6', 'e2e7']);
  });
  it('in check, only moves that get out of it', () => {
    expect(ucis(fromFEN('4k3/8/8/8/8/8/3P4/r3K3 w - - 0 1'))).toEqual(['e1e2', 'e1f2']);
  });
});

describe('castling', () => {
  const OPEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  it('both ways when the way is clear', () => {
    const s = fromFEN(OPEN);
    const k = movesFrom(s, 'e1').filter(m => m.castle);
    expect(k.map(m => [m.uci, m.castle])).toEqual([['e1g1', 'K'], ['e1c1', 'Q']]);
    const after = play(s, 'e1g1');
    expect([pieceAt(after, 'g1'), pieceAt(after, 'f1'), pieceAt(after, 'h1'), pieceAt(after, 'e1')]).toEqual(['K', 'R', null, null]);
    expect(after.castling).toBe('kq');
    const black = play(after, 'e8c8');
    expect([pieceAt(black, 'c8'), pieceAt(black, 'd8'), pieceAt(black, 'a8')]).toEqual(['k', 'r', null]);
    expect(toFEN(black).split(' ')[2]).toBe('-');
  });
  it('is refused when the king would pass through an attacked square', () => {
    const s = fromFEN('3k1r2/8/8/8/8/8/8/R3K2R w KQ - 0 1');   // the rook on f8 watches f1
    expect(ucisFrom(s, 'e1')).not.toContain('e1g1');
    expect(ucisFrom(s, 'e1')).toContain('e1c1');
    expect(play(s, 'e1g1')).toBe(null);
  });
  it('is refused out of check and into check', () => {
    const out = fromFEN('3kr3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(movesFrom(out, 'e1').filter(m => m.castle)).toEqual([]);
    const into = fromFEN('3k2r1/8/8/8/8/8/8/R3K2R w KQ - 0 1');   // g1 is watched
    expect(movesFrom(into, 'e1').filter(m => m.castle).map(m => m.uci)).toEqual(['e1c1']);
  });
  it('an attacked b1 does not stop queenside castling, a piece in the way does', () => {
    expect(ucisFrom(fromFEN('1r1k4/8/8/8/8/8/8/R3K2R w KQ - 0 1'), 'e1')).toContain('e1c1');
    expect(ucisFrom(fromFEN('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1'), 'e1')).not.toContain('e1c1');
  });
  it('rights are lost when the king or a rook moves, or a rook is taken', () => {
    const s = fromFEN(OPEN);
    expect(play(s, 'e1f1').castling).toBe('kq');
    expect(playAll(s, 'e1f1 e8f8 f1e1 f8e8').castling).toBe('');   // coming back home does not bring them back
    expect(play(s, 'h1h2').castling).toBe('Qkq');
    expect(play(s, 'a1a8').castling).toBe('Kk');                   // white's a-rook moved, black's a-rook was taken
    expect(play(fromFEN('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1'), 'g2h1').castling).toBe('Qkq');
  });
});

describe('en passant', () => {
  const READY = 'e2e4 a7a6 e4e5 d7d5';   // black's pawn has just stepped two squares past white's on e5
  it('works right after the double step', () => {
    const s = playAll(newGame(), READY);
    const ep = movesFrom(s, 'e5').find(m => m.to === 'd6');
    expect(ep).toMatchObject({ uci: 'e5d6', capture: true, enPassant: true });
    const after = play(s, 'e5d6');
    expect([pieceAt(after, 'd6'), pieceAt(after, 'd5'), pieceAt(after, 'e5')]).toEqual(['P', null, null]);
    expect(captured(after).b).toEqual(['p']);
  });
  it('is gone one move later', () => {
    const s = playAll(newGame(), READY + ' h2h3 h7h6');
    expect(ucisFrom(s, 'e5')).toEqual(['e5e6']);
    expect(play(s, 'e5d6')).toBe(null);
  });
  it('is not allowed when taking would leave the king in check along the rank', () => {
    expect(ucisFrom(fromFEN('8/8/8/KPp4r/8/8/8/7k w - c6 0 1'), 'b5')).toEqual(['b5b6']);
    expect(ucisFrom(fromFEN('8/8/8/KPp5/8/8/8/7k w - c6 0 1'), 'b5')).toEqual(['b5b6', 'b5c6']);
  });
});

describe('promotion', () => {
  const PUSH = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
  it('one move per piece choice', () => {
    expect(movesFrom(fromFEN(PUSH), 'e7').map(m => [m.uci, m.promo])).toEqual([['e7e8q', 'q'], ['e7e8r', 'r'], ['e7e8b', 'b'], ['e7e8n', 'n']]);
  });
  it('e7e8 makes a queen, e7e8n a knight', () => {
    const s = fromFEN(PUSH);
    expect(pieceAt(play(s, 'e7e8'), 'e8')).toBe('Q');
    expect(pieceAt(play(s, 'e7e8n'), 'e8')).toBe('N');
    expect(pieceAt(play(s, 'e7e8r'), 'e8')).toBe('R');
    expect(pieceAt(play(s, 'e7e8'), 'e7')).toBe(null);
  });
  it('black promotes too, and a pawn can promote by taking', () => {
    expect(pieceAt(play(fromFEN('4k3/8/8/8/8/8/p7/4K3 b - - 0 1'), 'a2a1'), 'a1')).toBe('q');
    const s = fromFEN('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(movesFrom(s, 'a7').find(m => m.uci === 'a7b8n')).toMatchObject({ capture: true, promo: 'n' });
    expect(pieceAt(play(s, 'a7b8n'), 'b8')).toBe('N');
  });
});

describe('play', () => {
  it('returns null for moves that are not legal', () => {
    const s = newGame();
    for (const uci of ['e2e5', 'e7e5', 'e1e2', 'e2e4q', 'a1a3', 'zz', '', 'e9e4', null, undefined, 42]) expect(play(s, uci)).toBe(null);
  });
  it('never changes the state it is given', () => {
    const s = playAll(newGame(), 'e2e4 d7d5');
    const before = JSON.stringify(s);
    const next = play(s, 'e4d5');
    play(s, 'e2e5'); legalMoves(s); status(s); captured(s); bestMove(s); perft(s, 2); toFEN(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(next).not.toBe(s); expect(next.board).not.toBe(s.board); expect(next.history).not.toBe(s.history);
    expect(pieceAt(s, 'd5')).toBe('p'); expect(pieceAt(next, 'd5')).toBe('P');
  });
  it('lastMove is the move that made the position', () => {
    expect(lastMove(newGame())).toBe(null);
    expect(lastMove(play(newGame(), 'g1f3'))).toEqual({ from: 'g1', to: 'f3' });
    expect(lastMove(fromFEN(KIWIPETE))).toBe(null);
  });
});

describe('status', () => {
  it('the start is not over', () => {
    expect(status(newGame())).toEqual({ turn: 'w', check: false, over: false, result: null, winner: null });
    expect(status(play(newGame(), 'e2e4')).turn).toBe('b');
  });
  it("fool's mate: checkmate, black wins", () => {
    const s = playAll(newGame(), 'f2f3 e7e5 g2g4 d8h4');
    expect(status(s)).toEqual({ turn: 'w', check: true, over: true, result: 'checkmate', winner: 'b' });
    expect(legalMoves(s)).toEqual([]);
  });
  it('check without mate', () => {
    expect(status(playAll(newGame(), 'e2e4 f7f6 d1h5'))).toMatchObject({ check: true, over: false, result: null });
  });
  it('stalemate', () => {
    expect(status(fromFEN('k7/8/1Q6/8/8/8/8/7K b - - 0 1'))).toEqual({ turn: 'b', check: false, over: true, result: 'stalemate', winner: null });
  });
  it('insufficient material', () => {
    const dead = [
      '8/8/4k3/8/8/4K3/8/8 w - - 0 1',            // K v K
      '8/8/4k3/8/8/4K3/5B2/8 w - - 0 1',          // K+B v K
      '8/8/4k3/2n5/8/4K3/8/8 w - - 0 1',          // K v K+N
      '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1'          // bishops on the same colour (c1 and f8 are both dark)
    ];
    for (const fen of dead) expect(status(fromFEN(fen)).result, fen).toBe('insufficient');
    const alive = [
      '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1',        // bishops on different colours
      '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1',          // a pawn
      '8/8/4k3/8/8/4K3/8/7R w - - 0 1',           // a rook
      '8/8/4k3/2n5/8/4K3/5N2/8 w - - 0 1'         // a knight each
    ];
    for (const fen of alive) expect(status(fromFEN(fen)).over, fen).toBe(false);
  });
  it('fifty-move rule at 100 half moves, but checkmate comes first', () => {
    expect(status(fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 99 80')).over).toBe(false);
    const s = play(fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), 'a1a2');
    expect(s.halfmove).toBe(100);
    expect(status(s)).toMatchObject({ over: true, result: 'fifty', winner: null });
    expect(status(play(fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 60'), 'a1a8'))).toMatchObject({ result: 'checkmate', winner: 'w' });
  });
  it('threefold repetition', () => {
    const shuffle = 'g1f3 g8f6 f3g1 f6g8';
    const twice = playAll(newGame(), shuffle);
    expect(status(twice).over).toBe(false);                    // the start position has been seen twice
    const thrice = playAll(twice, shuffle);
    expect(status(thrice)).toMatchObject({ over: true, result: 'repetition', winner: null });
    expect(status(playAll(twice, 'e2e4 e7e5 ' + shuffle)).over).toBe(false);   // pawn moves start the count again
  });
});

describe('captured', () => {
  it('nothing at the start, then the pieces each side has lost', () => {
    expect(captured(newGame())).toEqual({ w: [], b: [] });
    expect(captured(playAll(newGame(), 'e2e4 d7d5 e4d5 d8d5'))).toEqual({ w: ['P'], b: ['p'] });
    expect(captured(fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))).toEqual({
      w: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'N', 'N', 'B', 'B', 'R', 'R', 'Q'],
      b: ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'n', 'n', 'b', 'b', 'r', 'r', 'q']
    });
  });
  it('a promoted pawn is not counted as lost', () => {
    // white has two queens and seven pawns, and has lost a rook
    expect(captured(fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNQ w Qkq - 0 1'))).toEqual({ w: ['R'], b: [] });
  });
});

describe('bestMove', () => {
  it('takes a queen that is left hanging', () => {
    const white = fromFEN('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    const black = fromFEN('4k3/8/8/8/8/2b5/8/Q4K2 b - - 0 1');
    for (let i = 0; i < 5; i++) {
      expect(bestMove(white)).toBe('d2d5');
      expect(bestMove(black)).toBe('c3a1');
    }
  });
  it('finds a mate in one', () => {
    expect(bestMove(fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'))).toBe('a1a8');
  });
  it('returns a legal move, and null when there is none', () => {
    for (const fen of [START_FEN, KIWIPETE, POSITION_3, POSITION_4, POSITION_5]) {
      const s = fromFEN(fen);
      expect(ucis(s)).toContain(bestMove(s));
    }
    expect(bestMove(playAll(newGame(), 'f2f3 e7e5 g2g4 d8h4'))).toBe(null);
    expect(bestMove(fromFEN('k7/8/1Q6/8/8/8/8/7K b - - 0 1'))).toBe(null);
  });
  it('answers quickly at depth 2', () => {
    for (const fen of [START_FEN, KIWIPETE]) {
      const s = fromFEN(fen);
      bestMove(s);   // warm up
      const t = performance.now();
      bestMove(s, 2);
      expect(performance.now() - t).toBeLessThan(300);
    }
  });
  it('plays a whole game against itself with only legal moves', () => {
    let s = newGame();
    for (let ply = 0; ply < 120 && !status(s).over; ply++) {
      const uci = bestMove(s, 1);
      expect(ucis(s)).toContain(uci);
      s = play(s, uci);
    }
    expect(() => fromFEN(toFEN(s))).not.toThrow();
  });
});
