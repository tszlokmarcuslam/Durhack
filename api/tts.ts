import { authenticate, fail, rateLimited, serviceClient } from '../server/lib/auth';

export const config = { runtime: 'edge' };

const MAX_TEXT = 600;

export function parseTtsRequest(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { text } = body as Record<string, unknown>;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return trimmed && trimmed.length <= MAX_TEXT ? trimmed : null;
}

/** Turns companion text into speech with ElevenLabs. The ElevenLabs key never leaves the server. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  const userId = await authenticate(req, serviceClient());
  if (userId instanceof Response) return userId;
  if (rateLimited(`tts:${userId}`, 20)) return fail(429, 'rate_limited', 'Voice is resting — try again in a minute.');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return fail(503, 'not_configured', 'Voice is off: ELEVENLABS_API_KEY is not set on the server.');

  let text: string | null = null;
  try {
    text = parseTtsRequest(JSON.parse(await req.text()));
  } catch {
    /* handled below */
  }
  if (!text) return fail(400, 'invalid_request', `Text must be 1-${MAX_TEXT} characters.`);

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': apiKey, accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5' }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    return fail(504, 'voice_unavailable', 'Could not reach the voice service.');
  }
  if (!upstream.ok || !upstream.body) {
    console.error('elevenlabs failed', upstream.status, (await upstream.text()).slice(0, 300));
    if (upstream.status === 429) return fail(429, 'rate_limited', 'Voice quota reached. Try again later.');
    return fail(502, 'voice_unavailable', 'The voice service could not speak just now.');
  }
  return new Response(upstream.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
}
