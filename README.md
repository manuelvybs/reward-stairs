# Reward Stairs

A VYBS minigame in Three.js. The VYBS astronaut climbs moonstone stairs through a sea of painted clouds, touches
floating gift cards (they fly off and become stars) and hops across hover-cards over two gaps. Dusk turns to night
as you climb. At the summit every card you collected swoops back down as a step, and the astronaut climbs them to a
crescent moon, sits in it and cheers. The end screen has the **Get VYBS** button.

**Play:** https://manuelvybs.github.io/reward-stairs/

The mechanic follows fal's *Paper Moon Stairs* showcase (walk a winding stairway, touch pickups, cross gaps on floating
platforms, an ending staircase to the moon). Everything else is ours: code, level layout, art, music, the mascot and the gift-card economy.

## Deploy

GitHub Pages serves `main` from the repo root. Commit and `git push`; Pages rebuilds in about a minute. Check the live
build with `node tools/playtest.mjs art-src/live --base https://manuelvybs.github.io/reward-stairs/index.html`.
`og.jpg` is the 1200×630 share image.

## Run it

No build step. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
npx -y http-server . -p 4175 -c-1
```

Then open http://localhost:4175. URL flags: `?autopilot` plays itself, `?play` skips the title, `?s=40` starts at
metre 40, `?mute`, `?lowq` (no bloom), `?hiq` (never downgrade).

Controls: ← → / A D walk, Space / ↑ / W jump, M sound. On touch screens, on-screen ◀ ▶ pads and a gold jump pad.

## Files

| | |
|---|---|
| `src/level.js` | the path, stairs, gaps, card and hover-card placements, moon position (pure data) |
| `src/logic.js` | player physics, hover-card states, pickups, autopilot (no three.js, so tests run in Node) |
| `src/world.js` | sky dome, cloud billboards, stairs, rocks, crystals, sparkles, the moon |
| `src/cards.js` | gift-card meshes, pickups, platforms, cards flying off to become stars |
| `src/ending.js` | the card staircase to the moon and the final shot |
| `src/hero.js` | the rigged astronaut (`assets/models/hero.glb`, shared with Reward River) |
| `src/main.js` | boot, states, camera, HUD, frame loop |
| `tools/gen-art.mjs` | how the skies, clouds and music were generated on fal (every call logged to `tools/fal-log.jsonl`) |

## Tests

```bash
npm test                                  # Node: the autopilot climbs the whole level, 33/33 cards, no falls
node tools/playtest.mjs art-src/live      # headless GPU Chromium, landscape: screenshots of every beat, fails on console errors
node tools/playtest.mjs art-src/live --portrait
node tools/inputtest.mjs                  # real keyboard on desktop + real touches on the pads (phone emulation)
```

## Before posting

- `GAME.store` in `src/config.js` points at the store pages; swap in the Singular link.
