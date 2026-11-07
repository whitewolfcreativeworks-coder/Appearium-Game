# Credits & third-party licences

Appearium is built from open-source software and openly licensed assets. Everything
bundled in this repository is listed here.

## Software

| Component | Version | Licence | Where |
|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) — renderer, glTF loader, Sky (Preetham model), SkeletonUtils, BufferGeometryUtils | r170 | MIT (`vendor/three/LICENSE`) | `vendor/three/` |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) decoder (bundled with three.js addons) | — | MIT | `vendor/three/addons/libs/` |
| [glTF-Transform](https://gltf-transform.dev), meshoptimizer, sharp — **offline asset pipeline only** | 4.x | MIT / MIT / Apache-2.0 | `tools/` (not shipped to players) |

Techniques adapted (code written for this game): the planar-reflection oblique clipping from
three.js's `Reflector` (MIT), and the height-field ripple solver popularised by Evan Wallace's
[WebGL Water](https://github.com/evanw/webgl-water) (MIT); Gerstner waves after Tessendorf /
*GPU Gems* ch. 1.

Simplex noise in `src/core/noise.js` is an original implementation of Stefan Gustavson's
public-domain reference algorithm.

## Textures and models — Poly Haven (CC0)

All of the following are from [Poly Haven](https://polyhaven.com) and are released under
**CC0 1.0** (public domain). They were resized/optimised by `tools/fetch_assets.py`.

**Terrain textures:** leafy_grass, sparse_grass, aerial_grass_rock, forest_ground_04,
brown_mud_leaves_01, forrest_ground_01, aerial_rocks_02, aerial_rocks_04, rock_face,
rocky_terrain_02, coast_sand_rocks_02, coast_land_rocks_01, mud_forest, snow_02, gravel_floor,
dry_riverbed_rock, forest_leaves_03, forest_leaves_04, forest_floor, cliff_side, rock_wall_08,
grass_path_2, aerial_ground_rock, aerial_beach_01 (beaches), dry_ground_rocks and sandstone_cracks
(canyon country), red_dirt_mud_01, red_sandstone_wall (cliff dwellings), gravel_road (the road).

**Building & bark textures:** weathered_planks, rough_wood, thatch_roof_angled, roof_tiles_14,
plastered_stone_wall, castle_brick_07, cobblestone_floor_08, wood_planks_grey, stone_wall,
bark_brown_02, pine_bark.

**Models:** fern_02, shrub_02, dandelion_01, celandine_01, nettle_plant, rock_07,
rock_moss_set_01, tree_stump_01, dead_tree_trunk, wooden_crate_01, wooden_bucket_01,
ceramic_vase_01, antique_ceramic_vase_01, brass_vase_01, wooden_axe.

**Foliage cards** (`assets/tex/foliage/`) are composites made by the pipeline from the CC0
twig/leaf textures of Poly Haven's `fir_tree_01` and `island_tree_02` models.

## Cover art

The Appearium cover art (`assets/ui/cover.*`, the app icons and the title-screen background) was provided by the game's creator.

## Other assets

| Asset | Source | Licence |
|---|---|---|
| Fox (`assets/models/fox.glb`) | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox) — model by **PixelMannen** (CC0), rigging & animation by **@tomkranis** on Sketchfab | **CC-BY 4.0** (rig/animation) — attribution required |
| Barramundi fish (`assets/models/fish.glb`) | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish) — Microsoft | CC0 1.0 |
| Water normal map (`assets/tex/waternormals.jpg`) | three.js examples | MIT |

## Sound recordings

The nature recordings in `assets/audio/` (birdsong, insects, frogs, mammals, water, wind, rain,
surf, thunder, footsteps) come from Wikimedia Commons and OpenGameArt under public domain, CC0,
CC BY and CC BY-SA licences, trimmed and re-encoded for the game. Every file is credited with
its author, licence and source in [assets/audio/CREDITS-audio.md](assets/audio/CREDITS-audio.md).
Edited CC BY-SA recordings remain under CC BY-SA. Sounds without a recording (e.g. mountain lion,
elk, coyote, boar, rattlesnake) are synthesised at runtime with the Web Audio API.

Mushrooms, berries and greens, fish, small animals, insects, track prints, traps and the
specimen viewer are generated procedurally in code (`src/world/flora.js`, `fishModel.js`,
`critters.js`, `trails.js`). Palms, tree ferns, bananas, junipers, pinyons, yuccas, dune grass,
shells and wrack (`vegetation.js`), and the horses, gulls, geese, ravens, parrots, storks,
flamingos and starlings (`herds.js`) are procedural too — their leaf and frond textures are drawn
on a canvas at load time. Species information in `src/data/species.js` was written for this
game from general natural-history knowledge and is simplified; it is not a field guide.
