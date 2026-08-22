# mistral-city

A pixel town that renders a codebase. Zero dependencies, no build step, no image assets.
Every sprite is generated in code and baked once at boot.

## Install

Copy `city/mistral-city.js` into the app. That's it.

## Use

```js
import { mountCity } from './city/mistral-city.js'

const city = mountCity(document.getElementById('city'), {
  onSelect: id => console.log('clicked', id),
  onConnect: url => {
    startRepositoryAnalysis(url)
    return true
  },
  onDispatch: dispatch => {
    // Return true when the host owns the agent runtime. Returning false keeps
    // the renderer's scripted demo path for that agent.
    if (dispatch.agent !== 'repair') return false
    startRepair(dispatch)
    return true
  }
})

city.setModel(cityJson)                                  // Paul's scanner output
city.onEvent({ type:'agent.start', agent:'repair', target:'auth' })
city.replay(eventLog)                                    // stage fallback
city.setSecurityScore(72)                                // redresses the whole board
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
| `setSecurityScore(0..100)` | **The main input.** Redresses the whole board. Continuous, so the town can sit between two eras. Junk or missing values are ignored rather than demoting the town. |
| `setSecurity(passedIds)` | Checklist form, kept for existing callers. Five booleans can only produce five states, so this quantises. |
| `select(id)` / `deselect()` | Drive the inspector from your own UI. |
| `camera({x,y,z,snap})` | Move the camera. `z` is a whole number 1 to 4; anything else is rounded and clamped. Eases unless `snap:true`. |
| `on('select', cb)` | Renderer tells the app what was clicked. |
| `checks()` / `levels()` | The five checks and the five eras, so a host UI can build its own controls. |
| `securityScore()` / `securityLevel()` | Current score 0 to 100, and the era 1 to 5. |
| `state()` | `{ health, energy, systems, zoom, score, level }` |
| `destroy()` | Full teardown. Call it in a React cleanup. |

The optional `onDispatch` hook receives `{ agent, systemId, issue, files,
connections }` when a user chooses a cat action. Return `true` to let the host
drive the animation with `onEvent`; return `false` to use the renderer's local
scripted fallback.

The optional `onConnect` hook receives the GitHub URL entered in the connection
screen. Return `true` when the host owns repository loading; call `setModel()`
as discovery events arrive to progressively build the town.

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
- `tx` / `ty` are tile coordinates on a 34 x 29 grid. **Omit them and systems auto-place on a grid.**
- Everything except `id` is optional.

## Security drives the whole board

The security score is the one number that decides what the town looks like. It
is continuous, and every part of the map reacts to it.

| | 0, least secure | 100, most secure |
|---|---|---|
| Ground | overgrown grass, moss, bramble | concrete slabs, planted squares only |
| Roads | dirt with weeds through it | paved, darker than the plaza, orange markings |
| Props | dead trees, brambles, boulders | steel lamps, bollards, topiary, containers |
| Houses | a few roofless stone ruins | many glass and slate tower blocks |
| Light | green gloom | warm waterfront daylight |
| Town Hall | mossy ruin | Mistral tower |

### Why it is not five steps

Every tile and every site is given a fixed number in `[0,1)` at boot. It flips
to the next era once the score's fractional part passes its own number:

```
era = floor(score) + (frac(score) > myThreshold ? 1 : 0)
```

So a score of 3.7 is not "level 4". It is a board where roughly 70% of the
ground has crossed into the fourth era and 30% has not, which reads as a town
partway through being rebuilt. Whole numbers are uniform; everything between is
a real mix of two eras.

That number is mostly **distance from the Town Hall**, with clustered noise for
a ragged edge, so improvements radiate outward from the centre rather than
dissolving at random. Raising the score plays as a wave moving out across the
map.

Three properties this buys:

- **Stable.** Thresholds are assigned once and never re-rolled, so a rescan
  never reshuffles the town.
- **Reversible.** A score that drops downgrades exactly the blocks that most
  recently upgraded.
- **Free.** Two cached atlases are live during a blend and one comparison per
  tile picks between them. About 1,100 draw calls per frame at fit view, the
  same as a whole-number score.

Houses use the same field for a second purpose: each site also has a score at
which it starts existing at all, so buildings *appear* as the repository gets
safer. Roughly a third are there from the start and the rest arrive as the
score climbs.

### What the renderer still needs

`CityModel` v1 has no security data, so `toRendererModel` currently sends
nothing and the town stays where it is. The renderer already reads
`city.security.score` when it is present. The ask is one number:

```ts
city: {
  health, status,
  security: {
    score: number,      // 0-100. this is the whole requirement
    findings?: [{ id, name, severity, file, passed }]   // for the inspector
  }
}
```

The raw material exists in `packages/intelligence/src/security/attack-catalog.ts`,
which already finds real issues and tags each with a severity. It is the
aggregate that is missing.

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

## React

See `examples/City.jsx`. The important part is that `destroy()` runs in the cleanup, or React 18
StrictMode leaves two render loops running in dev and it looks like a perf bug.

## Local demo

```
python3 -m http.server 8080     # ES modules need http, not file://
open http://localhost:8080/mistral-city/demo.html
```

The demo carries a dev panel: a 0 to 100 security slider, buttons to jump to
each whole era for comparison, and a sweep that walks the whole range so you can
watch the town rebuild itself. This is the fastest way to tune the look without
booting the server and cloning a repository.
