# Nook Meet (standalone page)

The Nook design as a working page: 3D avatars, random video calls with people around the world,
webcam body tracking, and 1v1 boxing inside a call.

## Run it

From the repo root, with the app's `.env` filled in (see `.env.example`):

```bash
npm install
```
```bash
npm run dev
```

Then open http://localhost:5173/ (it forwards to `/nook/`) in Chrome (the camera needs Chrome or another full browser).

Running through the app's dev server is what connects the page to the backend: accounts, real friends and
parties (Supabase, migration `005_friends_parties.sql`) and the AI companion (`/api/companion`, Gemini).
Opened from any other static server the page still works, but those three show a "needs the app server" message.

## What's here

| File | What it does |
| --- | --- |
| `index.html` | All screens: home, Body scan, call, boxing HUD, World. Uses the design runtime in `support.js`. |
| `nook3d.js` | three.js scenes: home island, avatar builder, call room, searching globe. |
| `tracking.js` | Webcam tracking with MediaPipe (face + full body, plus hands only during rock paper scissors). The picture stays in the browser. |
| `rps.js` | Rock paper scissors in World: reads fist / open hand / two fingers from the hand points, runs the rounds (first to 2, 3 or 5). Tests: `npx vitest run nook/rps.test.mjs`. |
| `moves.js` | World boxing rules (jab beats standing still, a dodge beats a jab, a hook catches a dodge to its side), reading dodges and punches from the camera, and the plank's whole-body check. Tests: `npx vitest run nook/moves.test.mjs`. |
| `fpv.js` | First-person view for World boxing and rock paper scissors: the drone-style camera move into your avatar's eyes and back out. |
| `arena.js` | 1v1 boxing in a call: Matrix-style dissolve of the room into a ring, punches, guard, KO. |
| `moderation.js` | Chat filter that blocks hateful language (slurs, hate phrases, l33t/spaced variants). |
| `backend.js` | Accounts, friends, parties and who's online (same Supabase functions as the React app) and the AI companion. |
| `callnet.js` | Real random calls: online count, matchmaking lobby, call rooms, live pose streaming, peer-to-peer voice. |
| `glass.js` | Liquid Glass buttons: the bent, colour-split look behind every `.lg` element (Chrome), frosted glass elsewhere. |
| `world.js`, `worldapp.js`, `worldgame.js` | The walkable island World and its games. |
| `worldgen.js` | Generated worlds: a seed becomes a whole look for the island (theme, time of day, colours, decorations, weather). |
| `rocket.js` | Rocket race (World game): fly the same seeded asteroid field as the other player from your cockpit, steer with your body or A/D/W/S, crashes and progress show at the top. |
| `chess.js` | Chess rules and the computer player (World game: sit at the table, play on the 2D board on the left). Tests: `npx vitest run nook/chess.test.mjs`. |

## Accounts, tags and Google sign-in

Tap **Sign in** (top right) and choose **Continue with Google**, or use an email and password.
The first time anyone signs in, they get a personal tag made from their name, like `@damon_4821`.
Tapping the tag (in the account panel, or under **Friends**) copies it. Friends add each other by pasting a tag
into **Friends → Add a friend by tag**. Capitals and a leading `@` don't matter.

Google sign-in needs a one-time setup in Supabase and Google Cloud:

1. In `.env` set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API), then restart `npm run dev`.
   Run `supabase/schema.sql` and the files in `supabase/migrations/` in the SQL editor if this project doesn't have them yet.
2. In Google Cloud Console → APIs & Services:
   - set up the **OAuth consent screen** (External). While it is in Testing, add each teammate as a test user, or publish it.
     Name, email and photo need no Google review.
   - create **Credentials → OAuth client ID → Web application**:
     - Authorised JavaScript origins: `http://localhost:5173` (plus the deployed site's address)
     - Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. In Supabase → Authentication → Sign In / Providers → **Google**: switch it on and paste the client ID and secret.
4. In Supabase → Authentication → URL Configuration → Redirect URLs, add `http://localhost:5173/**` (and the deployed site, for example `https://your-site.vercel.app/**`).

Until step 3 is done, the Google button says Google sign-in isn't switched on yet. Email sign-in still works.

## Worlds with friends

**Worlds → Create a world** generates a world from a random seed: a name, a theme (Summer, Autumn, Blossom, Frost,
Tropic, Dreamy), a time of day, roof, wall and door colours, decorations on free ground, and falling leaves, petals,
snow or fireflies. 🎲 generates another. Tick the friends to bring and press **Create and go**: you walk in and they get
an invite. Everyone with the same seed builds the same map, so friends who join share one world. Each world is its own
room (`worldapp.js` tags every message with the world's id), so you only see the people in your world.
Your worlds are listed under **Your worlds** (kept in this browser) with Join buttons. **Join Nook Island** is the open
island everyone shares. Invites reach friends who have Nook open: signed in, over Supabase; signed out, other windows
of the same browser.

## Real calls (like Omegle, with 3D avatars)

Pressing **Call** puts you straight into a shared lobby on Supabase Realtime and pairs you with the first
person anywhere in the world. No account is needed. Once matched:

- each side sends its avatar look, then a live stream of its webcam body tracking (about 12 times a second),
  so you see the other person's 3D avatar move as they do. The camera picture itself never leaves the device;
- voice is peer-to-peer WebRTC audio, with a mute button (STUN only, so a few strict networks can't connect voice;
  chat still works there);
- chat (filtered on both ends), Add friend (a real friend request when both are signed in), party invites
  (friends with accounts) and 1v1 boxing all go over the call room. In boxing, each side resolves punches against
  its own guard and reports the damage back, so both health bars stay in sync.

Everyone must use the same Supabase project (the keys in `.env`) to find each other: either all run the app
locally with the same keys, or open the same deployed site. Without keys, calls run in **test mode** and only
match tabs of the same browser. When nobody else is searching, "Practise with a bot" starts the old simulated match.

## Notes

- The chat filter runs in the browser on both ends of a call; messages are not checked by a server.
- Texts between friends (**Friends → Text**) are live-only: nothing is stored on a server, so a text only arrives while the friend has Nook open. Demo friends answer with made-up replies.
