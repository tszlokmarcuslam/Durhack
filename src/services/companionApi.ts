import { supabase } from '../lib/supabase';
import type { ApiError, CompanionRequest, CompanionResponse } from '../types/companion';

export type CompanionErrorKind = 'offline' | 'unauthenticated' | 'rate_limited' | 'not_configured' | 'server';

export class CompanionApiError extends Error {
  constructor(public readonly kind: CompanionErrorKind, message: string) {
    super(message);
  }
}

const KIND_BY_STATUS: Record<number, CompanionErrorKind> = {
  401: 'unauthenticated',
  429: 'rate_limited',
  503: 'not_configured',
};

export async function sendCompanionMessage(request: CompanionRequest): Promise<CompanionResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch('/api/companion', { method: 'POST', headers, body: JSON.stringify(request) });
  } catch {
    throw new CompanionApiError('offline', "Can't reach EchoWorld. Check your connection.");
  }

  let body: CompanionResponse | ApiError | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok || !body || 'error' in body) {
    const message = body && 'message' in body ? body.message : `Server error (${res.status}).`;
    throw new CompanionApiError(KIND_BY_STATUS[res.status] ?? 'server', message);
  }
  return body;
}
