import { createClient } from '@supabase/supabase-js';
import { GeminiError, runCompanionTurn } from '../server/lib/gemini';
import { searchPlayers } from '../server/lib/searchPlayers';
import type { ApiError, ChatTurn, CompanionRequest, CompanionResponse } from '../src/types/companion';

export const config = { runtime: 'edge' };

const MAX_MESSAGE = 1000;
const MAX_HISTORY = 12;
const MAX_BODY_BYTES = 32_000;

function json(status: number, body: CompanionResponse | ApiError): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const fail = (status: number, error: string, message: string) => json(status, { error, message });

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

// shortcut: in-memory limiter is per server instance, so the real limit is looser on Vercel;
// move to a shared store (Upstash/Supabase) before a public launch.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const devMode = process.env.ECHO_DEV_MODE === 'true';
  const db = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

  // --- Authenticate ---
  let userId: string;
  if (db) {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return fail(401, 'unauthenticated', 'Sign in to talk to your companion.');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return fail(401, 'unauthenticated', 'Your session has expired. Sign in again.');
    userId = data.user.id;
  } else if (devMode) {
    userId = 'local-dev';
  } else {
    return fail(503, 'not_configured', 'Supabase is not configured on the server.');
  }

  if (rateLimited(userId)) return fail(429, 'rate_limited', 'Slow down a little — try again in a minute.');

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
