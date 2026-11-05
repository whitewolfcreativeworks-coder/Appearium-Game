# Appearium

*Every journey, a world of its own.*

A realistic first-person wilderness-exploration game that runs in the browser (desktop and
iPad). You live in a permanent village. Each time you walk out through the North Gate, you set off
down the same little road through the woods around your village — and where it leads is generated
for that journey only: a coast with dunes, surf and sea stacks, a vast layered canyon, a tropical
lagoon, a lake country of wooded islands, fells, fens, meadows or heath. When you return home the land is
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
| Pack / Journal | I / J | Pack / Log buttons (eat, bait, dig for worms, make & set traps) |
| Return home | H or **⌂ Return Home** | **⌂ Return Home** (top right) |
| Lantern (once crafted) | L | ☀ |

### The loop

1. **Village** — the storehouse shows what you own (its piles of wood, stone and fish grow
   visibly), the workshop crafts equipment, teaches trapping and builds village upgrades, the
   Hall of Discoveries displays artifacts, **Maren the herbalist** checks the mushrooms and plants
   you bring home, the hearth at home cooks from your stores, and the noticeboard holds your
   journal and field guide.
2. **Expedition** — walk out through the North Gate onto the road. The first stretch is always the
   forest around your village (the palisade is still behind you, and a fingerpost points home);
   after a few hundred metres the land turns into this journey's destination, rolled from nine
   kinds: **The Coast** (beach, dunes, headlands, sea stacks, rock pools, a shipwreck), **Canyon
   Country** (a terraced, banded sandstone canyon with a river far below, juniper and pinyon,
   cliff dwellings and rock carvings), **The Tropics** (palms, tree ferns, wild bananas, lagoons,
   vine-covered ruins), **Lake Country** (a great lake with wooded islands), Riverlands,
   Highlands, Mistwood fens, Meadowlands and Old Heath. Each has its own terrain, plants, fungi,
   fish, animals, sounds and weather. The weather can change while you are out: a sunny beach
   can turn windy, then stormy, with lightning, thunder, rain and big surf.
3. **Forage, fish, trap, discover** — see below. Your pack has limited space.
4. **Return home** at any time — with the ⌂ button, or by walking back down the road and in
   through the gate. The wilderness is discarded; your pack goes into the
   storehouse, artifacts go on pedestals with a record of where and when they were found, and
   the journal logs the journey. The next expedition is a brand-new world.

### Foraging and identification

Every mushroom, berry and green in the game is a real species placed in its real habitat —
and edible species often grow near their dangerous lookalikes:

| Edible | …easily confused with |
|---|---|
| Chanterelle | False chanterelle (poisonous), Jack-o'-lantern (poisonous, glows at night) |
| Porcini | Bitter bolete (ruins the whole pan) |
| Giant puffball | Common earthball (poisonous), young death cap "egg" |
| Parasol | Death cap (deadly) |
| Honey fungus | Sulphur tuft (poisonous) |
| Bilberry | Deadly nightshade (deadly) |
| Lingonberry | Bittersweet nightshade (poisonous) |
| Wild garlic | Lily of the valley (poisonous) |

Also: hedgehog mushroom, shaggy ink cap, chicken of the woods, fly agaric, liberty cap,
cloudberry, wild raspberry, nettle, wood sorrel, dandelion, lesser celandine.

Other lands have their own species and their own traps for the unwary:

| Land | Edible | …easily confused with |
|---|---|---|
| Coast | Field mushroom | Yellow stainer (stains chrome-yellow at the base) |
| Coast | Wild celery | Hemlock water-dropwort (deadly) |
| Coast | Sea beet, marsh samphire, sea buckthorn, blue mussels (cook them) | |
| Canyon | Wild onion (smells of onion) | Death camas (deadly, no onion smell) |
| Canyon | Prickly pear (peel it!), pinyon nuts, juniper (a spice) | Sacred datura (toxic, delirium) |
| Tropics | Termite mushroom | Green-spored parasol (green spore print) |
| Tropics | Guava, coconut, wild banana | Manchineel "beach apple" (deadly), physic nut (toxic) |

The handbook shown while examining lists the species of the land you are in.

When you find something you don't yet recognise, **Examine** it: a 3D close-up you can turn
and tilt. *Look underneath* (gills, ridges, pores or spines), *look at the stem* (rings, nets),
*dig around the base* (the death cap's volva is buried), *slice it open* (puffballs), *smell it*,
*take a spore print*. Compare what you see with the handbook and pick it as what you think it
is — or pick it unidentified. Back home, Maren tells you what you actually had and why. After
two confirmed identifications you recognise a species at a glance.

**Eating.** Eat raw from your pack, or cook at a campfire or your hearth (fish, game and
mushrooms should be cooked). Good meals make you *well fed* (more stamina). A poisonous find
makes you sick — staggering, nausea, double vision, no running — for a while. Psychoactive
species alter your senses. Deadly species behave like the real thing: you feel fine at first,
then collapse; you wake at home days later, your food spoiled. Hunger is gentle: you never
starve, you just recover stamina more slowly.

> Appearium simplifies real natural history. It is not a field guide — never eat a wild
> mushroom or plant unless an experienced local expert has confirmed it in person.

### Fishing

Streams, rivers, lakes, weedy ponds — and on the coast, the sea: fish the surf line for bass and
flounder (rough days are best), deep water off the rocks for pollock and mackerel, open water for
cod. Canyon rivers hold rainbow trout and channel catfish (and the endangered Colorado
pikeminnow — release it); tropical rivers and lagoons hold peacock bass, tilapia and huge
redtail catfish. At home: Read the water: riffles and deep river pools, reed beds,
lily pads, deep open water, shallows — and watch for fish rising. Choose bait (earthworms you
dig from damp soil, grubs from rotting logs, minnows, hand-tied flies, copper spinners). Which
of the 14 species bites depends on the water, the spot, the time of day, the weather and your
bait: trout and grayling in riffles at dawn, tench under lily pads, pike in the reeds, zander at
dusk, eels and burbot at night, salmon in rain-raised pools. Each fights differently (pike
head-shake, carp make long runs, trout and salmon leap). Keep, release, or keep small fish as
bait. European eels are critically endangered — release them.

### Trapping and tracking

Animals use the same runs every night. Look for narrow worn trails through the grass and the
prints pressed into them (hare, fox, roe deer, squirrel — *Examine the tracks* to learn them).
Learn the **snare**, the **figure-4 deadfall** and the **fish basket trap** step by step at the
workshop (with a quick check at the end), make them from wood, fibre and stone, and set them
from your pack. Placement matters: a snare across a hare run catches; one in open grass almost
never does. Fish baskets want shallow flowing water.

### Herds, flocks and a living forest

Each land has bigger animal life too: herds of wild horses grazing in open country (watch them
from a distance — they wheel away at a gallop if you come close), gulls wheeling over the shore,
skeins of geese passing high overhead, ravens tumbling over the canyon rim, parrots crossing the
forest, storks and flamingos wading in the shallows, and at dusk, starling murmurations. The sea
has its own sound — surf that breathes with the swell — as do the canyon (canyon wren, coyotes at
night) and the tropics (cicadas, tree frogs, parrots).

Songbirds (robin, blackbird, chaffinch, great tit) hop and peck and flush when you come close;
mallards dabble on still water; hares graze in the open and bolt in zig-zags; red squirrels
forage in the woods; butterflies (peacock, brimstone, red admiral, small tortoiseshell, common
blue), bees and dragonflies; falling leaves (thicker in autumn), drifting pollen, midges at dusk,
fish rising and jumping; wind gusts you can see rolling through grass and trees. Sound is
synthesised and positional: each bird species' song, woodpeckers, cuckoos, crows, buzzards,
ducks, frogs at dusk, bees, squirrel chatter.

### Settings

Graphics quality (Low / Medium / High) is on the title screen and in the ≡ menu. Touch devices
default to Medium, desktops to High; resolution also scales automatically to hold frame rate.
URL options: `?quality=low|medium|high`,
`?scenario=riverlands|highlands|mistwood|hamlet|heath|coast|canyon|tropics|lakeland` (force a destination), `?debug` (performance overlay), `?fixedres` (disable dynamic resolution).

## Under the hood

- **Procedural wilderness, streamed as you walk**: 64 m terrain chunks generated on demand in
  three LOD rings, deterministic so revisited ground is identical. Every expedition world is a
  blend of two landscapes: the exact terrain of the village woods (same generator and seed as the
  village) around the start of the road, and the destination landscape beyond — a coastline with
  dunes, headlands and offshore stacks, or a canyon cut in six terraced steps with a river channel
  and buttes — mixed by a noisy distance field so the transition is gradual. The road is laid
  along a curve that is fixed near home and wanders differently each time, flattened into the
  terrain, and stops where the land does (at the dunes, a canyon rim or a lake shore). Height field from warped
  fBm hills, ridged mountains, river valleys, lowland streams, kettle ponds, lake basins and
  wetlands; per-point moisture, forest density and conifer/broadleaf character drive the ecology.
- **Species-accurate procedural flora** (`src/world/flora.js`): each mushroom is built so its
  identification features physically exist — chanterelle ridges fork and run down the stem,
  boletes have pore sponges and stem nets (white on porcini, dark on bitter bolete), the death
  cap has a skirt ring and a buried volva, fly agaric has warts and a scaly bulb, parasols have
  snakeskin stems and double rings, hedgehogs have spines, puffballs and earthballs can be sliced.
- **Rendering**: PBR terrain splat blending home ground into the destination's ground per vertex
  (beach sand, banded canyon sandstone, snow, moss, straw-dry grass), wet ground in rain and snow
  cover in snowfall; sea swell (Gerstner-style waves displaced in the water shader) with rolling
  surf lines and whitecaps that grow with the wind; Preetham sky, cloud dome, stars, sun/moon with
  shadows, sky-driven image-based lighting, fog, rain, wind-animated vegetation with rolling
  gusts, instanced grass, depth-aware water with reflections and foam, a post-processing pass
  for sickness and altered states (only active when needed).
- **Trees** are built procedurally from scanned Poly Haven bark and foliage, because the
  photoscanned tree models are millions of triangles — far beyond an iPad.
- **Instanced pools** keep draw calls around 150–250 regardless of how much is loaded.

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
  compression, simplification, foliage compositing). The processed results (~10 MB) are
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
src/world/road.js          the road out of the North Gate
src/world/herds.js         herds and flocks (horses, gulls, geese, ravens, parrots, waders, starlings)
src/game/              items & artifacts, save, player & input, fishing, artifact 3D models
src/audio/audio.js     synthesised soundscape
src/ui/ui.js           HUD helpers
tools/                 offline asset pipeline
```

## Testing status

Verified in headless Chrome (software WebGL) with automated scripts: loading, the village, all
nine destinations and the road out to them, the full Village → Expedition → Gather → Return Home → New Expedition cycle with
persistence, examining and picking mushrooms, the herbalist, raw eating with poisoning and
psychoactive effects, cooking, fishing from bait choice to landing, trail tracks, a trap lesson
with its check, setting and checking a snare, trading, crafting, the field guide, ambient wildlife
spawning, and touch controls under iPad emulation — with zero console errors.

**Not yet verified on physical hardware:** real iPad Safari frame rate and memory, iOS audio
unlock behaviour, and real GPU visuals (tests used a software renderer). If an iPad struggles,
choose *Low* in the ≡ menu; dynamic resolution also kicks in below ~27 fps.

## Known limitations / next steps

- There is no swimming — deep water blocks you. Rivers, lakes and the sea share one water level
  (no waterfalls, no tides).
- Animals in herds and flocks are procedural low-poly models: convincing as silhouettes and in
  motion at the distances you usually see them, plain up close.
- People are implied (honesty stalls, chimney smoke) rather than simulated; there are no NPCs.
- There is no shooting or hunting by design — food comes from foraging, fishing and traps.
  Roe deer appear only as tracks; a realistic animated deer would need a suitably licensed model.
- Small animals (songbirds, hares, squirrels, ducks) are simple procedural models — convincing
  at the distances you usually see them, plainer up close.
- Distant terrain beyond ~200–250 m is hidden by fog; a far-terrain impostor ring would open up
  mountain vistas.
- Grotto "caves" are rock shelters, not true underground spaces (height-field terrain).

Credits and licences for all third-party components are in [CREDITS.md](CREDITS.md).
