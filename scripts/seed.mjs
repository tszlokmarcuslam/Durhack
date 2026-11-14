// Seeds test players for trying out companion search. Dev projects only.
//   npm run seed            create/update the test players
//   npm run seed -- --clean delete them again
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const all = { is_discoverable: true, share_location: true, share_education: true, share_interests: true };
// The last three exist to prove the privacy rules: they must not leak through search.
const PLAYERS = [
  { username: 'ada_l', display_name: 'Ada', location_city: 'Manchester', university: 'University of Manchester', subject: 'Mathematics', interests: ['chess', 'climbing'], bio: 'Number theory nerd.', ...all },
  { username: 'ben_k', display_name: 'Ben', location_city: 'Manchester', university: 'Durham University', subject: 'Maths and Physics', interests: ['guitar', 'football'], bio: 'Looking for a study group.', ...all },
  { username: 'chen_w', display_name: 'Chen', location_city: 'Durham', university: 'Durham University', subject: 'Computer Science', interests: ['chess', 'game dev'], bio: 'Hackathon regular.', ...all },
  { username: 'dina_r', display_name: 'Dina', location_city: 'Leeds', university: 'University of Leeds', subject: 'Music', interests: ['piano', 'running'], bio: 'Jam sessions welcome.', ...all },
  { username: 'hidden_city', display_name: 'Eli (hides city)', location_city: 'Manchester', university: 'Newcastle University', subject: 'Mathematics', interests: ['chess'], bio: null, ...all, share_location: false },
  { username: 'hidden_edu', display_name: 'Fay (hides education)', location_city: 'Manchester', university: 'University of Manchester', subject: 'Mathematics', interests: ['yoga'], bio: null, ...all, share_education: false },
  { username: 'not_discoverable', display_name: 'Gus (opted out)', location_city: 'Manchester', university: 'University of Manchester', subject: 'Mathematics', interests: ['chess'], bio: null, ...all, is_discoverable: false },
];
const emailFor = (p) => `seed_${p.username}@echoworld.test`;

const { data: listed, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const existing = new Map(listed.users.map((u) => [u.email, u.id]));

if (process.argv.includes('--clean')) {
  for (const p of PLAYERS) {
    const id = existing.get(emailFor(p));
    if (!id) continue;
    const { error } = await db.auth.admin.deleteUser(id); // profile row cascades
    if (error) throw error;
    console.log('deleted', p.username);
  }
  process.exit(0);
}

for (const p of PLAYERS) {
  let id = existing.get(emailFor(p));
  if (!id) {
    // Random password that is never stored: these accounts are not meant to be signed into.
    const { data, error } = await db.auth.admin.createUser({ email: emailFor(p), password: randomUUID(), email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  const { error } = await db.from('profiles').upsert({ id, ...p });
  if (error) throw error;
  console.log('seeded', p.username);
}
