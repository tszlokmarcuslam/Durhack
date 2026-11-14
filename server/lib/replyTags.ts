import { EXPRESSIONS, type Expression } from '../../src/types/companion';

const MOOD = /<mood>\s*([a-z]+)\s*<\/mood>/i;
const BOARD = /<board>([\s\S]*?)<\/board>/i;
const ANY_TAG = /<\/?(mood|board)>/gi;
const CONTROL = /[\u0000-\u001f\u007f]/g;
const MAX_BOARD_LINES = 3;
const MAX_BOARD_CHARS = 32;

export interface TaggedReply {
  reply: string;
  expression: Expression;
  board: string[];
}

/**
 * Splits the model's reply into spoken text, a mood and optional whiteboard lines.
 * Model output is untrusted: unknown moods fall back to "happy", board lines are capped,
 * and any leftover tags are removed so they are never shown or spoken.
 */
export function parseReplyTags(raw: string): TaggedReply {
  const mood = raw.match(MOOD)?.[1]?.toLowerCase();
  const expression = EXPRESSIONS.includes(mood as Expression) ? (mood as Expression) : 'happy';

  const board = (raw.match(BOARD)?.[1] ?? '')
    .split('|')
    .map((line) => line.replace(CONTROL, ' ').trim().slice(0, MAX_BOARD_CHARS))
    .filter(Boolean)
    .slice(0, MAX_BOARD_LINES);

  const reply = raw.replace(MOOD, '').replace(BOARD, '').replace(ANY_TAG, '').trim();
  return { reply, expression, board };
}
