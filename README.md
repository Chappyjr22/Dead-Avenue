# Dead Avenue

First-person zombie survival in an abandoned city, built with Three.js. No build step: the whole city (buildings, textures, cars, street clutter, sky) is generated in code when the page loads.

## Run it

Serve the folder with any static server and open it in a browser:

```
npm run serve
```

Controls: WASD to move, Shift to run, mouse to look, click to fire, R to reload. Press F to toggle the flashlight. On a phone, the left thumb moves (push fully to sprint), the right thumb looks, and dragging the FIRE button aims while firing. LIGHT toggles the flashlight; RELOAD reloads. The light switches automatically indoors until you make a manual choice.

## Layout

- `index.html` – page, HUD and styles
- `src/` – the game, split into modules (see `CLAUDE.md` for what each one holds)
- `src/data.js` – colours, names and other plain values that are safe to edit
- `assets/walker.glb` – humanoid model used for the zombies and the player's arms
- `tools/build-artifact.mjs` – packages the game for publishing as a Claude artifact (`npm run build:artifact`)
- `tools/shot.mjs` – headless screenshot harness for checking the look (needs `npm install` and Playwright)

## Asset note

`assets/walker.glb` is the `Xbot` sample model from the Three.js examples, which originates from Adobe Mixamo. It is a placeholder; check its licence terms or replace it before any public release.

## Checks

Run `npm test` for collision-route and simulated input regressions, and `npm run build:artifact` for packaging. Input tests use a mocked DOM; real phone touch feel, sound and frame rate still need device testing.

Zombie pursuit uses incremental A* with a shared per-frame expansion budget. When future base building changes collision geometry, call `clearNavigation()` and clear active zombie paths and pending requests before replanning.
