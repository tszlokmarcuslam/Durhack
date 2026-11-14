import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApiError } from '../../src/types/companion';

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
export const fail = (status: number, error: string, message: string) =>
  jsonResponse(status, { error, message } satisfies ApiError);

/** Service-role client, or null when Supabase is not configured. Server only. */
export function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/**
 * Resolves the caller from their Supabase access token. Returns the user id, or an error Response
 * to send back. Without Supabase, only ECHO_DEV_MODE=true lets requests through (as "local-dev").
 */
export async function authenticate(req: Request, db: SupabaseClient | null): Promise<string | Response> {
  if (db) {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return fail(401, 'unauthenticated', 'Sign in to talk to your companion.');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return fail(401, 'unauthenticated', 'Your session has expired. Sign in again.');
    return data.user.id;
  }
  if (process.env.ECHO_DEV_MODE === 'true') return 'local-dev';
  return fail(503, 'not_configured', 'Supabase is not configured on the server.');
}

// shortcut: in-memory limiter is per server instance, so the real limit is looser on Vercel;
// move to a shared store (Upstash/Supabase) before a public launch.
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
}
