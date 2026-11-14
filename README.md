# EchoWorld

Browser-based multiplayer 3D social world with an AI companion pet. DurHack 2026.

## Status

| Area | State |
| --- | --- |
| 3D world, WASD avatar, mouse camera, following pet | Working |
| Companion chat panel + `/api/companion` (Gemini tool calling) | Working against live Gemini (`gemini-3.5-flash-lite`) |
| Player search (validated filters, discoverable-only) | Working against live Supabase; verified by `npm run e2e -- http://localhost:5173` after `npm run seed` |
| Email/password sign-in | Minimal form; not yet tested by hand in the browser |
| Profiles UI, multiplayer sync, voice, friends, study session, webcam | Not started |

## Architecture

```
Browser (React + R3F + Zustand)
  └─ POST /api/companion  (Bearer: Supabase access token)
        ├─ verifies the token with Supabase Auth
        ├─ validates the body, rate-limits per user
        ├─ calls Gemini with one tool: search_players(city, university, subject, interests, limit)
        │     └─ tool args are validated, then run through the Supabase query builder
        │        (service role, server only) — discoverable profiles only, shared fields only
        └─ returns { reply, players, mode }   ← players are database rows, never model text
```

- The model never writes SQL; it can only propose filters, and unknown keys are rejected.
- Privacy is enforced twice: in the query (`is_discoverable`, `share_*`) and again in `toPublicPlayer`.
- Browser RLS lets a player read/write only their own profile row. Other profiles are reachable only via the server.
- Secrets (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are read only in `api/` and `server/`.
- In dev, a small Vite plugin serves `/api/companion` with the same handler Vercel runs, so no Vercel CLI is needed.

## Folder structure

```
api/companion.ts            Vercel Edge function (auth, validation, rate limit, error mapping)
server/lib/gemini.ts        Gemini tool-calling loop
server/lib/playerSearch.ts  Filter validation + privacy projection (pure)
server/lib/searchPlayers.ts Supabase query
src/types/                  Types shared by browser and server
src/services/               API clients
src/store/                  Zustand stores
src/components/             UI (CompanionChat, AuthBar)
src/world/                  3D scene (World, Player, Pet)
supabase/schema.sql         Tables, trigger, RLS policies
tests/                      Vitest
```

## Environment variables

See `.env.example`. Public: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Server only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` (optional),
`ELEVENLABS_API_KEY` (voice; optional), `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL` (optional), `ECHO_DEV_MODE`.

`ECHO_DEV_MODE=true` lets the endpoint run without Supabase/Gemini; replies are labelled "Local dev mode"
and no search results are ever invented. **Never set it in production** — without Supabase it skips authentication.

## Run locally

```bash
npm install
```
```bash
npm run dev
```

Open http://localhost:5173. With only `ECHO_DEV_MODE=true` in `.env` you get the world and a labelled dev-mode chat.
To go live: create a Supabase project, run `supabase/schema.sql` in its SQL editor, fill in `.env`, restart.

**Existing Supabase projects:** don't re-run `schema.sql`. Run the files in `supabase/migrations/` in order
(each in a fresh SQL Editor tab, whole file, nothing selected). `004` prints `ok - tag rule updated` when it worked.
`supabase/diagnose_profiles.sql` lists the profile-save rules if tags ever behave oddly.

Checks: `npm run typecheck`, `npm test`, `npm run build`.

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel (framework preset: Vite).
2. Add every variable from `.env.example` in Project → Settings → Environment Variables. Leave `ECHO_DEV_MODE` unset.
3. Deploy. `api/companion.ts` is picked up automatically as an Edge function.

## Manual test checklist

World (Phase 1)
- [ ] WASD/arrows move the avatar relative to the camera; it stops at the world edge.
- [ ] Dragging rotates the camera, scroll zooms, camera follows the avatar.
- [ ] The pet trails the avatar and bobs.
- [ ] Typing in the chat box does not move the avatar.

Companion
- [ ] No `.env`: sending a message shows "Supabase is not configured on the server."
- [ ] `ECHO_DEV_MODE=true` only: reply is labelled "Local dev mode — not an AI reply".
- [ ] Live keys, signed out: "Sign in to talk to your companion."
- [ ] Live keys, signed in: "hello" gets an AI reply; the pet shows "…" then a speech bubble.
- [ ] "Find someone from Manchester who studies maths" lists only seeded profiles with `is_discoverable = true`.
- [ ] A profile with `share_location = false` is not found by city and shows no city.
- [ ] A search with no matches says so; no made-up players.
- [ ] You never appear in your own results.
- [ ] Network tab: no Gemini or service-role key in any request or bundle.
- [ ] Go offline: input disables and the Offline badge shows.
