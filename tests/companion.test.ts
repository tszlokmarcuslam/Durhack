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
    expect(result).toEqual({ reply: 'Meet Ada!', players: [ada] });
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
