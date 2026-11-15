# Nook anime look

The anime avatar and the big resting island used by Nook (home screen, avatar creator, calls, World and the
World games). Made in Blender from simple shapes; `anime.js` reads the `.glb` files itself, so no three.js add-ons
or import maps are needed.

| File | What it is |
| --- | --- |
| `anime.js` | Loads the files, builds avatars (`buildAvatar`, `pose`), the island (`buildIsland`), sky by the clock, heights (`hAt`). Also `OPTIONS` / `PRESETS` for the creator. |
| `character.glb`, `character.json` | The character (all hair styles; one is shown per avatar) and its face layout. |
| `island.glb`, `island.json` | The island, plus its data: ground heights, things to walk around, the house, the dock, places to rest. |

## How Nook uses it

- `nook3d.js` imports `anime.js`: avatars keep the old parts (`userData.body, head, arms, elbows, legs, knees, feet`
  by side), so tracking, calls and games work unchanged. The hand is 0.31 below the elbow; the head's position is
  its centre.
- `world.js` walks on the island with `kit.island.json`: the house (door, inside, see-through walls and roof when you
  are in), and resting at the bed, sofa, armchair, bench, hammock, campfire, dock and beach towels. Other players
  see you resting (`state().rest`).
- The sky follows the device clock. Games freeze it while they dim the world.

Console checks: `nookIsland.setHour(13)` (null = the clock), `nookWorld.world.rest('bed')`, `nookWorld.world.spots()`.
In a slow browser, `window.nookMaxStep = .4` lets the animation take bigger steps.

## Changing the art

The Blender scripts live with the character project (`character-test/tools/` on the 3D-models branch):
`simple.py` (run with `LITE = True` for these files) and `nook_island.py`. `sync_nook.sh` copies the results here.
