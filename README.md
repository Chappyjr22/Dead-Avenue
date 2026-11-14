# Dead Avenue

First-person zombie survival in an abandoned city, built with Three.js. No build step: the whole city (buildings, textures, cars, street clutter, sky) is generated in code when the page loads.

## Run it

Serve the folder with any static server and open it in a browser:

```
npm run serve
```

Controls: WASD to move, Shift to run, mouse to look, click to fire, R to reload. On a phone, the left thumb moves and the right thumb looks.

## Layout

- `index.html` – page, HUD and styles
- `src/` – the game, split into modules (see `CLAUDE.md` for what each one holds)
- `src/data.js` – colours, names and other plain values that are safe to edit
- `assets/walker.glb` – humanoid model used for the zombies and the player's arms
- `tools/build-artifact.mjs` – packages the game for publishing as a Claude artifact (`npm run build:artifact`)
- `tools/shot.mjs` – headless screenshot harness for checking the look (needs `npm install` and Playwright)

## Asset note

`assets/walker.glb` is the `Xbot` sample model from the Three.js examples, which originates from Adobe Mixamo. It is a placeholder; check its licence terms or replace it before any public release.
