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

Then open http://localhost:5173/nook/ in Chrome (the camera needs Chrome or another full browser).

Running through the app's dev server is what connects the page to the backend: accounts, real friends and
parties (Supabase, migration `005_friends_parties.sql`) and the AI companion (`/api/companion`, Gemini).
Opened from any other static server the page still works, but those three show a "needs the app server" message.

## What's here

| File | What it does |
| --- | --- |
| `index.html` | All screens: home, Body scan, call, boxing HUD, World. Uses the design runtime in `support.js`. |
| `nook3d.js` | three.js scenes: home island, avatar builder, call room, searching globe. |
| `tracking.js` | Webcam tracking with MediaPipe (face + full body). The picture stays in the browser. |
| `arena.js` | 1v1 boxing in a call: Matrix-style dissolve of the room into a ring, punches, guard, KO. |
| `moderation.js` | Chat filter that blocks hateful language (slurs, hate phrases, l33t/spaced variants). |
| `backend.js` | Accounts, friends, parties and who's online (same Supabase functions as the React app) and the AI companion. |
| `callnet.js` | Real random calls: online count, matchmaking lobby, call rooms, live pose streaming, peer-to-peer voice. |

## Real calls (like Omegle, with 3D avatars)

Pressing **Call → Start a call** puts you in a shared lobby on Supabase Realtime and pairs you with the first
compatible person anywhere (the region chips filter both ways). No account is needed. Once matched:

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
| `world.js`, `worldapp.js`, `worldgame.js` | The walkable island World and its games. |

## Notes

- Call matches, replies, challenges and party invites are **simulated** until there is a matching server.
- The chat filter runs in the browser; a server must run the same check before relaying messages.
