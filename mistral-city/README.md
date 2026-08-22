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
| `setSecurity(passedIds)` | Town Hall level = number of checks passed, 1 to 5. Rebuilds its plot. |
| `select(id)` / `deselect()` | Drive the inspector from your own UI. |
| `camera({x,y,z})` | Move the camera. `z` is an integer zoom, 1 to 4. |
| `on('select', cb)` | Renderer tells the app what was clicked. |
| `state()` | `{ health, energy, systems }` |
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
- `tx` / `ty` are tile coordinates on a 52 x 36 grid. **Omit them and systems auto-place on a grid.**
- Everything except `id` is optional.

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
open http://localhost:8080/demo.html
```
