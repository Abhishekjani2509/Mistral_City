# Handoff: Mistral City renderer

**Read this first, then `README.md` for the API.**

## What this is

The visual layer for Mistral City: a codebase rendered as a top-down pixel town where agents
are cats. It is done and it works. It is not a mockup.

- 61 fps with the full town, 91 entities and live particles
- 111 sprites, all generated in code, **zero image files**
- ~100 KB, one file, no dependencies, no build step
- Retina-aware, `destroy()` is clean, unknown inputs degrade instead of throwing

## Decisions already made, please do not relitigate under time pressure

1. **No game engine.** Excalibur was considered and rejected *for this week*. Nothing on the
   critical path is a rendering problem, and the sprites are generated canvases rather than
   files, so an engine's asset pipeline fights us. If someone ports later, only the draw loop
   and input handlers change: the model is plain JSON and sprites are `HTMLCanvasElement`s,
   which Excalibur, Pixi and Phaser all accept as texture sources.
2. **Two legibility rules. Anything new must obey them.**
   - **Ear roof + orange ramp = Mistral runs it.** Scenery buildings get flat or plain gable
     roofs in grey, brown or blue. This is how a viewer knows what is clickable.
   - **Collar + tool = agent.** Town cats are the same body with no collar, muted fur.
3. **Integer zoom only** (1 to 4). Fractional scale on pixel art looks like a compression
   artifact. The code did not actually honour this: it multiplied by 1.11 per wheel event and
   sat on fractional values. It now steps to whole numbers and eases between them, so it
   comes to rest on an integer but still moves like a map.
4. **The camera never moves on its own during a demo.** The presenter drives.
5. **Sprites are anchored bottom-centre on a 16px grid**, drawn upright, never skewed.

## The seams

| Who | Sends | Call |
|---|---|---|
| Repo intelligence | semantic systems, health, issues | `city.setModel(json)` |
| Agent runtime | five event types, streamed not batched | `city.onEvent(evt)` |
| Demo | a recorded event log | `city.replay(log)` |
| Security checks | ids of passing checks | `city.setSecurity(ids)` |

Shapes are in `README.md`, working payloads in `examples/`.

## Changed since the first handoff

1. **The security level now redresses the whole map.** Ground, paths, props, light and bird
   count all move with it, not just the Town Hall plot. The per-level art already existed in
   `districtGround` and `sceneLayout` but was only reachable from the dead `fullView()`.
   See the table in `README.md`.
2. **Zoom is stepped, eased and pointer-anchored.** One wheel gesture is one step.
3. **`cat-runtime-adapter.js`** bridges `contracts/cat-events.ts` to `onEvent`. The two
   contracts did not line up, so nothing rendered when they were wired together.
4. **Typography.** The letterspaced uppercase labels, grey label text and hairlines that
   floated inside padded cards are gone. Tick and cross are pixel SVG drawn from row strings
   like every other sprite here, so still no image files.
5. **`topiary` now exists.** `RING` level 5 referenced it twice and it had no sprite, so the
   `if(!sp)return` guard silently dropped two waterfront props on every frame.
6. New API: `checks()`, `levels()`, `securityLevel()`, and `state()` gained `zoom` and `level`.

## Next tasks, in priority order

1. **Wire the real scanner output to `setModel`.** Three systems with made-up health is enough
   to start; do not wait for the full scan. Validate `kind` against the allowed list on the
   producer side so the fallback is never silently hit.
2. **Wire the agent runtime to `onEvent`.** Get `agent.start` and `agent.done` working with the
   middle hardcoded first, then fill in the log lines. That alone proves the whole story.
3. **Record an event log to a JSON file during a good run.** That file is the on-stage fallback
   via `replay()`. This is the highest value insurance item and it is always left too late.
4. **Wire `setSecurity` to the real checks.** Level = number of the five that pass. The five are
   secrets in the repo, critical CVEs, session cookie flags, parameterised queries + input
   validation, security headers and CORS.
5. Only then: banner wave, water shimmer, day/night. Each is a two-frame swap, 20 to 30 min.

## Known things

- **`demo.html` needs an http server**, not `file://`. ES modules are blocked over file.
- **React 18 StrictMode** mounts, unmounts and remounts in dev. `destroy()` in the effect
  cleanup is mandatory or two render loops run at once and it reads as a perf bug.
- **Frame-count timing is a trap.** Anything paced by frames runs at half speed on a 30 Hz
  projector and stops entirely on a hidden tab, where `requestAnimationFrame` does not fire.
  The zoom cooldown and the camera easing both use `performance.now()` for this reason. Do
  not reintroduce a frame counter as a clock.
- **90% of draw calls are ground tiles** redrawn every frame (~1,260 of 1,407). If the demo
  machine or the projector is slow, pre-render the tilemap into one offscreen canvas and blit a
  region: drops to under 150 calls, about 20 minutes of work. Do not do it pre-emptively.
- **External displays often force 30Hz.** Anything tuned by frame count rather than elapsed time
  runs at half speed. Test on the real output before presenting.
- `fullView()` is in the file but unused by the module. It renders the wide level mockups. Keep
  or delete, it costs nothing at runtime.

## Where the design lives

Art direction, the five Town Hall levels, the UX spec, the sprite sheet and a sandbox with live
dials for level, shrubbery density and scenery count:

https://claude.ai/code/artifact/abb9f47d-d8cd-444d-810c-91c1f1661574
