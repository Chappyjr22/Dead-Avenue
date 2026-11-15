# Dead Avenue: guide for agents

First-person zombie survival in a procedurally generated abandoned city. Three.js loaded from a CDN through an import map, plain ES modules, no bundler and no build step for development. Play with keyboard and mouse, touch, or a standard-mapping gamepad (`docs/controller.md`).

## Run and check

```
npm install                      # once; three is needed by the tools and tests
npm run serve                    # play it in a browser
npm test                         # node --test over tests/*.test.mjs (8 test files)
node tools/shot.mjs '<json>' 960 540
```

`tools/shot.mjs` is how you see your work. `playwright` is not in `package.json`; the script needs it installed (with Chromium) to run. It serves the repo itself, starts the game in headless Chromium and writes `shots/<name>.jpg`. Arguments: the JSON array of steps, then viewport width and height (defaults 1280 and 720). The server port is the `PORT` environment variable, default 8765. Each array entry is one step and may have:

- `name` – output file name (`shots/<name>.jpg`)
- `begin: true` – hide the title veil and call `g.begin()` (first entry only)
- `p` – fields copied onto the player, e.g. `{"x":41,"z":44,"yaw":0,"pitch":0.05}`
- `js` – code to `eval` first; `g` is `window.__game`
- `frames` – frames to render before the capture (default 3)
- `page: true` – also save a full-page screenshot to `shots/<name>.png`, so the HUD shows (the `.jpg` is only the WebGL canvas)

`window.__game` exposes: `player`, `zombies`, `game`, `camera`, `renderer`, `rooms`, `pickups`, `fp`, and the functions `frame`, `begin`, `fire`, `selectWeapon`, `updatePlayer`, `updateZombie`, `updateNavigation`, `collide`, `roomAt`, `rayWorld`. The harness sets `window.__manual`, so the game does not run its own animation loop; frames advance only through `g.frame()`.

Harness cautions:

- Rendering is software-only and each frame takes seconds. Keep a whole run to about 30 rendered frames; the headless browser has crashed on longer runs.
- Prefer `js` steps that print results with `console.warn(...)` over rendering more frames. Page errors and warnings are echoed to the terminal.
- Two agents testing at once each need their own `PORT`.
- A `[error] Failed to load resource: net::ERR_FAILED` line is the harness blocking the web-font request. It is expected.
- Always look at the image you produce; "no errors" does not mean it looks right.

Useful spots: the start is `x 41, z 44` looking north (`yaw 0`, which faces -z). To stand inside a shop, pick one from `g.rooms` and place the player at `fx - nx * 2`, `z` midway between `dz0` and `dz1`, with `yaw` `Math.PI/2` when `nx > 0` and `-Math.PI/2` otherwise.

### How the unit tests load code

`tests/player.test.mjs` reads `src/player.js`, strips its `import` lines and `export` statements, and runs it with `vm.runInNewContext`, with every imported name supplied by hand in a context object. `tests/ragdoll.test.mjs` does the same to `src/zombies.js` (with stub world modules), and `tests/inventory-ui.test.mjs` does it to `src/inventory-ui.js`. If you add an import to one of those source files, add the name to that test's context or the test fails with a ReferenceError. The other tests import modules normally.

## Layout

| File | Holds |
|---|---|
| `index.html` | Page, HUD markup and styles; `<!-- page:start/end -->` markers delimit what the artifact build keeps |
| `src/data.js` | Colours, names, outfits, `WEAPONS`, `SHOP_TYPES`, `MEDKIT`, `MOVEMENT`, `LOOT`, `PLAYER_CONTROL`. Plain values, no engine code |
| `src/util.js` | Seeded random helpers (`rnd`, `rr`, `ri`, `pick`), `clamp`, `col`, `$` |
| `src/render.js` | Renderer, camera, sky, sun, post-processing |
| `src/textures.js` | Canvas-drawn textures and the shared materials |
| `src/batch.js` | Instancing batches `B.*` and the box helpers `obox`, `fb`, `fq` |
| `src/world.js` | Grid constants, `rooms`, `circles` and the circle grid (`nearCircles`), `groundY`, `collide`, `rayWorld` |
| `src/buildings.js` | Facades and building shells; deals shop types from a shuffled deck |
| `src/interiors.js` | Shop interiors and their loot spots |
| `src/city.js` | Lays out the blocks and the skyline |
| `src/streets.js` | Markings, cars, street furniture, clutter; then builds every batch |
| `src/zombies.js` | Zombie behaviour, spawning, damage and death |
| `src/zombie-visual.js` | Zombie model preparation, skeleton clones and animation clips (visuals only) |
| `src/ragdoll.js` | Position-based Verlet ragdoll used when a zombie dies |
| `src/navigation.js` | Shared incremental A* routes with a per-frame expansion budget |
| `src/player.js` | Input, weapons, torch, crouch/jump, loot targeting and pickup, HUD updates |
| `src/controller.js` | Gamepad sampling and mapping (no browser or Three dependency) |
| `src/inventory.js` | Item definitions, supplies, equipment, loot rolls (`chooseLoot`), hunger and thirst |
| `src/inventory-ui.js` | Inventory panel and its controller navigation |
| `src/inventory-art.js` | Maps item kinds to the icon files in `assets/icons` |
| `src/loot-model.js` | Small 3D shapes for loot lying in the world |
| `src/arms.js` | First-person arms posed onto each weapon (`POSES`, `buildArms`) |
| `src/weapon-model.js` | Fits the loaded pistol and rifle models for the hand |
| `src/audio.js` | Synthesised sound, plus the recorded player voice cues |
| `src/player-audio.js` | Player voice cue table and the decoded clip cache |
| `src/state.js` | Shared state: `player`, `zombies`, `game` flags, `clock`, `createPlayer` |
| `src/main.js` | Frame loop, model loading, `window.__game` |

Other folders:

- `tests/` – 8 `*.test.mjs` files run by `node --test`: controller, inventory, inventory UI, models (Makarov, AK-47, arm rigs, zombie clips), navigation routes, player (input, shooting, pickups), player audio, ragdoll.
- `tools/` – `shot.mjs` (screenshots), `build-artifact.mjs` (packaging), `inspect-models.mjs` (offline model geometry, also used by tests), `arms-shot.mjs` with `arms-test.html` and `sheet.py` (arm pose renders, port 8766).
- `docs/` – `controller.md`, the gamepad control table.
- `assets/` – models, `icons/` (inventory art), `audio/player/` (voice clips), `weapons/` (extra gun models).

## Rules that are easy to break

- **Static geometry goes into batches.** Add boxes with `fb(B.int, F, a0, a1, y0, y1, d0, d1, colour)` (facade-local: `a` along the wall, `y` up, `d` outward, negative is indoors) or `obox(...)` for world space. Do not create a mesh per object; there are tens of thousands of boxes and only a handful of draw calls. All adds must happen before `streets.js` builds the batches.
- **The city is seeded.** `rnd()` drives the whole layout, and modules run in a fixed order (textures, then city, then streets, then pickups). Adding or removing `rnd()` calls changes everything generated after that point. That is allowed, but expect the layout to shift and re-check your screenshots.
- **Indoor colours are deliberately dim.** Interior surfaces use `B.int` and colours passed through `DIM()`, so rooms stay dark until the torch hits them.
- **Collision is simple.** Each block is one solid rectangle; shop rooms and their doorways (`rooms`) are the walkable exceptions; furniture and cars are `circles`. New solid props need a circle (`addCircle`) or nothing will stop the player.
- **Look circles up through `nearCircles(x, z)`,** which reads a grid built lazily from `circles`, not by looping over `circles`. If solids change after the grid exists, call `clearNavigation()` (it also clears the circle grid) and clear active zombie paths and pending route requests.
- **Pathfinding has a per-frame budget.** `navigation.js` shares one A* expansion budget across all zombies, round-robin, whatever the zombie count. Request routes with `requestRoute`; do not run unbounded searches in a frame.
- **Weapons are data.** Each entry in `WEAPONS` (`src/data.js`) holds damage, fire rate, ammo, mount, aim and reload poses, model file and sound. Add a gun there rather than special-casing it in `player.js`. Each weapon has its own ammo in `player.guns`.
- **Each weapon has its own arm rig and pose.** `main.js` calls `installWeapon(id, model, buildArms(..., POSES[id]))` per weapon; a new gun needs a `POSES` entry in `arms.js` and a model builder in `weapon-model.js`.
- **Shop types come from `SHOP_TYPES`.** `buildings.js` deals them from a shuffled deck (every type appears before any repeats); each type sets the sign names, goods colours, wall colours and a `medkit` chance used when rolling loot (`chooseLoot` in `inventory.js`). Changing the deck changes `rnd()` use.
- **Loot is picked up deliberately.** Walking over it does nothing. `player.js` targets loot you look at (within `LOOT.identifyRange`, aim dot `LOOT.minAimDot`, not blocked by a wall) and `interact()` collects it only within `LOOT.reach`, via the interact button, key or gamepad button.
- **Zombie deaths are ragdolls.** A kill hands the skeleton to `ZombieRagdoll` (`ragdoll.js`) instead of playing the death clip; respawn must reset the skeleton. Ragdolls collide through `collide`, `groundY` and the circles.
- **Units are metres.** Ground floor height is `G` (4.6), upper floors `FH` (3.3), pavement is 0.18 above the road.
- **Values that are content, not code, belong in `src/data.js`.**

## Models and assets

| File | Used for |
|---|---|
| `assets/walker.glb` | Source of the first-person arms for every weapon (Mixamo `Xbot` from the Three.js examples, a placeholder; check its licence before any public release; noted in `README.md`) |
| `assets/city-zombie.glb` | The zombies, with walk, attack, hit and death clips |
| `assets/makarov.glb` | The pistol (`WEAPONS.makarov.model`) |
| `assets/weapons/ak47.glb` | The rifle (`WEAPONS.ak47.model`) |
| `assets/weapons/*.glb` (the other seven) | Imported, not used by the game yet |

Licences and provenance: `assets/SOURCES.md` (zombie, Makarov, extra guns), `assets/weapons/README.md`, `LICENSE.txt` and `manifest.json`, `assets/audio/player/SOURCES.md` (generated voice clips), `assets/icons/README.md` (generated inventory icons). Record the source and licence of any new asset there.

## Publishing

`npm run build:artifact` writes `dist/` (page fragment, `src/`, icons, audio, and models embedded as base64 `<name>-data.js` modules) for publishing as a Claude artifact. The artifact host does not serve `.glb` files, which is why the embedded copies exist; do not work around that by renaming files. `tools/build-artifact.mjs` embeds only the models in its hard-coded list (`walker`, `makarov`, `weapons/ak47`, `city-zombie`), so a new model must be added to that list too. `main.js` tries the `.glb` first and falls back to the embedded module.

## Before you finish

1. Run `npm test` and fix failures.
2. Run the game through `tools/shot.mjs` with no page errors.
3. Look at screenshots of whatever you changed, from at least two positions.
4. If you touched movement, shooting or pickups, check them with a `js` step and report the numbers.
5. Say plainly what you could not test (real frame rate, touch feel, controller feel and sound are never testable here).
