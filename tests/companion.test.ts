import { describe, expect, it, vi } from 'vitest';
import { escapeLike, toPublicPlayer, validateSearchFilters, type ProfileSearchRow } from '../server/lib/playerSearch';
import { runCompanionTurn } from '../server/lib/gemini';
import { parseCompanionRequest } from '../api/companion';
import type { PublicPlayer } from '../src/types/companion';

const row: ProfileSearchRow = {
  id: '1',
  username: 'ada',
  display_name: 'Ada',
  location_city: 'Manchester',
  university: 'UoM',
  subject: 'Maths',
  interests: ['chess'],
  bio: 'hi',
  share_location: true,
  share_education: true,
  share_interests: true,
  is_discoverable: true,
};

describe('validateSearchFilters', () => {
  it('accepts and normalises valid filters', () => {
    expect(validateSearchFilters({ city: ' Manchester ', interests: ['Chess'] })).toEqual({
      ok: true,
      value: { city: 'Manchester', interests: ['chess'], limit: 5 },
    });
  });
  it.each([
    [{}],
    [null],
    [{ city: '' }],
    [{ city: 'x'.repeat(61) }],
    [{ city: 'a\nb' }],
    [{ subject: 5 }],
    [{ city: 'York', limit: 500 }],
    [{ city: 'York', limit: 1.5 }],
    [{ interests: [] }],
    [{ interests: ['a', 'b', 'c', 'd', 'e', 'f'] }],
    [{ city: 'York', sql: 'drop table profiles' }],
  ])('rejects %j', (input) => {
    expect(validateSearchFilters(input).ok).toBe(false);
  });
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_a\\')).toBe('100\\%\\_a\\\\');
  });
});

describe('toPublicPlayer', () => {
  it('drops non-discoverable profiles', () => {
    expect(toPublicPlayer({ ...row, is_discoverable: false })).toBeNull();
  });
  it('omits fields the owner does not share', () => {
    expect(toPublicPlayer({ ...row, share_location: false, share_education: false, share_interests: false })).toEqual({
      id: '1',
      username: 'ada',
      displayName: 'Ada',
      bio: 'hi',
    });
  });
});

describe('parseCompanionRequest', () => {
  it('rejects bad roles and oversized messages', () => {
    expect(parseCompanionRequest({ message: 'hi', history: [{ role: 'system', text: 'x' }] })).toBeNull();
    expect(parseCompanionRequest({ message: 'x'.repeat(1001) })).toBeNull();
    expect(parseCompanionRequest({ message: ' hi ' })).toEqual({ message: 'hi', history: [] });
  });
});

function geminiReply(parts: unknown[]) {
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] }));
}

describe('runCompanionTurn', () => {
  const ada: PublicPlayer = { id: '1', username: 'ada', displayName: 'Ada' };

  it('runs a validated search and returns only database players', async () => {
    const search = vi.fn(async () => [ada]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(geminiReply([{ functionCall: { name: 'search_players', args: { city: 'Manchester', subject: 'maths' } } }]))
      .mockResolvedValueOnce(geminiReply([{ text: 'Meet Ada!' }]));
    const result = await runCompanionTurn({ apiKey: 'k', model: 'm', search, fetchImpl }, [], 'find someone');

    expect(search).toHaveBeenCalledWith({ city: 'Manchester', subject: 'maths', limit: 5 });
    expect(result).toEqual({ reply: 'Meet Ada!', players: [ada], expression: 'happy', board: [] });
    // key travels in a header, and the tool result is fed back to the model
    expect(fetchImpl.mock.calls[0][0]).not.toContain('k=');
    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(secondBody.contents.at(-1).parts[0].functionResponse.response.count).toBe(1);
  });

  it('never executes a search with invalid filters', async () => {
    const search = vi.fn(async () => [ada]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(geminiReply([{ functionCall: { name: 'search_players', args: { sql: 'select *' } } }]))
      .mockResolvedValueOnce(geminiReply([{ text: 'Sorry.' }]));
    const result = await runCompanionTurn({ apiKey: 'k', model: 'm', search, fetchImpl }, [], 'x');
    expect(search).not.toHaveBeenCalled();
    expect(result.players).toEqual([]);
  });

  it('reports search failure to the model instead of results', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(geminiReply([{ functionCall: { name: 'search_players', args: { city: 'York' } } }]))
      .mockResolvedValueOnce(geminiReply([{ text: 'Search is down.' }]));
    const search = async () => {
      throw new Error('db down');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runCompanionTurn({ apiKey: 'k', model: 'm', search, fetchImpl }, [], 'x');
    expect(result.players).toEqual([]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).contents.at(-1).parts[0].functionResponse.response.error).toBeTruthy();
  });

  it('throws on upstream errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('no', { status: 500 }));
    await expect(runCompanionTurn({ apiKey: 'k', model: 'm', search: async () => [], fetchImpl }, [], 'x')).rejects.toThrow();
  });
});

describe('parseTtsRequest', () => {
  it('accepts trimmed text and rejects empty, oversized or non-string text', async () => {
    const { parseTtsRequest } = await import('../api/tts');
    expect(parseTtsRequest({ text: ' hi ' })).toEqual({ text: 'hi' });
    expect(parseTtsRequest({ text: 'hi', voiceId: 'EXAVITQu4vr4xnSDxMaL' })).toEqual({ text: 'hi', voiceId: 'EXAVITQu4vr4xnSDxMaL' });
    expect(parseTtsRequest({ text: 'hi', voiceId: 'some-paid-voice' })).toBeNull();
    expect(parseTtsRequest({ text: 'hi', voiceId: '../../v1/user' })).toBeNull();
    expect(parseTtsRequest({ text: '   ' })).toBeNull();
    expect(parseTtsRequest({ text: 'x'.repeat(601) })).toBeNull();
    expect(parseTtsRequest({ text: 5 })).toBeNull();
    expect(parseTtsRequest(null)).toBeNull();
  });
});

describe('parseReplyTags', () => {
  it('extracts mood and board lines and strips the tags', async () => {
    const { parseReplyTags } = await import('../server/lib/replyTags');
    expect(parseReplyTags('<mood>surprised</mood><board>a² + b² = c²| c = √(a²+b²) </board> Pythagoras!')).toEqual({
      reply: 'Pythagoras!',
      expression: 'surprised',
      board: ['a² + b² = c²', 'c = √(a²+b²)'],
    });
  });
  it('falls back safely on missing, unknown or oversized tags', async () => {
    const { parseReplyTags } = await import('../server/lib/replyTags');
    expect(parseReplyTags('Hi there')).toEqual({ reply: 'Hi there', expression: 'happy', board: [] });
    expect(parseReplyTags('<mood>evil</mood>Hi').expression).toBe('happy');
    const long = parseReplyTags(`<board>${'x'.repeat(50)}|b|c|d</board>ok`);
    expect(long.board).toEqual(['x'.repeat(32), 'b', 'c']);
    expect(parseReplyTags('ok </mood> <board>').reply).toBe('ok');
  });
});

describe('toSpeech', () => {
  it('reads maths symbols as words and leaves plain text alone', async () => {
    const { toSpeech } = await import('../server/lib/speech');
    expect(toSpeech('a² + b² = c²')).toBe('a squared plus b squared equals c squared');
    expect(toSpeech('x = (−b ± √(b² − 4ac)) / 2a')).toBe('x equals (minus b plus or minus the square root of (b squared minus 4ac)) over 2a');
    expect(toSpeech('Study for 25 minutes, then a 5-minute break.')).toBe('Study for 25 minutes, then a 5-minute break.');
    expect(toSpeech('3 × 4 = 12 and 90°')).toBe('3 times 4 equals 12 and 90 degrees');
  });
});

describe('profile settings', () => {
  it('accepts a valid profile and round-trips it through a database row', async () => {
    const { emptyProfile, validateProfile, toRow, fromRow } = await import('../src/types/profile');
    const form = {
      ...emptyProfile(),
      username: 'ada_l',
      displayName: ' Ada ',
      city: 'Manchester',
      tags: ['Chess', 'JazzPiano'],
      social: { website: 'https://ada.dev', github: '', linkedin: '', instagram: '' },
      isDiscoverable: true,
    };
    expect(validateProfile(form)).toEqual({});
    const row = toRow('u1', form);
    expect(row).toMatchObject({ display_name: 'Ada', interests: ['Chess', 'JazzPiano'], social_links: { website: 'https://ada.dev' }, university: null });
    expect(fromRow(row)).toMatchObject({ displayName: 'Ada', tags: ['Chess', 'JazzPiano'], isDiscoverable: true });
  });

  it('starts private and rejects bad input', async () => {
    const { emptyProfile, validateProfile } = await import('../src/types/profile');
    const blank = emptyProfile();
    expect([blank.isDiscoverable, blank.shareLocation, blank.shareEducation, blank.shareInterests]).toEqual([false, false, false, false]);
    const errors = validateProfile({
      ...blank,
      username: 'a b',
      displayName: '',
      bio: 'x'.repeat(301),
      tags: Array.from({ length: 13 }, (_, i) => `Tag${i}`),
      social: { website: 'javascript:alert(1)', github: 'http://github.com/x', linkedin: '', instagram: '' },
    });
    expect(Object.keys(errors).sort()).toEqual(['bio', 'displayName', 'github', 'tags', 'username', 'website']);
  });
});

describe('community tags', () => {
  it('turns free text into display tags and matching keys', async () => {
    const { toTag, tagKey } = await import('../src/types/tags');
    expect(toTag('#jazz piano')).toBe('JazzPiano');
    expect(toTag('LGBTQ Society')).toBe('LGBTQSociety');
    expect(toTag('#')).toBeNull();
    expect(toTag('x'.repeat(31))).toBeNull();
    expect(tagKey('#Jazz Piano')).toBe('jazzpiano');
    expect(tagKey('JazzPiano')).toBe(tagKey('jazz-piano'));
  });
  it('search filters use tag keys, so spelling and case do not matter', () => {
    expect(validateSearchFilters({ interests: ['#Jazz Piano', 'jazzpiano', 'LGBTQ Society'] })).toEqual({
      ok: true,
      value: { interests: ['jazzpiano', 'lgbtqsociety'], limit: 5 },
    });
    expect(validateSearchFilters({ interests: ['###'] }).ok).toBe(false);
  });
});

describe('production static files', () => {
  it('serves files and folder index pages, and nothing outside the site folder', async () => {
    const { findFile } = await import('../server/lib/staticFiles');
    const { resolve, join } = await import('node:path');
    const root = resolve('nook');
    expect(await findFile(root, '/')).toBe(join(root, 'index.html'));
    expect(await findFile(root, '/bot.js')).toBe(join(root, 'bot.js'));
    expect(await findFile(root, '/missing.js')).toBeNull();
    for (const evil of ['/../.env', '/..%2f.env', '/%2e%2e/package.json', '/%E0%A4%A']) {
      expect(await findFile(root, evil)).toBeNull();
    }
  });
});

describe('multiplayer messages', () => {
  it('accepts valid positions and clamps them to the world', async () => {
    const { parsePosition } = await import('../src/world/multiplayer');
    expect(parsePosition({ x: 1, z: -2, h: 0.5 })).toEqual({ x: 1, z: -2, heading: 0.5 });
    expect(parsePosition({ x: 1e9, z: -1e9, h: 0 })).toEqual({ x: 19, z: -19, heading: 0 });
  });
  it('rejects malformed positions and identities', async () => {
    const { parsePosition, parseIdentity } = await import('../src/world/multiplayer');
    expect(parsePosition({ x: 'a', z: 0, h: 0 })).toBeNull();
    expect(parsePosition({ x: NaN, z: 0, h: 0 })).toBeNull();
    expect(parsePosition(null)).toBeNull();
    expect(parseIdentity({ displayName: '' })).toBeNull();
    expect(parseIdentity({ displayName: 'x'.repeat(80), username: 'bad name!' })).toEqual({ displayName: 'x'.repeat(40), username: '' });
    expect(parseIdentity({ displayName: ' Ada ', username: 'ada_l' })).toEqual({ displayName: 'Ada', username: 'ada_l' });
  });
});
