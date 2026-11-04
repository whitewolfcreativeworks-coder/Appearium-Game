# Appearium

*Every journey, a world of its own.*

A realistic first-person wilderness-exploration game that runs in the browser (desktop and
iPad). You live in a permanent village. Each time you walk out through the North Gate, a new
wilderness is generated around you as you explore — forests, rivers, lakes, fells, fens,
settlements and ruins that exist for that one journey only. When you return home the land is
gone, but whatever you carried back is kept: your stores grow, the village improves, and the
Hall of Discoveries fills with artifacts from places that no longer exist.

## Play

**Online:** once GitHub Pages is enabled (see *Deploying*), the game is at
`https://whitewolfcreativeworks-coder.github.io/Appearium-Game/`. On an iPad, open that URL in
Safari; *Share → Add to Home Screen* gives a full-screen app.

**Locally:** it is a static site with no build step.

```sh
git clone https://github.com/whitewolfcreativeworks-coder/Appearium-Game.git
cd Appearium-Game
python3 -m http.server 8000      # any static server works
# open http://localhost:8000
```

(Opening `index.html` directly from disk will not work — browsers block ES modules on `file://`.)

### Controls

| | Desktop | iPad / touch |
|---|---|---|
| Move | WASD / arrows | left thumb (virtual stick appears where you touch) |
| Look | mouse (click to capture, Esc to release) | drag with right thumb |
| Run | Shift | push the stick to its edge |
| Jump | Space | ⤒ |
| Interact | E or left click | ✋ (appears when something is in reach) |
| Pack / Journal | I / J | Pack / Log buttons |
| Return home | H or **⌂ Return Home** | **⌂ Return Home** (top right) |
| Lantern (once crafted) | L | ☀ |

### The loop

1. **Village** — the storehouse shows what you own (its piles of wood, stone and fish grow
   visibly), the workshop crafts equipment and village upgrades, the Hall of Discoveries
   displays artifacts, the noticeboard holds your journal, and you can sleep at home.
2. **Expedition** — walk through the North Gate. A region is rolled from one of five archetypes
   (Riverlands, Highlands, Mistwood fens, Meadowlands, Old Heath), with its own terrain,
   ecology, weather, time of day, season, fish, and points of interest. A rumour tells you
   roughly where something interesting lies; the compass shows your camp and what you know of.
3. **Gather & discover** — fallen wood, stones, mushrooms, berries, herbs, minerals, clay;
   fishing (cast, strike on the bite, manage line tension); snares for hares; observing foxes;
   trading at remote hamlets; artifacts in ruins, stone circles, crystal grottoes, abandoned
   cabins, or just glinting in the grass. Your pack has limited space.
4. **Return home** at any time. The wilderness is discarded; your pack goes into the
   storehouse, artifacts go on pedestals with a record of where and when they were found, and
   the journal logs the journey. The next expedition is a brand-new world.

Progress is saved automatically in the browser (localStorage), including the contents of your
pack during an expedition — if the page is closed mid-journey, you wake at home with your pack.

### Settings

Graphics quality (Low / Medium / High) is on the title screen and in the ≡ menu. Touch devices
default to Medium, desktops to High; resolution also scales automatically to hold frame rate.
URL options: `?quality=low|medium|high`, `?scenario=riverlands|highlands|mistwood|hamlet|heath`
(force a biome), `?debug` (performance overlay), `?fixedres` (disable dynamic resolution).

## What's implemented

- **Procedural wilderness, streamed as you walk**: 64 m terrain chunks generated on demand in
  three LOD rings (with skirts), deterministic so revisited ground is identical. Height field
  from warped fBm hills, ridged mountains, river valleys with gentle banks, lake basins and
  wetland ponds; per-point moisture and forest density drive everything else.
- **Ecological scatter**: species placed by habitat — conifers on dry/high ground, broadleaf
  in damp valleys, snags, ferns and fungi in wet woods, berries on forest edges, nettles near
  water, minerals on rocky slopes, clay on fen riverbanks.
- **Rendering**: 5-layer PBR terrain splat (slope/height/moisture, tri-planar cliffs, height-
  blended, anti-tiling), Preetham sky, procedural cloud dome, stars, sun/moon with
  player-following shadows, sky-driven image-based lighting, exponential fog, rain, wind-
  animated foliage and ~10 k instanced grass clumps, depth-aware water with fresnel reflection,
  sun glint and shoreline foam. Draw calls stay around 100–200 via instanced pools.
- **Trees** are built procedurally from scanned Poly Haven bark and foliage (fir branch and
  leaf-cluster cards composited from real twig scans), because the photoscanned tree models
  are millions of triangles — far beyond an iPad.
- **Village**: palisade & gate, home, storehouse with visible stores, workshop, Hall of
  Discoveries (8 pedestals, 18 when extended), noticeboard, well, hearth, lanterns that light at
  night; upgrades (watchtower, herb garden, Hall extension).
- **Activities**: gathering (12 resource types), fishing (6 species, river vs. still water,
  personal bests), snares, wildlife observation (animated foxes that wander, rest and flee),
  bird flocks and fish schools, trade with honesty stalls (each hamlet has a specialty and one
  unique artifact), artifacts (procedurally named, with stories and origin records), crafting
  (snares, sturdy rod, larger pack, lantern) and village building.
- **Day/night & weather**: clear, hazy, mist, overcast, rain; dawn to night with appropriate
  ambience. Synthesised soundscape: wind, leaves, water proximity, rain, birdsong by day,
  crickets and owls at night, surface-aware footsteps.
- **UI**: restrained HUD, compass with markers, toasts, panels for pack, storehouse, workshop,
  Hall, journal (expeditions / nature / places), trade and settings.

## Technical decisions

- **Three.js only (no Godot).** Godot 4's web export needs SharedArrayBuffer (cross-origin
  isolation headers GitHub Pages cannot set) or a single-threaded build with large downloads
  and weak iOS Safari support; Terrain3D is a native GDExtension that does not run on the web
  at all. Combining Godot with Three.js would mean two renderers. Three.js runs natively in iPad
  Safari (WebGL 2), loads in ~1 s, and deploys as plain files — so it was the practical route to
  a finished, playable game.
- **No build step / no runtime CDN.** three.js r170 is vendored under `vendor/three/` and
  loaded with an import map, so the game works offline and on any static host.
- **Assets** are fetched and optimised by `tools/fetch_assets.py` (resize, glTF meshopt
  compression, simplification, foliage compositing). The processed results (~9 MB) are
  committed so the game runs without the pipeline. To rebuild them:
  `cd tools && npm install && cd .. && python3 tools/fetch_assets.py` (needs Python 3 with
  Pillow, NumPy, SciPy, and Node 18+).

### Code map

```
index.html            page shell, HUD markup, import map
src/main.js           game orchestration: loading, village ⇄ expedition loop, interactions, panels
src/core/             seeded RNG, simplex noise, asset loading
src/world/generator.js     height / moisture / forest field of a world
src/world/chunks.js        chunk streaming, terrain LOD meshes, water patches, collisions
src/world/terrainMaterial.js   splat-mapped PBR terrain shader
src/world/pools.js         instanced pools shared by all chunks
src/world/vegetation.js    procedural trees, grass, mushrooms, crystals; model kinds; wind
src/world/scatter.js       habitat-based placement + grass field around the player
src/world/sky.js, water.js, effects.js   atmosphere, water shader, fire/smoke/fireflies
src/world/structures.js    architecture kit (cabins, hall, palisade, ruins, stalls…)
src/world/village.js, wilderness.js, scenarios.js, wildlife.js
src/game/              items & artifacts, save, player & input, fishing, artifact 3D models
src/audio/audio.js     synthesised soundscape
src/ui/ui.js           HUD helpers
tools/                 offline asset pipeline
```

## Testing status

Verified in headless Chrome (software WebGL) with automated scripts: loading, the village, all
five biomes, the full Village → Expedition → Gather → Return Home → New Expedition cycle with
persistence, fishing from cast to landing, snares, trading, all crafting recipes and upgrades,
artifact display, and touch controls (joystick, drag-look, tap-to-interact) under iPad
emulation with zero console errors.

**Not yet verified on physical hardware:** real iPad Safari frame rate and memory, iOS audio
unlock behaviour, and real GPU visuals (tests used a software renderer). If an iPad struggles,
choose *Low* in the ≡ menu; dynamic resolution also kicks in below ~27 fps.

## Known limitations / next steps

- There is no swimming — deep water blocks you. Rivers share one water level (no waterfalls).
- People are implied (honesty stalls, chimney smoke) rather than simulated; there are no NPCs.
- Hunting is non-lethal observation plus snares; deer and other large animals would need a
  suitably licensed animated model.
- Distant terrain beyond ~200–250 m is hidden by fog; a far-terrain impostor ring would open up
  mountain vistas.
- Grotto "caves" are rock shelters, not true underground spaces (height-field terrain).

Credits and licences for all third-party components are in [CREDITS.md](CREDITS.md).
