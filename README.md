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
| Run | hold Shift, or **R** / **Run** button to toggle | **Run** button (tap to toggle), or push the stick to its edge |
| Auto-run (steer by looking) | **Q**, or hold the **Run** button | hold the **Run** button; pull back to stop |
| Jump | Space | ⤒ |
| Swim: dive / come up | hold **C** (swim where you look) / Space | hold **Dive** / hold ⤒ |
| Interact | E or left click | ✋ (appears when something is in reach) |
| Pack / Journal | I / J | Pack / Log buttons (eat, bait, dig for worms, make & set traps) |
| Return home | H or **⌂ Return Home** | **⌂ Return Home** (top right) |
| Lantern (once crafted) | L | ☀ |

### Running, tiring and resting

Running is a steady long-distance pace (about 6.5 m/s, more than twice walking speed — leaving
headroom for faster mounts later). A fresh run lasts about two minutes, over three when you are
well fed; uphill tires you faster, downhill slower. As you tire you slow to a heavy jog and hear
your breathing; run yourself out and you are **winded** — walk or stop until your breath comes
back. Standing still for a few seconds you sit down, which recovers fastest. While you run, the
land ahead is generated first, and chunk work is spread across frames so the world keeps up.

### The far lands

Keep going and the land keeps changing. Beyond about a kilometre from the road the world is
divided into irregular regions roughly 1.3 km across — **high country** with peaks, **lake
country**, **marshland**, **open plains**, **old forest**, **hill country** — blended at their
borders, each named as you cross into it, often with its own weather. Each far region is seeded
with its own places to find (ruins, standing stones, cabins, crystal grottoes, settlements and
lost objects), built just before you get there, so a long run always leads somewhere new.

### The loop

1. **Village** — the storehouse shows what you own (its piles of wood, stone and fish grow
   visibly), the workshop crafts equipment, teaches trapping and builds village upgrades, the
   Hall of Discoveries displays artifacts, **Maren the herbalist** checks the mushrooms and plants
   you bring home, the hearth at home cooks from your stores, and the noticeboard holds your
   journal and field guide.
2. **Expedition** — walk out through the North Gate onto the road. Right by the gate it is still
   the forest around your village (the palisade is behind you, and a fingerpost points home), but
   the new land is already in view ahead, and within a hundred metres or so you are in it: rolled from nine
   kinds: **The Coast** (beach, dunes, headlands, sea stacks, rock pools, a shipwreck), **Canyon
   Country** (a terraced, banded sandstone canyon with a river far below, juniper and pinyon,
   cliff dwellings and rock carvings), **The Tropics** (palms, tree ferns, wild bananas, lagoons,
   vine-covered ruins), **Lake Country** (a great lake with wooded islands), Riverlands,
   Highlands, Mistwood fens, Meadowlands and Old Heath. Each has its own terrain, plants, fungi,
   fish, animals, sounds and weather. The weather can change while you are out: a sunny beach
   can turn windy, then stormy, with lightning, thunder, rain and big surf.
3. **Forage, fish, trap, discover** — see below. You can carry as much as you like.
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

### Building your own place

Everything you bring home can go into your own house. Press **Build** (or B) in the village, or
use the workshop: floors, walls (plank, log, stone, driftwood, canyon sandstone, with windows and
doorways) and roofs (thatch, tiles, palm fronds) snap to a 2 m grid; furniture (bed, table, bench,
storage chest, display shelf, stone hearth with a real fire, lantern posts) and decorations (a bowl
of seashells, a shell wind chime, a sea-glass mobile, driftwood sculptures, benches and fences,
crystal displays, pelt rugs, pots of wildflowers, stepping stones, cairns, your best fish mounted)
go anywhere and can be turned. Artifacts can be put on stands in your house instead of the Hall.
A bed you build is a place to rest, a hearth cooks, a chest opens your stores. Everything taken
down is refunded. Some materials only come from certain lands: shells, driftwood and sea glass
from the coast, sandstone slabs from the canyon, palm fronds from the tropics, crystals from the
highlands, clay from the fens.

### Danger

The wilderness is mostly peaceful, but not always:
- **Bears** (brown bears in the northern woods, black bears in canyon country) forage, stand up to
  smell you, and bluff-charge if you press them. Running turns a bluff into a real chase. Back away
  slowly and they usually leave; crowd one and it will attack — you wake up at home, hurt.
- **Snakes** bask in the open: adders on heaths, dunes and woodland edges; rattlesnakes in canyon
  country (listen for the rattle); the fer-de-lance in the tropics. They strike only if you come
  within reach. A venomous bite slowly weakens you — get home to Maren in time. Harmless snakes
  (grass snake, gopher snake — which imitates a rattlesnake — and boa) slip away. Observing them
  from a safe distance teaches you how to tell them apart and what to do if bitten.
- **Mountain lions** (highlands and canyon country) are rarely seen. One may watch you from a rise,
  and if you turn your back it creeps closer — freezing whenever you look round. Face it, stand
  tall and it backs down; run, and it chases.
- **Moose** (lake country and misty woods) wade the shallows to feed. Calm until crowded — then
  ears back, hackles up, and a charge. Give them room.
- **Wild boar** sows defend their striped piglets: blunder in among them and you get bowled over.
- **Wolves** depend on their numbers. A lone wolf or a pair slips away. Three or four stop and
  watch you, or shadow you at a distance — walk at them and they move off. Five or more are
  dangerous: they watch, then spread out and close in if you approach or run. Face them and back
  away steadily and they lose interest; let them reach you and the expedition ends. At night you
  hear them howl.
  Coyotes lope across canyon country. Elk herds graze high meadows; mountain goats and bighorn
  sheep pick along cliffs; capybara families lounge by tropical water and coatis troop through the
  jungle; otters swim, roll and dive in rivers, lakes and coves.
- And the gentler life: red and mule deer (sometimes out on the beach), shore crabs to catch
  (from behind), seals hauled out on the rocks, dolphins rolling past offshore, and now and then
  the tall spout, back and tail of a blue whale far out at sea.

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
fish rising and jumping; wind gusts you can see rolling through grass and trees.

**Sound** uses real open-licensed field recordings placed in 3D (HRTF): crickets sit in the grass
and fall quiet as you pass, songbirds sing a few songs from a perch and then move on (more at
the dawn chorus), the river is heard from where the river is, a campfire crackles where it
burns. Each land has its own voices — loons on the lakes, curlews and oystercatchers at the
shore, howler monkeys at a jungle dawn, wolves at night. Background beds never loop audibly
(fresh random start, crossfaded every 15–35 s) and a wandering activity level gives lulls.

### Water

Every lake and river reflects the world around it — trees, hills, the village, the sky — through
a mirror render pass. Rivers and streams visibly run downstream (their current follows the
channel), with foam drifting along the banks. The sea is a sum of Gerstner waves with real
deep-water dispersion: sharp crests and broad troughs, swell that steepens in the shallows,
white water riding each breaker in, and a lacy wash that runs up the sand and drains back. And
the water responds: a small GPU wave solver around you turns footsteps, wading, a cast bobber, a
jumping fish, a diving otter or a frog — and every raindrop — into rings that spread, cross and
fade.

### Swimming and diving

Wade in past chest depth and you swim. At the surface you float with your eyes at water level,
riding the sea swell; rivers carry you downstream. Hold Dive to go under — underwater you swim
where you look. Your breath lasts about 40 seconds (closer to a minute when well fed); the breath
bar empties, your lungs burn, the edges of your sight darken, and if you don't make the surface
you black out and wake on the bank. Underwater the world turns to a blue-green murk (clearest
in the tropics, greenest in lakes), sound goes muffled, light dances in caustics across the
bed, and looking up you see Snell's window — the bright sky through a circle in the silvered
surface. Schools of fish drift and scatter (perch and roach in fresh water, mackerel at sea,
bright reef fish in the tropics), waterweed and kelp forests sway, coral heads grow in warm
lagoons, and somewhere on the bottom of every expedition something lost is waiting to be found.

**Sharks.** Swim out into deep salt water (or a tropical lagoon) and a fin may appear — a great
white on cold coasts, a bull shark in the tropics. It circles, closing in, with a slow pulse of
low notes that quickens as it comes. Keep it in sight and swim steadily for water too shallow
for it: watching it slows it down; thrashing and sprinting bring it in fast. If it reaches you,
it strikes and the expedition ends.

### Settings

Graphics quality (Low / Medium / High) is on the title screen and in the ≡ menu. Touch devices
default to Medium, desktops to High; resolution also scales automatically to hold frame rate.
Water reflections can be switched off in the ≡ menu (they are off by default on *Low*).
URL options: `?quality=low|medium|high`, `?norefl`, `?noripples`,
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
  cover in snowfall; water with planar reflections, a GPU ripple solver, flow-mapped rivers and
  Gerstner sea swell with breakers and beach run-up (`water.js`, `waterfx.js`); Preetham sky, cloud dome, stars, sun/moon with
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
src/world/fauna.js         deer, bears, snakes, crabs, seals, dolphins, whales
src/world/beasts.js        mountain lion, wolves, coyotes, moose, elk, boar, goats, bighorn, capybara, coatis, otters
src/world/waterfx.js       ripple solver and mirror reflections for the water
src/world/sea.js           underwater life: fish schools, weed, kelp, coral, sharks
src/game/building.js, buildmode.js   building & decorating your place
src/game/              items & artifacts, save, player & input, fishing, artifact 3D models
src/audio/audio.js     3D soundscape: recordings placed in the world, beds, synth fallbacks
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

- Rivers, lakes and the sea share one water level (no waterfalls, no tides).
- The water is shaded and simulated on the GPU, not a full fluid simulation: rivers flow by
  flow-mapping, the sea by summed Gerstner waves, ripples by a 2D wave equation around the player.
  Full 3D fluid solvers (SPH/FLIP) are far too heavy for an iPad browser.
- Animals in herds and flocks, bears, deer, big cats, moose, wolves, seals, whales and snakes are procedural low-poly
  models: convincing as silhouettes and in motion at the distances you usually see them, plain
  up close.
- Building is single-storey for now, inside the palisade, on the flat village yard.
- People are implied (honesty stalls, chimney smoke) rather than simulated; there are no NPCs.
- There is no shooting or hunting by design — food comes from foraging, fishing, traps and crabs.
- Small animals (songbirds, hares, squirrels, ducks) are simple procedural models — convincing
  at the distances you usually see them, plainer up close.
- Distant terrain beyond ~200–250 m is hidden by fog; a far-terrain impostor ring would open up
  mountain vistas.
- Grotto "caves" are rock shelters, not true underground spaces (height-field terrain).

Credits and licences for all third-party components are in [CREDITS.md](CREDITS.md).
