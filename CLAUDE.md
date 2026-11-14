# Dead Avenue: guide for agents

First-person zombie survival in a procedurally generated abandoned city. Three.js loaded from a CDN through an import map, plain ES modules, no bundler and no build step for development.

## Run and check

```
npm install                      # once; three is only needed by the screenshot tools
npm run serve                    # play it in a browser
node tools/shot.mjs '<json>' 960 540
```

`tools/shot.mjs` is how you see your work. It starts the game in headless Chromium, runs one step per array entry and writes `shots/<name>.jpg`. Each entry may have:

- `name` – output file name
- `begin: true` – dismiss the title screen and start play (first entry only)
- `p` – fields to copy onto the player, e.g. `{"x":41,"z":44,"yaw":0,"pitch":0.05}`
- `js` – code to run first; `g` is `window.__game` (player, zombies, rooms, pickups, collide, roomAt, rayWorld, frame)
- `frames` – frames to render before the capture (default 3)

Rendering is software-only, so each frame takes several seconds: keep `frames` small, and print logic results with `console.warn(...)` from `js` instead of rendering more. Always look at the image you produce; "no errors" does not mean it looks right. Page errors and warnings are echoed to the terminal.

Useful spots: the start is `x 41, z 44` looking north (`yaw 0`, which faces -z). To stand inside a shop, pick one from `g.rooms` and place the player at `fx - nx * 2`, `z` midway between `dz0` and `dz1`, with `yaw` `Math.PI/2` when `nx > 0` and `-Math.PI/2` otherwise.

## Layout

| File | Holds |
|---|---|
| `index.html` | Page, HUD markup and styles |
| `src/data.js` | Colours, names, outfits, ammo numbers. Plain values, no engine code |
| `src/util.js` | Seeded random helpers (`rnd`, `rr`, `ri`, `pick`), `clamp`, `col` |
| `src/render.js` | Renderer, camera, sky, sun, post-processing |
| `src/textures.js` | Canvas-drawn textures and the shared materials |
| `src/batch.js` | Instancing batches `B.*` and the box helpers `obox`, `fb`, `fq` |
| `src/world.js` | Grid constants, `rooms`, `circles`, `groundY`, `collide`, `rayWorld` |
| `src/buildings.js` | Facades and building shells |
| `src/interiors.js` | Shop interiors |
| `src/city.js` | Lays out the blocks and the skyline |
| `src/streets.js` | Markings, cars, street furniture, clutter; then builds every batch |
| `src/zombies.js` | Zombie look, behaviour, spawning |
| `src/player.js` | Input, pistol, torch, pickups, HUD updates |
| `src/arms.js` | First-person arms posed onto the pistol |
| `src/audio.js` | Synthesised sound |
| `src/state.js` | Shared state: `player`, `zombies`, `game` flags, `clock` |
| `src/main.js` | Frame loop and model loading |

## Rules that are easy to break

- **Static geometry goes into batches.** Add boxes with `fb(B.int, F, a0, a1, y0, y1, d0, d1, colour)` (facade-local: `a` along the wall, `y` up, `d` outward, negative is indoors) or `obox(...)` for world space. Do not create a mesh per object; there are tens of thousands of boxes and only a handful of draw calls. All adds must happen before `streets.js` builds the batches.
- **The city is seeded.** `rnd()` drives the whole layout, and modules run in a fixed order (textures, then city, then streets, then pickups). Adding or removing `rnd()` calls changes everything generated after that point. That is allowed, but expect the layout to shift and re-check your screenshots.
- **Indoor colours are deliberately dim.** Interior surfaces use `B.int` and colours passed through `DIM()`, so rooms stay dark until the torch hits them.
- **Collision is simple.** Each block is one solid rectangle; shop rooms and their doorways (`rooms`) are the walkable exceptions; furniture and cars are `circles`. New solid props need a circle or nothing will stop the player.
- **Units are metres.** Ground floor height is `G` (4.6), upper floors `FH` (3.3), pavement is 0.18 above the road.
- **Values that are content, not code, belong in `src/data.js`.**
- **The model is a placeholder.** `assets/walker.glb` is used for both zombies and the player's arms.

## Publishing

`npm run build:artifact` writes `dist/` (page fragment, `src/`, and the model embedded as base64) for publishing as a Claude artifact. The artifact host does not serve `.glb` files, which is why the embedded copy exists; do not work around that by renaming files.

## Before you finish

1. Run the game through `tools/shot.mjs` with no page errors.
2. Look at screenshots of whatever you changed, from at least two positions.
3. If you touched movement, shooting or pickups, check them with a `js` step and report the numbers.
4. Say plainly what you could not test (real frame rate, touch feel and sound are never testable here).
