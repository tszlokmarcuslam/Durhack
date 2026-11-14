import { authHeaders } from './companionApi';

let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  current?.pause();
  current = null;
}

/**
 * Speaks text with the server's ElevenLabs voice. Resolves when playback ends.
 * Throws with a user-facing message if voice is unavailable.
 */
export async function speak(text: string, voiceId: string, onStart?: () => void): Promise<void> {
  stopSpeaking();
  let res: Response;
  try {
    res = await fetch('/api/tts', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ text, voiceId }) });
  } catch {
    throw new Error("Can't reach the voice service.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Voice failed (${res.status}).`);
  }
  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);
  current = audio;
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onpause = () => resolve(); // stopped by a newer reply
      audio.onerror = () => reject(new Error('Could not play the voice audio.'));
      audio.play().then(onStart, () => reject(new Error('The browser blocked audio. Click the page and try again.')));
    });
  } finally {
    URL.revokeObjectURL(url);
    if (current === audio) current = null;
  }
}
