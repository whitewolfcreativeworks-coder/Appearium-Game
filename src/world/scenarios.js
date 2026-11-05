// Expedition scenarios. Each expedition rolls one archetype, then varies its terrain, weather,
// time of day, foliage season and points of interest, and gives the region a name.
import { RNG } from '../core/rng.js';

const PREFIX = ['Ash', 'Grey', 'Mist', 'Elder', 'Raven', 'Hollow', 'Stone', 'Fern', 'Bright', 'Cold', 'Thorn', 'Moss', 'Ember', 'Wolf', 'Silver', 'Rook', 'Dusk', 'Larch', 'Heron', 'Alder', 'Sorrow', 'Wren', 'Black', 'Kestrel'];
const SUFFIX = ['mere', 'vale', 'wood', 'fell', 'moor', 'reach', 'brook', 'holt', 'water', 'combe', 'dale', 'haven', 'ford', 'stead', 'ley'];
const NAMES = {
  coast: [['Gull', 'Salt', 'Tern', 'Shell', 'Drift', 'Storm', 'Seal', 'Wrack', 'Kelp', 'Cormorant'], ['haven', 'mouth', 'strand', 'head', 'point', 'cove', 'sands', 'wick']],
  canyon: [['Red', 'Ochre', 'Raven', 'Juniper', 'Echo', 'Sun', 'Dust', 'Coyote', 'Ember', 'Hollow'], [' Mesa', ' Wash', ' Rim', ' Butte', ' Spring', ' Gulch', ' Bend', ' Breaks']],
  tropics: [['Green', 'Orchid', 'Heron', 'Rain', 'Jade', 'Mango', 'Fig', 'Kingfisher', 'Monsoon', 'Vine'], ['water', ' Lagoon', ' Falls', 'wood', ' River', ' Shallows', ' Bend']],
};
export function placeName(rng, region) { const N = NAMES[region]; return N ? rng.pick(N[0]) + rng.pick(N[1]) : rng.pick(PREFIX) + rng.pick(SUFFIX); }

export const SCENARIOS = {
  riverlands: {
    title: 'Riverlands', nouns: ['Reaches', 'Waters', 'Woods'],
    blurb: 'Wooded valleys threaded with rivers and still lakes. Good fishing, if the trout are biting.',
    terrain: { base: 5, hills: 15, rivers: 1.0, riverWidth: 0.03, lakes: 0.55, forest: 0.08, moisture: 0.05, streams: 1.0, ponds: 0.6 },
    layers: { ground: 'rocky_terrain_02', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02' }, mode: 'wet',
    weathers: [['clear', 3], ['hazy', 2], ['overcast', 1], ['rain', 0.6], ['windy', 0.5]], times: [[7.2, 2], [9.5, 3], [14, 2], [17.2, 1]],
    eco: { fungi: 1, flora: 1, lilies: 0.4, treeDensity: 0.024, conifer: 0.45, broad: 0.55, snag: 0.03, fern: 0.6, grass: 1.0, flowers: 0.5, rocks: 0.3, logs: 0.6, minerals: [] },
    fish: { river: ['trout', 'grayling'], lake: ['perch', 'pike'] },
    pois: [['cabin', 0.6], ['stones', 0.3], ['find', 1]], foxes: 3, fauna: { deer: 'red_deer', bear: 'brown_bear', snakes: ['grass_snake', 'adder'] }, herds: ['geese', 'storks'],
  },
  highlands: {
    title: 'Highlands', nouns: ['Fells', 'Heights', 'Crags'],
    blurb: 'High stony fells, cold tarns and sparse pines. Minerals glint where the rock breaks open.',
    terrain: { base: 8, hills: 22, mountains: 80, mountainCover: 0.42, rivers: 0.45, lakes: 0.45, forest: -0.18, treeLine: 52, snowLine: 58, roughness: 1.3, streams: 0.8, ponds: 0.5 },
    layers: { ground: 'aerial_rocks_04', rock: 'aerial_rocks_02', shore: 'grass_path_2' }, mode: 'snow', forestTint: 0xd8c8b0,
    weathers: [['clear', 3], ['mist', 1.5], ['overcast', 1.5], ['windy', 1], ['snow', 0.8]], times: [[8, 2], [11, 2], [15.5, 2], [17.4, 1]],
    eco: { fungi: 0.7, flora: 0.8, floraW: { cloudberry: 1.5, lingonberry: 1.6 }, fungiW: { fly_agaric: 1.5 }, lilies: 0.2, treeDensity: 0.02, conifer: 0.92, broad: 0.08, snag: 0.08, fern: 0.15, grass: 0.7, flowers: 0.15, rocks: 1.3, logs: 0.3, minerals: ['quartz', 'amethyst', 'iron', 'copper'] },
    fish: { river: ['grayling', 'trout'], lake: ['char', 'char', 'perch'] },
    pois: [['grotto', 1], ['stones', 0.4], ['cabin', 0.3], ['find', 1]], foxes: 2, fauna: { deer: 'red_deer', bear: 'brown_bear', snakes: ['adder'] }, herds: ['ravens', 'geese'],
  },
  mistwood: {
    title: 'Mistwood', nouns: ['Fens', 'Mires', 'Carr'],
    blurb: 'A drowned forest of pools, moss and mushrooms. Fog clings to the alders; something glows at night.',
    terrain: { base: 2.6, hills: 6, rivers: 0.5, lakes: 0.2, wetland: 0.95, forest: 0.3, moisture: 0.32, roughness: 0.7, streams: 0.7, ponds: 1.0 },
    layers: { ground: 'rocky_terrain_02', rock: 'aerial_rocks_02', shore: 'mud_forest' }, mode: 'wet',
    weathers: [['mist', 3], ['rain', 1.5], ['overcast', 1.5], ['hazy', 0.6], ['storm', 0.3]], times: [[6.8, 2], [10, 2], [16, 1], [20.6, 1.4]],
    eco: { fungi: 1.7, flora: 1.1, floraW: { cloudberry: 2, ramsons: 1.5, lily_of_the_valley: 1.3 }, lilies: 0.9, treeDensity: 0.028, conifer: 0.3, broad: 0.7, snag: 0.12, fern: 1.4, grass: 0.8, flowers: 0.2, rocks: 0.15, logs: 1.2, minerals: [], clay: true, fireflies: true },
    fish: { river: ['tench', 'perch'], lake: ['tench', 'pike', 'perch'] },
    pois: [['cabin', 0.7], ['ruins', 0.35], ['find', 1]], foxes: 2, fauna: { deer: 'red_deer', bear: 'brown_bear', snakes: ['grass_snake', 'grass_snake', 'adder'] }, herds: ['storks', 'murmuration'],
  },
  hamlet: {
    title: 'Meadowlands', nouns: ['Downs', 'Meadows', 'Leas'],
    blurb: 'Open rolling country, groves and wildflowers. Smoke on the horizon suggests a settlement.',
    terrain: { base: 5, hills: 13, rivers: 0.65, lakes: 0.25, forest: -0.16, moisture: -0.02, streams: 0.8, ponds: 0.7 },
    layers: { ground: 'rocky_terrain_02', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02' }, mode: 'dry',
    weathers: [['clear', 3], ['hazy', 2], ['overcast', 0.8], ['windy', 0.8], ['storm', 0.25]], times: [[8.5, 1], [12, 2], [16.5, 2], [17.5, 1]],
    eco: { fungi: 0.8, flora: 1.1, fungiW: { parasol: 2, giant_puffball: 2, shaggy_inkcap: 2, liberty_cap: 1.5 }, floraW: { dandelion: 1.5, raspberry: 1.5 }, lilies: 0.6, treeDensity: 0.022, conifer: 0.25, broad: 0.75, snag: 0.02, fern: 0.25, grass: 1.25, flowers: 1.4, rocks: 0.3, logs: 0.4, minerals: [] },
    fish: { river: ['trout', 'perch'], lake: ['perch', 'tench'] },
    pois: [['hamlet', 1], ['stones', 0.35], ['find', 1]], foxes: 3, fauna: { deer: 'red_deer', snakes: ['grass_snake', 'adder'] }, herds: ['horses', 'storks', 'murmuration'],
  },
  heath: {
    title: 'Old Heath', nouns: ['Heath', 'Barrows', 'Wastes'],
    blurb: 'Wind-scoured heath and pinewood, scattered with the bones of an older country.',
    terrain: { base: 6, hills: 19, rivers: 0.4, lakes: 0.3, forest: -0.08, moisture: -0.15, roughness: 1.15, streams: 0.6, ponds: 0.6 },
    layers: { ground: 'aerial_rocks_04', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02' }, mode: 'dry', forestTint: 0xd8c8b0,
    weathers: [['hazy', 2], ['clear', 2], ['overcast', 1.5], ['mist', 0.8], ['windy', 1.2], ['storm', 0.3]], times: [[7.5, 1], [13, 1], [16.9, 3], [17.6, 1]],
    eco: { fungi: 0.9, flora: 0.9, fungiW: { earthball: 1.5, fly_agaric: 1.5 }, floraW: { lingonberry: 1.8, bilberry: 1.4 }, lilies: 0.4, treeDensity: 0.02, conifer: 0.85, broad: 0.15, snag: 0.06, fern: 0.4, grass: 0.9, flowers: 0.3, rocks: 0.9, logs: 0.5, minerals: ['quartz', 'iron'] },
    fish: { river: ['trout'], lake: ['perch', 'pike'] },
    pois: [['ruins', 1], ['stones', 0.6], ['cabin', 0.3], ['find', 1]], foxes: 2, fauna: { deer: 'red_deer', bear: 'brown_bear', snakes: ['adder', 'adder', 'grass_snake'] }, herds: ['horses', 'murmuration'],
  },
  coast: {
    title: 'The Coast', nouns: ['Shore', 'Strand', 'Sands', 'Bay'], region: 'coast',
    blurb: 'The road runs out of the trees, over the dunes — and there is the sea. Rock pools, gulls, and whatever the tide brings in.',
    terrain: { kind: 'coast', base: 5, hills: 10, rivers: 0.35, lakes: 0.05, forest: -0.1, moisture: 0.05, streams: 0.5, ponds: 0.3, coastAt: 255 },
    layers: { ground: 'rocky_terrain_02', rock: 'aerial_rocks_02', shore: 'aerial_beach_01' }, mode: 'dry', shoreTint: 0xe8d8b8, sea: true,
    weathers: [['clear', 3], ['windy', 2], ['hazy', 1], ['overcast', 1], ['storm', 1], ['mist', 0.8]], times: [[9, 1], [13, 1], [17, 1]],
    eco: { region: 'coast', fungi: 0.6, flora: 1.0, lilies: 0.1, treeDensity: 0.016, trees: { conifer: 1, broad: 0.3, snag: 0.05 }, windswept: true, fern: 0.2, grass: 1.2, grassTint: [0.95, 1.05, 0.95], marram: true, flowers: 0.6, rocks: 0.6, logs: 0.3, minerals: [], driftwood: true },
    pois: [['wreck', 1], ['cabin', 0.3], ['find', 1]], foxes: 1, fauna: { deer: 'red_deer', snakes: ['adder'], crabs: true, seals: true, whales: true, dolphins: true }, herds: ['gulls', 'geese'],
  },
  canyon: {
    title: 'Canyon Country', nouns: ['Canyon', 'Mesa', 'Breaks', 'Gorge'], region: 'canyon',
    blurb: 'The forest thins, the soil turns red, and the land opens into a vast canyon of layered stone with a green river far below.',
    terrain: { kind: 'canyon', base: 6, hills: 9, rivers: 0, lakes: 0, forest: -0.35, moisture: -0.38, streams: 0, ponds: 0, plateau: 34, canyonWidth: 0.11, canyonAt: 290, roughness: 1.2, treeLine: 999 },
    layers: { ground: 'dry_ground_rocks', rock: 'sandstone_cracks', shore: 'red_dirt_mud_01' }, mode: 'desert', strata: true, forestTint: 0xc89a78,
    weathers: [['clear', 4], ['hazy', 2], ['windy', 1.5], ['storm', 0.5]], times: [[8, 1], [12, 1], [17, 2]],
    eco: { region: 'canyon', fungi: 0.25, flora: 1.0, lilies: 0, treeDensity: 0.012, trees: { juniper: 1.4, pinyon: 0.8, cottonwood: 0.2 }, fern: 0, grass: 0.55, grassTint: [1.35, 1.15, 0.7], flowers: 0.4, rocks: 1.4, logs: 0.15, minerals: ['quartz', 'copper', 'iron'], sage: true, yucca: true },
    pois: [['alcove', 1], ['carvings', 0.7], ['find', 1]], foxes: 2, fauna: { deer: 'mule_deer', bear: 'black_bear', snakes: ['rattlesnake', 'rattlesnake', 'gopher_snake'] }, herds: ['horses', 'ravens'],
  },
  tropics: {
    title: 'The Tropics', nouns: ['Jungle', 'Lagoon', 'Wilds'], region: 'tropics',
    blurb: 'The air grows warm and heavy. Pines give way to palms and giant leaves; the forest hums with insects and parrots.',
    terrain: { kind: 'tropics', base: 5, hills: 16, rivers: 0.9, riverWidth: 0.034, lakes: 0.35, forest: 0.35, moisture: 0.35, streams: 0.9, ponds: 0.6, forestScale: 0.006 },
    layers: { ground: 'rocky_terrain_02', rock: 'aerial_rocks_02', shore: 'red_dirt_mud_01' }, mode: 'wet', groundTint: 0xb8d8a0, forestTint: 0xb4a688,
    weathers: [['hazy', 2], ['rain', 2], ['clear', 1.5], ['storm', 0.8], ['mist', 1]], times: [[8, 1], [13, 1], [17, 1]],
    eco: { region: 'tropics', fungi: 1.0, flora: 1.2, lilies: 0.8, treeDensity: 0.03, trees: { broad: 1.2, palm: 0.8, treefern: 0.5 }, lush: true, fern: 1.4, grass: 0.9, grassTint: [0.85, 1.1, 0.8], flowers: 0.5, rocks: 0.2, logs: 0.9, minerals: [], bananas: true, fireflies: true },
    pois: [['ruins', 1], ['find', 1], ['cabin', 0.2]], foxes: 0, fauna: { snakes: ['fer_de_lance', 'boa'], crabs: true }, herds: ['parrots', 'flamingos'],
  },
  lakeland: {
    title: 'Lake Country', nouns: ['Lakes', 'Waters', 'Isles'], region: 'temperate',
    blurb: 'Beyond the trees lies a great lake scattered with wooded islands. Loons call across the water.',
    terrain: { base: 4, hills: 12, rivers: 0.3, lakes: 1.15, lakeDepth: 6, islands: true, forest: 0.05, moisture: 0.1, streams: 0.6, ponds: 0.4 },
    layers: { ground: 'rocky_terrain_02', rock: 'aerial_rocks_02', shore: 'coast_sand_rocks_02' }, mode: 'wet',
    weathers: [['clear', 3], ['mist', 1.5], ['overcast', 1], ['windy', 1], ['rain', 0.6], ['storm', 0.3]], times: [[7, 1], [12, 1], [18, 1]],
    eco: { fungi: 1, flora: 1, lilies: 0.8, treeDensity: 0.024, conifer: 0.65, broad: 0.35, snag: 0.04, fern: 0.6, grass: 1.0, flowers: 0.4, rocks: 0.5, logs: 0.6, minerals: [] },
    pois: [['cabin', 0.8], ['stones', 0.3], ['find', 1]], foxes: 2, fauna: { deer: 'red_deer', bear: 'brown_bear', snakes: ['grass_snake', 'adder'] }, herds: ['geese', 'storks'],
  },
};

const ORDER = ['riverlands', 'highlands', 'mistwood', 'hamlet', 'heath', 'coast', 'canyon', 'tropics', 'lakeland'];
const SPECIALTIES = ['potters', 'smiths', 'carvers', 'weavers'];

export function generateExpedition(no, seed, prevScenario = null, force = null) {
  const rng = new RNG(seed);
  // first expedition is always the gentle riverlands; then avoid repeating the last archetype
  let id = no === 1 ? 'riverlands' : rng.pick(ORDER.filter((s) => s !== prevScenario));
  if (force && SCENARIOS[force]) id = force;
  const S = SCENARIOS[id];
  const region = S.region || 'temperate';
  const terrain = { ...S.terrain };
  terrain.hills = (terrain.hills ?? 14) * rng.range(0.75, 1.3);
  if (terrain.mountains) terrain.mountains *= rng.range(0.8, 1.25);
  terrain.forest = (terrain.forest ?? 0) + rng.range(-0.08, 0.1);
  if (!terrain.kind || terrain.kind === 'temperate' || terrain.kind === 'tropics') terrain.lakes = Math.max(0, (terrain.lakes ?? 0.3) + rng.range(-0.15, 0.2));
  if (terrain.coastAt) terrain.coastAt *= rng.range(0.85, 1.15);
  const place = placeName(rng, region);
  const nouns = S.nouns.filter((n) => !place.toLowerCase().includes(n.toLowerCase()));
  const name = place.includes(' ') ? `The ${place}` : `The ${place} ${rng.pick(nouns.length ? nouns : S.nouns)}`;
  const weather = rng.weighted(S.weathers);
  const autumn = region === 'temperate' && rng.chance(id === 'heath' || id === 'highlands' ? 0.45 : 0.3) ? rng.range(0.35, 1) : 0;
  const pois = [];
  const ahead = rng.range(-0.9, 0.9); // landmarks lie roughly ahead along the road, in the new land
  for (const [type, p] of S.pois) if (rng.chance(p)) {
    pois.push({ type, angle: 0, dist: type === 'find' ? rng.range(110, 240) : rng.range(200, 420), seed: Math.floor(rng.next() * 1e9), name: type === 'find' ? null : placeName(rng, region), specialty: rng.pick(SPECIALTIES) });
  }
  pois.forEach((p, i) => { p.side = (i / Math.max(1, pois.length - 1) - 0.5) * 1.5 + rng.range(-0.25, 0.25) + ahead * 0.25; });
  const main = pois.find((p) => p.type !== 'find');
  const rumors = {
    hamlet: (p) => `Smoke rises from a settlement somewhere ahead — the folk of ${p.name} are said to trade.`,
    ruins: (p) => region === 'tropics' ? `Travellers speak of vine-covered ruins at ${p.name}, swallowed by the forest.` : `An old map marks the ruins of ${p.name} somewhere beyond the road's end.`,
    grotto: (p) => `A shepherd once spoke of a crystal grotto beneath the crags of ${p.name}.`,
    stones: (p) => `Standing stones are said to ring a hilltop at ${p.name}.`,
    cabin: (p) => `A trapper's cabin lies abandoned somewhere out at ${p.name}.`,
    wreck: (p) => `A ship went down off ${p.name} in a storm. Its bones still lie on the sand.`,
    alcove: (p) => `High in the canyon wall at ${p.name} there are said to be old stone dwellings.`,
    carvings: (p) => `Someone carved figures into the rock at ${p.name}, long ago.`,
  };
  return {
    no, seed, scenario: id, region, title: S.title, name, place, weather, autumn,
    terrain, layers: S.layers, mode: S.mode, tints: { ground: S.groundTint, forest: S.forestTint, shore: S.shoreTint }, strata: !!S.strata, sea: !!S.sea,
    eco: { region, ...S.eco }, herds: S.herds || [], fauna: S.fauna || {}, foxes: S.foxes, weathers: S.weathers,
    pois, rumor: main ? rumors[main.type](main) : 'No one you know has walked this land before.',
    blurb: S.blurb,
  };
}
