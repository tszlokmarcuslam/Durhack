## Inspiration

University is supposed to be where you meet people, but most of us only meet the people on our own course, in our own city. Societies, hackathons and group chats help, yet there's no easy way to bump into a maths student in Manchester or a jazz pianist in Leeds.

Random video chat apps get the "bump into a stranger" part right. They also feel unsafe, mostly because the first thing you share is your face. We wanted a softer version: **meet people as a 3D avatar first**, on a small island you can walk around, with a friendly AI companion that helps you find people you actually have something in common with.

That became **Nook Meet**: random 3D calls, a shared island world, mini-games, friends and parties, and a flying robot companion called **Echo**.

## What it does

- **3D calls with strangers, without showing your face.** Press *Call* and you're matched with someone online. Your webcam drives your avatar through body tracking, but the video never leaves your browser. Only your pose is sent, about 12 times a second. Voice is peer-to-peer. *Next* and *Stop* work the way you'd expect.
- **An island to hang out on.** Walk around a shared world with other players, talk with voice, and play together:
  - first-person **boxing** (jab, hook, dodge)
  - hand-tracked **rock paper scissors**
  - **push-ups, squats and plank** challenges counted by the camera
  - **chess** and a **rocket** game
- **Friends and parties.** Everyone gets a tag like `@name_1234`. You can:
  - add people by tag, or with a right-click on their avatar
  - see who's online
  - text and call friends
  - make a party and invite friends into an activity
- **Echo, the AI companion.** A little cat-eared robot that flies beside you. Ask it anything, or ask it to find people: *"someone in Manchester who studies maths"*, *"anyone into jazz piano?"*. It speaks with a real voice. Its face changes with what it's saying. When it explains maths, it scribbles on a handheld whiteboard.
- **Privacy you control.** Profiles start hidden. You choose whether people can find you at all, and separately whether to share your city, university or interests. Community tags like `#LGBTQSociety`, `#Hackathons` or `#Weightlifting` are opt-in.
- **Sign in with Google**, plus a chat filter for hateful language and a night mode.

## How we built it

**Frontend.** There are two front ends that share one backend:

- **The main experience.** Damon designed it as a standalone page built on three.js, with *Liquid Glass*-style menus, an anime avatar and a big island. MediaPipe handles face, body and hand tracking. Calls use WebRTC for peer-to-peer voice, with Supabase Realtime for matchmaking and for streaming poses.
- **The original world prototype.** It's built with **React, Vite, TypeScript, React Three Fiber, Tailwind and Zustand**. It's where Echo, the friend system and the settings screens were born.

**Backend.** We used **Supabase** for auth (email and Google), Postgres and Realtime.

- **Row-level security.** Players can only read and write their own profile row.
- **Friend and party tables.** They have *no* direct access at all. Every action, such as sending a request or inviting to a party, goes through a `SECURITY DEFINER` database function that checks who is calling.
- **Realtime presence.** It powers the online list and the multiplayer world.

**The AI companion.** It runs on **Gemini** with function calling.

- **One tool.** The model gets a single tool, `search_players(city, university, subject, interests, limit)`.
- **Validated filters.** The server checks every argument and rejects unknown fields. Only then does it run a query through the Supabase query builder.
- **Guardrails.** The model never writes SQL. Players in the results always come from the database, never from model text. Search results are returned to the model as data, not instructions.
- **Mood and board tags.** The model tags each reply with a mood and optional whiteboard lines. The server validates both and strips them out.
- **Voice.** **ElevenLabs** provides the voice, with a small converter so `a² + b² = c²` is read aloud as *"a squared plus b squared equals c squared"*.

**Echo itself.**

- **Built in code.** Echo is made entirely from three.js shapes: a rounded head, a visor face, headphone discs, cat ears, a battery-lid torso and floating arms.
- **Animation.** A critically damped spring moves it, so it glides instead of snapping. While it talks it does a *fairy flight* around you, with a sparkle trail and gestures that change every couple of seconds. It goes sleepy after 45 seconds of quiet.

**Hosting.** The site runs on **Render's free tier**.

- **One server.** We wrote a small Node server that serves the built site and runs the AI and voice endpoints with the same handlers as local development.
- **Keys stay server-side.** Every secret key (Gemini, ElevenLabs, the Supabase service key) lives only on the server.
- **Auto-deploy.** Every push to our branch redeploys automatically.

**Testing.**

- **Unit tests.** 67 tests cover input validation, privacy filtering, the AI tool loop, speech conversion, multiplayer message parsing and the exercise and game logic.
- **Live end-to-end scripts.** Separate scripts create throwaway accounts and test search, privacy and the friend rules against the real database.
- **Test bot.** A test bot walks around the world, so you can try multiplayer on your own.

## Challenges we ran into

- **Making an AI that can't lie about people.** An LLM will happily invent a "Sarah from Manchester who loves chess". We designed the search so the model can only *propose filters*. Every player shown comes straight from the database, and privacy is enforced twice: once in the query, and again before anything is sent back.
- **Our model got retired mid-hackathon.** Our first Gemini model returned *"no longer available to new users"*, and some newer ones timed out. We had to find a model that was fast, available and good at tool calling.
- **A database migration that "ran" but didn't.** The Supabase SQL editor quietly re-ran an old saved query, so our new tag rules never applied. We diagnosed it and rewrote the migration to check itself and print `ok` only when it really worked.
- **Making a robot feel alive.** Getting Echo right took many rounds:
  - The speech bubble covered its face, then its ears.
  - Its animation kept going long after the voice stopped.
  - Numbers like "twenty-five" needed to become `25` on screen but still be read aloud naturally.

  We ended up syncing the performance to the actual audio playback and giving it a neutral face when idle.
- **Merging two front ends.** The two of us built in parallel: a React app on one side, and a standalone three.js page on the other. Merging went smoothly in git. Hosting was harder, because Damon's page only worked through the dev server, which patched its backend file on every request. The production build left the page out entirely. We wrote a small build step that packages the page and builds just that one file. Then we made it the front door.
- **Free-tier limits everywhere.** ElevenLabs limits how many requests can run at once, Render's free plan sleeps after 15 minutes, and Gemini's quota is shared. We designed around all three.
- **Keeping secrets secret.** Some keys belong in the browser and some must never leave the server. We kept the line strict: public keys are prefixed `VITE_`, secret keys exist only on the server, and we scanned for keys before every commit.

## Accomplishments that we're proud of

- **Real calls with no video sent.** Calls between two strangers work in real time, with live body tracking, and no video ever leaves the browser.
- **An honest AI companion.** It searches a real database safely and respects privacy settings, and it never invents a person.
- **Echo's personality.** Echo has real character for something built entirely from boxes, spheres and cones.
- **Security built in from the start.** Row-level security, database-function-only friend logic, validated input and server-side keys were built in from day one, not bolted on at the end.
- **Shipped and live.** It's on a public URL, and it redeploys itself whenever we push.

## What we learned

- **LLM tool calling is powerful, but the guardrails are the real work:** validation, allow-lists, and never trusting model output as data.
- **Supabase row-level security and `SECURITY DEFINER` functions** are a clean way to give users exactly the access they need and nothing more.
- **Realtime systems** take more than sending data. Presence, heartbeats, smoothing between updates, and validating every incoming message all matter.
- **WebRTC and MediaPipe** in the browser can do a surprising amount without any server doing the heavy lifting.
- **"Works on my machine" isn't done.** The gap between the dev server and a production build is real, and hosting early saved us on demo day.
- **Working as a team on one codebase:** branches, merges, and agreeing on which design leads.

## What's next for Nook Meet

- **Secure Realtime.** Lock multiplayer and messages down with Supabase Realtime Authorization (private channels), so positions and texts can't be spoofed.
- **Better voice and video.** Move to LiveKit for group voice and better call quality.
- **Echo everywhere.** Show other players' Echo companions in the world, and let Echo suggest people to call.
- **Moderation.** Add reporting and blocking, and stronger tools for safe calls with strangers.
- **University communities.** Add verified university email sign-in and society-run islands.
