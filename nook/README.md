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
| `world.js`, `worldapp.js`, `worldgame.js` | The walkable island World and its games. |

## Notes

- Call matches, replies, challenges and party invites are **simulated** until there is a matching server.
- The chat filter runs in the browser; a server must run the same check before relaying messages.
