// Expedition scenarios. Each expedition rolls one archetype, then varies its terrain, weather,
// time of day, foliage season and points of interest, and gives the region a name.
import { RNG } from '../core/rng.js';

const PREFIX = ['Ash', 'Grey', 'Mist', 'Elder', 'Raven', 'Hollow', 'Stone', 'Fern', 'Bright', 'Cold', 'Thorn', 'Moss', 'Ember', 'Wolf', 'Silver', 'Rook', 'Dusk', 'Larch', 'Heron', 'Alder', 'Sorrow', 'Wren', 'Black', 'Kestrel'];
const SUFFIX = ['mere', 'vale', 'wood', 'fell', 'moor', 'reach', 'brook', 'holt', 'water', 'combe', 'dale', 'haven', 'ford', 'stead', 'ley'];
export function placeName(rng) { return rng.pick(PREFIX) + rng.pick(SUFFIX); }

export const SCENARIOS = {
  riverlands: {
    title: 'Riverlands', nouns: ['Reaches', 'Waters', 'Woods'],
    blurb: 'Wooded valleys threaded with rivers and still lakes. Good fishing, if the trout are biting.',
    terrain: { base: 5, hills: 15, rivers: 1.0, riverWidth: 0.03, lakes: 0.55, forest: 0.08, moisture: 0.05, streams: 1.0, ponds: 0.6 },
    layers: { grass: 'rocky_terrain_02', forest: 'forest_leaves_03', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02', extra: 'brown_mud_leaves_01', autumnForest: 'forest_floor' }, extraMode: 2,
    weathers: [['clear', 3], ['hazy', 2], ['overcast', 1], ['rain', 0.6]], times: [[7.2, 2], [9.5, 3], [14, 2], [17.2, 1]],
    eco: { fungi: 1, flora: 1, lilies: 0.4, treeDensity: 0.024, conifer: 0.45, broad: 0.55, snag: 0.03, fern: 0.6, grass: 1.0, flowers: 0.5, rocks: 0.3, logs: 0.6, minerals: [] },
    fish: { river: ['trout', 'grayling'], lake: ['perch', 'pike'] },
    pois: [['cabin', 0.6], ['stones', 0.3], ['find', 1]], foxes: 3,
  },
  highlands: {
    title: 'Highlands', nouns: ['Fells', 'Heights', 'Crags'],
    blurb: 'High stony fells, cold tarns and sparse pines. Minerals glint where the rock breaks open.',
    terrain: { base: 8, hills: 22, mountains: 80, mountainCover: 0.42, rivers: 0.45, lakes: 0.45, forest: -0.18, treeLine: 52, snowLine: 58, roughness: 1.3, streams: 0.8, ponds: 0.5 },
    layers: { grass: 'aerial_rocks_04', forest: 'forest_leaves_04', rock: 'aerial_rocks_02', shore: 'grass_path_2', extra: 'snow_02' }, extraMode: 1,
    weathers: [['clear', 3], ['mist', 1.5], ['overcast', 1.5]], times: [[8, 2], [11, 2], [15.5, 2], [17.4, 1]],
    eco: { fungi: 0.7, flora: 0.8, floraW: { cloudberry: 1.5, lingonberry: 1.6 }, fungiW: { fly_agaric: 1.5 }, lilies: 0.2, treeDensity: 0.02, conifer: 0.92, broad: 0.08, snag: 0.08, fern: 0.15, grass: 0.7, flowers: 0.15, rocks: 1.3, logs: 0.3, minerals: ['quartz', 'amethyst', 'iron', 'copper'] },
    fish: { river: ['grayling', 'trout'], lake: ['char', 'char', 'perch'] },
    pois: [['grotto', 1], ['stones', 0.4], ['cabin', 0.3], ['find', 1]], foxes: 2,
  },
  mistwood: {
    title: 'Mistwood', nouns: ['Fens', 'Mires', 'Carr'],
    blurb: 'A drowned forest of pools, moss and mushrooms. Fog clings to the alders; something glows at night.',
    terrain: { base: 2.6, hills: 6, rivers: 0.5, lakes: 0.2, wetland: 0.95, forest: 0.3, moisture: 0.32, roughness: 0.7, streams: 0.7, ponds: 1.0 },
    layers: { grass: 'rocky_terrain_02', forest: 'forest_leaves_03', rock: 'aerial_rocks_02', shore: 'mud_forest', extra: 'brown_mud_leaves_01' }, extraMode: 2,
    weathers: [['mist', 3], ['rain', 1.5], ['overcast', 1.5], ['hazy', 0.6]], times: [[6.8, 2], [10, 2], [16, 1], [20.6, 1.4]],
    eco: { fungi: 1.7, flora: 1.1, floraW: { cloudberry: 2, ramsons: 1.5, lily_of_the_valley: 1.3 }, lilies: 0.9, treeDensity: 0.028, conifer: 0.3, broad: 0.7, snag: 0.12, fern: 1.4, grass: 0.8, flowers: 0.2, rocks: 0.15, logs: 1.2, minerals: [], clay: true, fireflies: true },
    fish: { river: ['tench', 'perch'], lake: ['tench', 'pike', 'perch'] },
    pois: [['cabin', 0.7], ['ruins', 0.35], ['find', 1]], foxes: 2,
  },
  hamlet: {
    title: 'Meadowlands', nouns: ['Downs', 'Meadows', 'Leas'],
    blurb: 'Open rolling country, groves and wildflowers. Smoke on the horizon suggests a settlement.',
    terrain: { base: 5, hills: 13, rivers: 0.65, lakes: 0.25, forest: -0.16, moisture: -0.02, streams: 0.8, ponds: 0.7 },
    layers: { grass: 'rocky_terrain_02', forest: 'forest_leaves_03', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02', extra: 'forrest_ground_01', autumnForest: 'forest_floor' }, extraMode: 3,
    weathers: [['clear', 3], ['hazy', 2], ['overcast', 0.8]], times: [[8.5, 1], [12, 2], [16.5, 2], [17.5, 1]],
    eco: { fungi: 0.8, flora: 1.1, fungiW: { parasol: 2, giant_puffball: 2, shaggy_inkcap: 2, liberty_cap: 1.5 }, floraW: { dandelion: 1.5, raspberry: 1.5 }, lilies: 0.6, treeDensity: 0.022, conifer: 0.25, broad: 0.75, snag: 0.02, fern: 0.25, grass: 1.25, flowers: 1.4, rocks: 0.3, logs: 0.4, minerals: [] },
    fish: { river: ['trout', 'perch'], lake: ['perch', 'tench'] },
    pois: [['hamlet', 1], ['stones', 0.35], ['find', 1]], foxes: 3,
  },
  heath: {
    title: 'Old Heath', nouns: ['Heath', 'Barrows', 'Wastes'],
    blurb: 'Wind-scoured heath and pinewood, scattered with the bones of an older country.',
    terrain: { base: 6, hills: 19, rivers: 0.4, lakes: 0.3, forest: -0.08, moisture: -0.15, roughness: 1.15, streams: 0.6, ponds: 0.6 },
    layers: { grass: 'aerial_rocks_04', forest: 'forest_leaves_04', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02', extra: 'aerial_grass_rock' }, extraMode: 3,
    weathers: [['hazy', 2], ['clear', 2], ['overcast', 1.5], ['mist', 0.8]], times: [[7.5, 1], [13, 1], [16.9, 3], [17.6, 1]],
    eco: { fungi: 0.9, flora: 0.9, fungiW: { earthball: 1.5, fly_agaric: 1.5 }, floraW: { lingonberry: 1.8, bilberry: 1.4 }, lilies: 0.4, treeDensity: 0.02, conifer: 0.85, broad: 0.15, snag: 0.06, fern: 0.4, grass: 0.9, flowers: 0.3, rocks: 0.9, logs: 0.5, minerals: ['quartz', 'iron'] },
    fish: { river: ['trout'], lake: ['perch', 'pike'] },
    pois: [['ruins', 1], ['stones', 0.6], ['cabin', 0.3], ['find', 1]], foxes: 2,
  },
};

const ORDER = ['riverlands', 'highlands', 'mistwood', 'hamlet', 'heath'];
const SPECIALTIES = ['potters', 'smiths', 'carvers', 'weavers'];

export function generateExpedition(no, seed, prevScenario = null, force = null) {
  const rng = new RNG(seed);
  // first expedition is always the gentle riverlands; then avoid repeating the last archetype
  let id = no === 1 ? 'riverlands' : rng.pick(ORDER.filter((s) => s !== prevScenario));
  if (force && SCENARIOS[force]) id = force;
  const S = SCENARIOS[id];
  const terrain = { ...S.terrain };
  // vary terrain within the archetype
  terrain.hills = (terrain.hills ?? 14) * rng.range(0.75, 1.3);
  if (terrain.mountains) terrain.mountains *= rng.range(0.8, 1.25);
  terrain.forest = (terrain.forest ?? 0) + rng.range(-0.08, 0.1);
  terrain.lakes = Math.max(0, (terrain.lakes ?? 0.3) + rng.range(-0.15, 0.2));
  const place = placeName(rng);
  const name = `The ${place} ${rng.pick(S.nouns)}`;
  const weather = rng.weighted(S.weathers);
  const time = rng.weighted(S.times) + rng.range(-0.4, 0.4);
  const autumn = rng.chance(id === 'heath' || id === 'highlands' ? 0.45 : 0.3) ? rng.range(0.35, 1) : 0;
  const pois = [];
  for (const [type, p] of S.pois) if (rng.chance(p)) {
    pois.push({ type, angle: rng.range(0, Math.PI * 2), dist: type === 'find' ? rng.range(70, 160) : rng.range(130, 260), seed: Math.floor(rng.next() * 1e9), name: type === 'find' ? null : placeName(rng), specialty: rng.pick(SPECIALTIES) });
  }
  // spread POIs apart angularly
  pois.sort((a, b) => a.angle - b.angle);
  pois.forEach((p, i) => { p.angle = (i / pois.length) * Math.PI * 2 + rng.range(-0.5, 0.5); });
  const main = pois.find((p) => p.type !== 'find');
  const dirName = (a) => ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8];
  const rumors = {
    hamlet: (p) => `Smoke rises from a settlement somewhere to the ${dirName(p.angle)} — the folk of ${p.name} are said to trade.`,
    ruins: (p) => `An old map marks the ruins of ${p.name} to the ${dirName(p.angle)}.`,
    grotto: (p) => `A shepherd once spoke of a crystal grotto beneath the crags, ${dirName(p.angle)} of here.`,
    stones: (p) => `Standing stones are said to ring a hilltop to the ${dirName(p.angle)}.`,
    cabin: (p) => `A trapper's cabin lies abandoned somewhere to the ${dirName(p.angle)}.`,
  };
  return {
    no, seed, scenario: id, title: S.title, name, place, weather, time: (time + 24) % 24, autumn,
    terrain, layers: autumn > 0.5 && S.layers.autumnForest ? { ...S.layers, forest: S.layers.autumnForest } : S.layers, extraMode: S.extraMode, eco: S.eco, fish: S.fish, foxes: S.foxes,
    pois, rumor: main ? rumors[main.type](main) : 'No one you know has walked this land before.',
    // autumn expeditions carpet broadleaf woods with fallen yellow leaves
    blurb: S.blurb,
  };
}
