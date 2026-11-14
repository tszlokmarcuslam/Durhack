import { authenticate, fail, rateLimited, serviceClient } from '../server/lib/auth';
import { DEFAULT_VOICE_ID, isVoiceId } from '../src/types/voices';
import { toSpeech } from '../server/lib/speech';

export const config = { runtime: 'edge' };

const MAX_TEXT = 600;

/** Text must be 1-600 chars; voiceId is optional but must be one of the offered voices. */
export function parseTtsRequest(body: unknown): { text: string; voiceId?: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { text, voiceId } = body as Record<string, unknown>;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_TEXT) return null;
  if (voiceId === undefined) return { text: trimmed };
  return isVoiceId(voiceId) ? { text: trimmed, voiceId } : null;
}

/** Turns companion text into speech with ElevenLabs. The ElevenLabs key never leaves the server. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const userId = await authenticate(req, serviceClient());
  if (userId instanceof Response) return userId;
  if (rateLimited(`tts:${userId}`, 20)) return fail(429, 'rate_limited', 'Voice is resting — try again in a minute.');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return fail(503, 'not_configured', 'Voice is off: ELEVENLABS_API_KEY is not set on the server.');

  let parsed: ReturnType<typeof parseTtsRequest> = null;
  try {
    parsed = parseTtsRequest(JSON.parse(await req.text()));
  } catch {
    /* handled below */
  }
  if (!parsed) return fail(400, 'invalid_request', `Text must be 1-${MAX_TEXT} characters and the voice must be one of the offered voices.`);
  const { text } = parsed;

  const voiceId = parsed.voiceId ?? (process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID);
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': apiKey, accept: 'audio/mpeg' },
        body: JSON.stringify({ text: toSpeech(text), model_id: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5' }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    return fail(504, 'voice_unavailable', 'Could not reach the voice service.');
  }
  if (!upstream.ok || !upstream.body) {
    console.error('elevenlabs failed', upstream.status, (await upstream.text()).slice(0, 300));
    if (upstream.status === 429) return fail(429, 'rate_limited', 'Voice is busy or out of quota. Try again shortly.');
    return fail(502, 'voice_unavailable', 'The voice service could not speak just now.');
  }
  return new Response(upstream.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
}
