import { authenticate, fail, jsonResponse, rateLimited, serviceClient } from '../server/lib/auth';
import { GeminiError, runCompanionTurn } from '../server/lib/gemini';
import { searchPlayers } from '../server/lib/searchPlayers';
import type { ApiError, ChatTurn, CompanionRequest, CompanionResponse } from '../src/types/companion';

export const config = { runtime: 'edge' };

const MAX_MESSAGE = 1000;
const MAX_HISTORY = 12;
const MAX_BODY_BYTES = 32_000;

const json = (status: number, body: CompanionResponse | ApiError) => jsonResponse(status, body);

export function parseCompanionRequest(body: unknown): CompanionRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { message, history = [] } = body as Record<string, unknown>;
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) return null;
  if (!Array.isArray(history) || history.length > MAX_HISTORY) return null;
  const turns: ChatTurn[] = [];
  for (const item of history) {
    if (typeof item !== 'object' || item === null) return null;
    const { role, text } = item as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_MESSAGE * 2) return null;
    turns.push({ role, text });
  }
  return { message: message.trim(), history: turns };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const geminiKey = process.env.GEMINI_API_KEY;
  const devMode = process.env.ECHO_DEV_MODE === 'true';
  const db = serviceClient();

  const userId = await authenticate(req, db);
  if (userId instanceof Response) return userId;

  if (rateLimited(`chat:${userId}`, 20)) return fail(429, 'rate_limited', 'Slow down a little — try again in a minute.');

  // --- Validate input ---
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Message is too large.');
  let parsed: CompanionRequest | null = null;
  try {
    parsed = parseCompanionRequest(JSON.parse(raw));
  } catch {
    /* handled below */
  }
  if (!parsed) return fail(400, 'invalid_request', 'Message must be 1-1000 characters.');

  if (!geminiKey) {
    if (!devMode) return fail(503, 'not_configured', 'The AI companion is not configured on the server.');
    return json(200, {
      mode: 'dev',
      players: [],
      reply: 'Local dev mode: GEMINI_API_KEY is not set, so no AI was called. Your message reached the server fine.',
    });
  }

  try {
    const result = await runCompanionTurn(
      {
        apiKey: geminiKey,
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        search: (filters) => {
          if (!db) throw new Error('Supabase is not configured');
          return searchPlayers(db, userId, filters);
        },
      },
      parsed.history,
      parsed.message,
    );
    return json(200, { ...result, mode: 'live' });
  } catch (err) {
    console.error('companion failed', err);
    if (err instanceof GeminiError) {
      if (err.status === 429) return fail(429, 'rate_limited', 'The AI is busy. Try again shortly.');
      return fail(502, 'ai_unavailable', 'Your companion could not think just now. Try again.');
    }
    return fail(500, 'server_error', 'Something went wrong.');
  }
}
