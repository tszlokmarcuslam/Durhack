// Community tags (#Manchester, #LGBTQSociety, #JazzPiano). Shared by the browser and the server.
// A tag is shown as typed (CamelCase), but matched by its key: lowercase letters and digits only,
// so "#Jazz Piano", "jazzpiano" and "JazzPiano" all match. The database computes the same key
// (supabase/migrations/003_community_tags.sql), so keep these two in step.

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 30;

export const tagKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Turns free text like "#jazz piano" into a display tag ("JazzPiano"), or null if it isn't usable. */
export function toTag(text: string): string | null {
  const tag = text
    .replace(/^#+/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
  return tag.length >= 2 && tag.length <= MAX_TAG_LENGTH ? tag : null;
}

/** Suggestions grouped for the settings picker. Players can also add their own. */
export const CURATED_TAGS: { group: string; tags: string[] }[] = [
  { group: 'Community', tags: ['InternationalStudents', 'FirstGen', 'MatureStudents', 'Commuters', 'Postgrads', 'LGBTQSociety'] },
  { group: 'Societies', tags: ['Hackathons', 'ComputingSociety', 'ChessSociety', 'DebateSociety', 'DramaSociety', 'MusicSociety'] },
  { group: 'Study', tags: ['Maths', 'Physics', 'ComputerScience', 'Medicine', 'Law', 'Economics'] },
  { group: 'Sport & fitness', tags: ['Weightlifting', 'Running', 'Climbing', 'Football', 'Yoga', 'Swimming'] },
  { group: 'Arts & hobbies', tags: ['JazzPiano', 'Guitar', 'Photography', 'Gaming', 'Cooking', 'Anime'] },
];
