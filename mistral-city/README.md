# mistral-city

A pixel town that renders a codebase. Zero dependencies, no build step, no image assets.
Every sprite is generated in code and baked once at boot.

## Install

Copy `city/mistral-city.js` into the app. That's it.

## Use

```js
import { mountCity } from './city/mistral-city.js'

const city = mountCity(document.getElementById('city'), {
  onSelect: id => console.log('clicked', id)
})

city.setModel(cityJson)                                  // Paul's scanner output
city.onEvent({ type:'agent.start', agent:'repair', target:'auth' })
city.replay(eventLog)                                    // stage fallback
city.setSecurity(['secrets','deps','session'])           // levels the Town Hall
city.destroy()                                           // cancels the loop, removes the DOM
```

The host element gets `position:relative` if it is static. The renderer owns its canvas and
its `requestAnimationFrame` loop. Nothing outside it should touch either.

## API

| Method | Does |
|---|---|
| `setModel(json)` | Replaces the whole city. Safe to call on every rescan; tears down timers, cats, particles first. |
| `onEvent(evt)` | One agent event. See the five types below. |
| `replay(log, speed)` | Plays an array of events using their `t` offsets in ms. |
| `setSecurity(passedIds)` | Level = number of checks passed, 1 to 5. **Redresses the whole map**, not just the Town Hall. Returns the level. |
| `select(id)` / `deselect()` | Drive the inspector from your own UI. |
| `camera({x,y,z,snap})` | Move the camera. `z` is a whole number, 1 to 4; anything else is rounded and clamped. The move eases unless `snap:true`. |
| `on('select', cb)` | Renderer tells the app what was clicked. |
| `checks()` | `[{id,name}]` for the five security checks, so a host UI can build its own controls. |
| `levels()` | `[{n,name,era,tone,blurb}]` for the five levels. |
| `securityLevel()` | The level right now, 1 to 5. |
| `state()` | `{ health, energy, systems, zoom, level }` |
| `destroy()` | Full teardown. Call it in a React cleanup. |

## The city model

```json
{
  "repo": { "tests": { "pass": 18, "total": 19 } },
  "city": { "health": 78, "security": { "passed": ["secrets","deps"] } },
  "systems": [
    { "id": "auth", "name": "Authentication", "kind": "gate",
      "tx": 15, "ty": 16, "health": 64, "status": "broken",
      "blurb": "Handles logging in and keeping people signed in.",
      "files": ["src/auth/session.ts"],
      "connections": ["tower","db"],
      "issues": [{ "t": "Session does not survive a refresh", "d": "stored in component state" }] }
  ]
}
```

- `kind` is the only field that touches art:
  `tower | gate | workshop | vault | district | house | watch | library | port`.
  **An unknown kind falls back to a generic house instead of throwing.**
- `status` is `healthy | warning | broken | unknown`.
- `tx` / `ty` are tile coordinates on a 36 x 30 grid. **Omit them and systems auto-place on a grid.**
- Everything except `id` is optional.

## The security level drives the whole map

`setSecurity` used to relight one building in the middle of a field. It now
re-skins the entire board, because a repo getting safer should look like the
town getting better, not like the Town Hall twitching.

One call changes, across the full 36 x 30 board:

| | Level 1 Overgrown | Level 5 Fortified |
|---|---|---|
| Ground | overgrown grass, moss, bramble | concrete slabs, planted squares only |
| Paths | dirt, weeds growing through | paved, darker than the plaza, orange markings |
| Props | dead trees, brambles, boulders | steel lamps, bollards, topiary, containers |
| Scenery buildings | roofless stone ruins | glass and slate tower blocks |
| Light | green gloom | warm waterfront daylight |
| Birds | 1 | 6 |
| Town Hall | mossy ruin | Mistral tower |

Levels 2, 3 and 4 sit between the two: timber settlement, stone and plaster
town, concrete and steel.

Ground is themed everywhere, not only under the roads. Paving only the roads
left level 5 as a motorway through a meadow, so the mix walks from all-wild at
level 1 to nearly all-slab at level 5, with greenery surviving as planted
squares inside the pavement. Tile style is picked from a coarse hash so paving
and planting form patches rather than single-tile confetti.

The tile atlas for a level is baked once and cached, so a swap costs about 0.1
to 0.7 ms and does not drop a frame. Draw calls per frame are the same at every
level, so the level is free at render time.

### Scenery buildings

Each level also scatters 13 to 17 filler buildings sized well below any real
system. They obey art rule 2 without exception: **no ear roofs and no orange**,
because that pairing is what tells a viewer a building is a system they can
click. Note that `mkBuilding` defaults both `flat` and `gable` roofs to the
orange ramp, so any new scenery recipe has to name its own grey, brown or blue
`bands`.

`setSecurity` works before a repository is connected, which makes it useful for
trying looks on an empty map.

The board is 36 x 30 tiles. It was 52 x 36, which left roughly half the map as
empty grass, so it was cropped in around the content and the pond moved into the
free pocket at the bottom left. That also cut draw calls per frame at fit view
from about 2,027 to about 1,222.

## Zoom

Zoom is stepped to whole numbers, 1 to 4, so pixels stay square at rest, and the
camera eases into each step rather than snapping. It is anchored to the pointer:
whatever is under the cursor stays under the cursor.

One wheel gesture is one step. A trackpad flick fires around 40 wheel events, and
the old multiply-per-event code turned that into a jump from 1 to 4, which is what
made zooming feel wild. There is a 240 ms cooldown on wall-clock time, not on
frame count, because `requestAnimationFrame` stops on a hidden tab and external
displays often force 30 Hz.

## Agent events

```json
{ "type": "agent.start", "agent": "repair", "target": "auth" }
{ "type": "agent.log",   "level": "code", "text": "reading src/auth/session.ts" }
{ "type": "agent.edit",  "file": "src/auth/session.ts" }
{ "type": "agent.test",  "suite": "authentication", "pass": 6, "fail": 0 }
{ "type": "agent.done",  "target": "auth", "health": 96, "status": "healthy",
  "summary": "Repair Cat fixed session persistence",
  "detail": "Signed httpOnly cookie.", "files": ["src/auth/session.ts"] }
```

`agent` is `scout | repair | guard`. `level` is `code | bad | good | sys | ''`.

The cat walks for 2.6s on `agent.start`, then loops its work animation until `agent.done`
arrives. A slow agent just means a longer animation. It cannot desync.

## Wiring the cat runtime

`contracts/cat-events.ts` and the five event types above are different shapes.
The runtime sends eight phases with a nested payload; the renderer wants five
flat types. `city/cat-runtime-adapter.js` translates one into the other and
changes neither contract:

```js
import { mountCity } from './city/mistral-city.js'
import { attachCatRuntime } from './city/cat-runtime-adapter.js'

const city = mountCity(host)
const feed = attachCatRuntime(city)
socket.onmessage = m => feed(JSON.parse(m.data))
```

`attachCatRuntime(city, opts)` takes `onUnknown(ev)` for phases it does not know,
`onOutOfOrder(ev, lastSeq)` for a gap in `sequence`, and `healthFor(ev)` if you
want to override the health a `SUCCESS` lands on. By default it derives health
from `payload.verification.testsPassed` and `testsFailed`, falling back to 96.

`FAILED` sends the cat home and leaves the building damaged rather than quietly
turning it green.

Verified end to end against `contracts/repair-run.example.ndjson`.

## React

See `examples/City.jsx`. The important part is that `destroy()` runs in the cleanup, or React 18
StrictMode leaves two render loops running in dev and it looks like a perf bug.

## Local demo

```
python3 -m http.server 8080     # ES modules need http, not file://
open http://localhost:8080/mistral-city/demo.html
```

The demo carries a dev panel: pick a security level 1 to 5, toggle the five
checks individually, or cycle the levels to watch the town rebuild itself.
