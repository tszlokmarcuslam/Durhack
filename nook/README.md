# Nook Meet (standalone page)

The Nook design as a working page: 3D avatars, random video calls with people around the world,
webcam body tracking, and 1v1 boxing inside a call.

## Run it

Any static server works, for example from the repo root:

```bash
python3 -m http.server 5191 --directory nook
```

Then open http://localhost:5191 in Chrome (the camera needs Chrome or another full browser).

## What's here

| File | What it does |
| --- | --- |
| `index.html` | All screens: home, Body scan, call, boxing HUD, World. Uses the design runtime in `support.js`. |
| `nook3d.js` | three.js scenes: home island, avatar builder, call room, searching globe. |
| `tracking.js` | Webcam tracking with MediaPipe (face + full body). The picture stays in the browser. |
| `arena.js` | 1v1 boxing in a call: Matrix-style dissolve of the room into a ring, punches, guard, KO. |
| `moderation.js` | Chat filter that blocks hateful language (slurs, hate phrases, l33t/spaced variants). |
| `world.js`, `worldapp.js`, `worldgame.js` | The walkable island World and its games. |

## Notes

- Call matches, replies, challenges and party invites are **simulated** until there is a matching server.
- The chat filter runs in the browser; a server must run the same check before relaying messages.
