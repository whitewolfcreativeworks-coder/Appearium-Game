// Appearium knowledge base: real species, real identification features.
// Information is simplified for a game and is NOT a substitute for expert, local identification.
// Never eat a wild mushroom or plant on the strength of a game, a book or an app.

export const SAFETY_NOTE = 'Appearium simplifies real natural history so you can learn the ideas behind safe foraging. ' +
  'It is not a field guide. In real life, never eat any wild mushroom, berry or plant unless an experienced local expert has confirmed it in person. ' +
  'Several deadly species look like edible ones, and poisoning symptoms can be delayed by many hours.';

// status: edible | caution (edible only when cooked / with care) | inedible | toxic | deadly | psychoactive
export const STATUS = {
  edible: { label: 'Edible', color: '#9fc27a' },
  caution: { label: 'Edible with care', color: '#d8c46a' },
  inedible: { label: 'Inedible', color: '#b8a58a' },
  toxic: { label: 'Poisonous', color: '#d88a5a' },
  deadly: { label: 'Deadly poisonous', color: '#e05a4a' },
  psychoactive: { label: 'Poisonous · hallucinogenic', color: '#b98ad8' },
};

// effect: what happens in game when eaten. sick: 0 none, 1 mild, 2 moderate, 3 severe; trip: 0..1; deadly; bitter
// food: satiety value when eaten as intended (cooked where needed); raw: what happens if eaten raw
export const MUSHROOMS = {
  chanterelle: {
    name: 'Chanterelle', latin: 'Cantharellus cibarius', status: 'edible', habitat: 'ground', trees: 'any', value: 3, food: 3,
    raw: { sick: 1 },
    look: { cap: 'Egg-yolk yellow, funnel-shaped with a wavy, inrolled edge', under: 'Blunt, forked ridges (false gills) running down onto the stem', stem: 'Solid, same colour as the cap, tapering downward', flesh: 'Pale, firm, tears into fibres like string cheese', smell: 'Fruity — like apricots', spore: 'Pale cream', grows: 'Singly or scattered on mossy ground in woods — never on wood' },
    facts: 'One of the most prized wild mushrooms. The "gills" are really shallow ridges that fork and merge — the single most important feature separating it from its lookalikes.',
    lookalikes: ['false_chanterelle', 'jack_o_lantern'],
    tell: 'False chanterelle has thin, crowded, true gills and is a darker orange. Jack-o\'-lantern grows in tight clusters from wood and has sharp, true gills.',
  },
  false_chanterelle: {
    name: 'False chanterelle', latin: 'Hygrophoropsis aurantiaca', status: 'toxic', habitat: 'ground', trees: 'conifer', value: 0,
    effect: { sick: 1 },
    look: { cap: 'Orange, often darker in the centre, thin, with an inrolled edge', under: 'Thin, crowded, bright orange true gills that fork repeatedly', stem: 'Thin, orange, often curved', flesh: 'Soft and thin, not fibrous', smell: 'Mushroomy, not fruity', spore: 'White', grows: 'On conifer needle litter and rotting wood' },
    facts: 'Not deadly, but it can upset the stomach. Its true, knife-thin gills are the giveaway — run a finger over them: they feel like the pages of a book, while a chanterelle\'s ridges feel like wrinkles.',
    lookalikes: ['chanterelle'],
    tell: 'True thin gills instead of blunt ridges; softer flesh; no apricot smell.',
  },
  jack_o_lantern: {
    name: 'Jack-o\'-lantern', latin: 'Omphalotus olearius', status: 'toxic', habitat: 'wood', trees: 'broad', value: 0, glow: true,
    effect: { sick: 3 },
    look: { cap: 'Bright pumpkin-orange, smooth, funnel-shaped when old', under: 'Sharp, true, non-forked gills running down the stem', stem: 'Orange, tapering, fused with neighbours at the base', flesh: 'Orange', smell: 'Faint, unpleasant', spore: 'Pale cream to yellow', grows: 'In dense clusters at the base of broadleaf stumps or from buried roots' },
    facts: 'Causes severe vomiting and diarrhoea. Its gills are faintly bioluminescent — in complete darkness fresh specimens glow a ghostly green.',
    lookalikes: ['chanterelle'],
    tell: 'Grows in tight clusters from wood; true sharp gills; chanterelles grow singly from soil.',
  },
  porcini: {
    name: 'Porcini (penny bun)', latin: 'Boletus edulis', status: 'edible', habitat: 'ground', trees: 'any', value: 4, food: 4,
    look: { cap: 'Brown, bun-shaped, slightly greasy, 8–25 cm', under: 'A sponge of pores — white when young, turning yellow then olive. Does not bruise blue', stem: 'Fat, bulbous, pale, with a fine WHITE net pattern near the top', flesh: 'White, unchanging when cut', smell: 'Pleasant, nutty', spore: 'Olive-brown', grows: 'On the ground under spruce, pine, birch and oak' },
    facts: 'A bolete: instead of gills it has a layer of tubes ending in pores. A safe group for beginners in many regions, but a few boletes are toxic (red pores, blue-bruising flesh) and one is horribly bitter.',
    lookalikes: ['bitter_bolete'],
    tell: 'Bitter bolete has pinkish pores and a DARK brown net on its stem; porcini\'s net is white.',
  },
  bitter_bolete: {
    name: 'Bitter bolete', latin: 'Tylopilus felleus', status: 'inedible', habitat: 'ground', trees: 'conifer', value: 0,
    effect: { bitter: true },
    look: { cap: 'Brown, bun-shaped, dry', under: 'Pores white at first, becoming PINK', stem: 'Pale, with a coarse DARK brown net', flesh: 'White, unchanging', smell: 'Mild', spore: 'Pinkish brown', grows: 'On the ground under conifers, often on acidic soil' },
    facts: 'Not poisonous — just so bitter that a single one ruins a whole pan of mushrooms. A classic lesson in looking closely.',
    lookalikes: ['porcini'],
    tell: 'Pinkish pores and a dark net on the stem.',
  },
  hedgehog: {
    name: 'Hedgehog mushroom', latin: 'Hydnum repandum', status: 'edible', habitat: 'ground', trees: 'any', value: 3, food: 3,
    look: { cap: 'Pale buff to apricot, irregular and lumpy', under: 'Soft, hanging SPINES (teeth) instead of gills', stem: 'Whitish, short, often off-centre', flesh: 'Firm, bruises orange', smell: 'Pleasant', spore: 'White to cream', grows: 'On the ground in woods, often in arcs or rings' },
    facts: 'Often recommended as a beginner\'s mushroom because nothing dangerous in Europe has soft spines under a fleshy cap.',
    lookalikes: [],
    tell: 'Spines underneath — check every single one you pick.',
  },
  giant_puffball: {
    name: 'Giant puffball', latin: 'Calvatia gigantea', status: 'caution', habitat: 'grass', trees: 'none', value: 3, food: 4,
    look: { cap: 'A large white ball, 10–80 cm, smooth and leathery, with no stem', under: 'None — slice it in half', stem: 'None; attached by a cord', flesh: 'Must be pure, uniform white like marshmallow all the way through', smell: 'Mild', spore: 'Olive-brown dust when old', grows: 'In grassland, field edges and among nettles' },
    facts: 'Edible only while pure white inside. Always slice top to bottom: if you see the outline of a cap and gills, it is a young Amanita "egg" — potentially deadly. Yellow or olive inside means it is past it.',
    lookalikes: ['earthball', 'death_cap'],
    tell: 'Earthballs have a thick warty rind and are dark purple-black inside; Amanita eggs show a mushroom shape when sliced.',
  },
  earthball: {
    name: 'Common earthball', latin: 'Scleroderma citrinum', status: 'toxic', habitat: 'ground', trees: 'broad', value: 0,
    effect: { sick: 2 },
    look: { cap: 'A yellowish-brown ball, 3–10 cm, with a thick, hard, scaly-cracked rind', under: 'None — slice it in half', stem: 'None; root-like strands at the base', flesh: 'Firm and PURPLE-BLACK, marbled with white', smell: 'Rubbery, metallic', spore: 'Dark brown-black', grows: 'In woods and heaths on acidic soil, often with birch and oak' },
    facts: 'Causes vomiting and sometimes collapse. The dark interior separates it instantly from a white puffball.',
    lookalikes: ['giant_puffball'],
    tell: 'Thick warty rind, dark inside.',
  },
  death_cap: {
    name: 'Death cap', latin: 'Amanita phalloides', status: 'deadly', habitat: 'ground', trees: 'broad', value: 0,
    effect: { deadly: true },
    look: { cap: 'Olive-green to yellowish, sometimes almost white, smooth with fine radial streaks', under: 'White, crowded gills, free from the stem', stem: 'White with a hanging skirt-like RING', flesh: 'White', smell: 'Faint; sickly-sweet when old', spore: 'White', grows: 'On the ground near oak and beech. The base sits in a white sac (VOLVA) — often buried, so dig it up to see' },
    facts: 'Responsible for most mushroom deaths worldwide. Its toxins (amatoxins) are not destroyed by cooking. Symptoms are delayed 6–24 hours, then a false recovery hides fatal liver damage. White gills + ring + volva: the Amanita warning signs.',
    lookalikes: ['giant_puffball', 'parasol'],
    tell: 'Always check the base for a volva and never eat any mushroom with white gills, a ring and a sac at the base.',
  },
  fly_agaric: {
    name: 'Fly agaric', latin: 'Amanita muscaria', status: 'psychoactive', habitat: 'ground', trees: 'conifer', value: 0,
    effect: { sick: 2, trip: 1 },
    look: { cap: 'Scarlet with white wart-like flakes (rain can wash them off)', under: 'White, free gills', stem: 'White with a ring; bulbous base wrapped in rings of white scales', flesh: 'White, yellowish under the cap skin', smell: 'Faint', spore: 'White', grows: 'On the ground with birch and pine' },
    facts: 'The fairy-tale toadstool. Its toxins (ibotenic acid and muscimol) cause nausea, confusion, delirium and distorted perception. Rarely fatal, but genuinely dangerous.',
    lookalikes: [],
    tell: 'Unmistakable when fresh — but the red can fade and the warts wash off.',
  },
  liberty_cap: {
    name: 'Liberty cap', latin: 'Psilocybe semilanceata', status: 'psychoactive', habitat: 'grass', trees: 'none', value: 0,
    effect: { trip: 1 },
    look: { cap: 'Tiny (0.5–2.5 cm), conical with a pointed nipple, tan to yellowish-brown, slimy when wet', under: 'Gills turning dark purple-brown', stem: 'Thin, pale, wavy', flesh: 'Thin', smell: 'Mild', spore: 'Dark purple-brown', grows: 'In grassy pastures and lawns in autumn' },
    facts: 'Contains psilocybin, causing hallucinations. Possessing it is illegal in many countries. Several deadly "little brown mushrooms" (such as Conocybe and Galerina) look similar, which is why experts never eat small brown mushrooms.',
    lookalikes: [],
    tell: 'Expert-only. Treat all little brown mushrooms as dangerous.',
  },
  parasol: {
    name: 'Parasol', latin: 'Macrolepiota procera', status: 'edible', habitat: 'grass', trees: 'none', value: 3, food: 4,
    look: { cap: 'Large (10–30 cm), pale with brown scales and a dark central boss', under: 'White, free gills', stem: 'Tall with snakeskin-like brown banding and a thick DOUBLE ring that slides up and down', flesh: 'White', smell: 'Pleasant', spore: 'White', grows: 'In grassland and woodland clearings — the base is bulbous with NO sac' },
    facts: 'A good edible, but small lookalikes in the Lepiota group are deadly. Foragers only take large specimens (cap over 15 cm) with a snakeskin stem and a movable ring.',
    lookalikes: ['death_cap'],
    tell: 'Movable double ring, snakeskin stem, no volva, large size.',
  },
  shaggy_inkcap: {
    name: 'Shaggy ink cap', latin: 'Coprinus comatus', status: 'edible', habitat: 'grass', trees: 'none', value: 2, food: 2,
    look: { cap: 'Tall, white, cylindrical, covered in shaggy scales', under: 'Gills white when young, then pink, then dissolving into black ink', stem: 'White, hollow, with a loose ring low down', flesh: 'White', smell: 'Mild', spore: 'Black', grows: 'On disturbed ground, lawns and roadsides' },
    facts: 'Edible only while the gills are still white — within hours it digests itself into black ink. Avoid alcohol with the related common ink cap.',
    lookalikes: [],
    tell: 'Eat only young, white-gilled specimens.',
  },
  chicken_of_the_woods: {
    name: 'Chicken of the woods', latin: 'Laetiporus sulphureus', status: 'caution', habitat: 'tree', trees: 'broad', value: 3, food: 4,
    raw: { sick: 2 },
    look: { cap: 'Bright sulphur-yellow and orange overlapping brackets', under: 'Tiny yellow pores', stem: 'None — grows straight from the trunk', flesh: 'Soft and moist when young, chalky when old', smell: 'Mushroomy', spore: 'White', grows: 'On living or dead broadleaf trees, especially oak and willow' },
    facts: 'Must be cooked well; some people react even then. Never take it from yew trees, which are poisonous.',
    lookalikes: [],
    tell: 'Bright shelves on trees; cook thoroughly.',
  },
  sulphur_tuft: {
    name: 'Sulphur tuft', latin: 'Hypholoma fasciculare', status: 'toxic', habitat: 'wood', trees: 'any', value: 0,
    effect: { sick: 2 },
    look: { cap: 'Sulphur-yellow with an orange-brown centre, 2–7 cm', under: 'Gills sulphur-yellow, then GREENISH, then dark purple-brown', stem: 'Yellow, thin, curved', flesh: 'Yellow, very bitter', smell: 'Mushroomy', spore: 'Purple-brown', grows: 'In dense tufts on dead wood and stumps' },
    facts: 'One of the commonest woodland mushrooms — and poisonous. The greenish tint to the gills is the key clue.',
    lookalikes: ['honey_fungus'],
    tell: 'Greenish-yellow gills; honey fungus has whitish gills and a ring.',
  },
  honey_fungus: {
    name: 'Honey fungus', latin: 'Armillaria mellea', status: 'caution', habitat: 'wood', trees: 'any', value: 2, food: 2,
    raw: { sick: 2 },
    look: { cap: 'Honey-brown with fine dark scales near the centre', under: 'Whitish to cream gills', stem: 'With a whitish, cottony RING', flesh: 'White', smell: 'Strong, mushroomy', spore: 'White', grows: 'In large clusters on stumps and tree roots' },
    facts: 'Edible only when thoroughly cooked, and it disagrees with some people. Its black bootlace-like strands spread underground and kill trees.',
    lookalikes: ['sulphur_tuft'],
    tell: 'Whitish gills and a ring.',
  },
};

export const PLANTS = {
  bilberry: { name: 'Bilberry', latin: 'Vaccinium myrtillus', kind: 'berry', status: 'edible', value: 1, food: 1, rawFood: 1,
    look: { plant: 'Low shrub 20–50 cm with green angular stems and small toothed leaves', fruit: 'Single dark blue-black berries with a dusty bloom and a crown-like ring at the tip; purple flesh', grows: 'Heaths and conifer woods' },
    facts: 'Wild European blueberry — stains your fingers and tongue purple.', lookalikes: ['deadly_nightshade'], tell: 'Low shrub, dusty berries with a crown; nightshade is a tall herb with glossy berries in a green star.' },
  lingonberry: { name: 'Lingonberry', latin: 'Vaccinium vitis-idaea', kind: 'berry', status: 'edible', value: 1, food: 1, rawFood: 1,
    look: { plant: 'Low evergreen shrub with glossy, leathery, oval leaves', fruit: 'Red berries in small clusters at the stem tips', grows: 'Dry conifer forest and heath' },
    facts: 'Tart raw; superb cooked. Contains natural preservatives so it keeps for months.', lookalikes: ['bittersweet'], tell: 'Bittersweet berries are oval, hang in drooping clusters from a climbing vine.' },
  cloudberry: { name: 'Cloudberry', latin: 'Rubus chamaemorus', kind: 'berry', status: 'edible', value: 3, food: 1, rawFood: 1,
    look: { plant: 'Low plant with round, lobed leaves', fruit: 'A single amber, raspberry-like berry', grows: 'Bogs and wet moorland' },
    facts: 'A northern treasure, rich in vitamin C.', lookalikes: [], tell: '' },
  raspberry: { name: 'Wild raspberry', latin: 'Rubus idaeus', kind: 'berry', status: 'edible', value: 1, food: 1, rawFood: 1,
    look: { plant: 'Prickly upright canes with leaves pale-silvery underneath', fruit: 'Red, hollow berries that pull cleanly off a white core', grows: 'Clearings and woodland edges' },
    facts: 'Raspberry-leaf tea is a traditional remedy.', lookalikes: [], tell: '' },
  deadly_nightshade: { name: 'Deadly nightshade', latin: 'Atropa belladonna', kind: 'berry', status: 'deadly', value: 0, effect: { deadly: true, sick: 3 },
    look: { plant: 'A tall, bushy herb 0.5–2 m with large soft leaves and dull purple bell flowers', fruit: 'Single SHINY black berries, cherry-sized, sitting in a green five-pointed STAR', grows: 'Woodland edges and disturbed ground, often on chalk' },
    facts: 'Every part is highly poisonous. A few berries can kill a child. Causes dilated pupils, racing heart, delirium.', lookalikes: ['bilberry'], tell: 'Tall plant, glossy berry, star-shaped calyx.' },
  bittersweet: { name: 'Bittersweet nightshade', latin: 'Solanum dulcamara', kind: 'berry', status: 'toxic', value: 0, effect: { sick: 2 },
    look: { plant: 'A scrambling, climbing vine with purple star flowers with yellow centres', fruit: 'Glossy, oval red berries hanging in drooping clusters', grows: 'Damp hedges and riverbanks' },
    facts: 'Poisonous, especially unripe. Children are attracted to the bright berries.', lookalikes: ['lingonberry'], tell: 'Oval berries in drooping clusters on a vine.' },
  nettle: { name: 'Stinging nettle', latin: 'Urtica dioica', kind: 'green', status: 'caution', value: 1, food: 1, raw: { sting: true },
    look: { plant: 'Upright, with toothed heart-shaped leaves covered in stinging hairs', fruit: 'Hanging green flower strings', grows: 'Rich soil near water and old settlements' },
    facts: 'Pick the young tops (with gloves!). Blanching removes the sting. The stems give strong fibre for cord.', lookalikes: [], tell: '' },
  ramsons: { name: 'Wild garlic (ramsons)', latin: 'Allium ursinum', kind: 'green', status: 'edible', value: 2, food: 1, rawFood: 1,
    look: { plant: 'Broad, soft, lance-shaped leaves, EACH ON ITS OWN STALK from the ground', fruit: 'White star flowers in a round head', grows: 'Damp, shady broadleaf woods' },
    facts: 'Smells strongly of garlic when crushed. But beware: the smell lingers on your fingers, so test each leaf, not the handful.', lookalikes: ['lily_of_the_valley'], tell: 'Single leaves on separate stalks and a garlic smell.' },
  lily_of_the_valley: { name: 'Lily of the valley', latin: 'Convallaria majalis', kind: 'green', status: 'toxic', value: 0, effect: { sick: 3 },
    look: { plant: 'Leaves in PAIRS wrapped around a single stem sheath; no garlic smell', fruit: 'Nodding white bell flowers, later red berries', grows: 'Dry broadleaf woods' },
    facts: 'Contains heart toxins. Every spring people mistake it for wild garlic.', lookalikes: ['ramsons'], tell: 'Paired leaves sharing a stem, no garlic smell.' },
  wood_sorrel: { name: 'Wood sorrel', latin: 'Oxalis acetosella', kind: 'green', status: 'caution', value: 1, food: 1, rawFood: 1,
    look: { plant: 'Clover-like, three heart-shaped leaflets that fold at night', fruit: 'Small white flowers veined with purple', grows: 'Shady woods' },
    facts: 'Lemony and refreshing in small amounts; large amounts are unwise because of its oxalic acid.', lookalikes: [], tell: '' },
  dandelion: { name: 'Dandelion', latin: 'Taraxacum officinale', kind: 'green', status: 'edible', value: 1, food: 1, rawFood: 1,
    look: { plant: 'Rosette of deeply toothed leaves; hollow stem with milky sap', fruit: 'Yellow flower, then a clock of seeds', grows: 'Almost anywhere sunny' },
    facts: 'Every part is edible: leaves for salad, roots for "coffee", flowers for wine.', lookalikes: [], tell: '' },
  celandine: { name: 'Lesser celandine', latin: 'Ficaria verna', kind: 'green', status: 'toxic', value: 0, effect: { sick: 1 },
    look: { plant: 'Glossy, heart-shaped leaves', fruit: 'Shiny yellow star-like flowers', grows: 'Damp woods and banks in early spring' },
    facts: 'Irritant when raw. Once used as a folk remedy — hence its old name, pilewort.', lookalikes: [], tell: '' },
};

// ------------------------------------------------------------------ fish
// water: river (flowing), lake (still deep), pond (still shallow, weedy). time: dawn, day, dusk, night
export const FISH = {
  trout: { name: 'Brown trout', latin: 'Salmo trutta', size: [20, 60], strength: 0.8, jumps: true, water: { river: 3, lake: 1 }, spots: { riffle: 2, pool: 1.5 }, time: { dawn: 2, day: 0.7, dusk: 2, night: 0.3 }, weather: { overcast: 1.5, rain: 1.6, mist: 1.2 }, bait: { worm: 1, fly: 1.6, spinner: 1.2, grub: 0.8 }, value: 4, food: 3,
    look: 'Golden-brown flanks with black and red spots, often with pale halos', facts: 'Needs cold, clean, oxygen-rich water — a sign of a healthy river. Rises to take insects from the surface at dawn and dusk.' },
  grayling: { name: 'Grayling', latin: 'Thymallus thymallus', size: [20, 45], strength: 0.6, water: { river: 3 }, spots: { riffle: 2 }, time: { dawn: 1, day: 1.2, dusk: 1, night: 0.2 }, weather: {}, bait: { fly: 1.6, grub: 1.2, worm: 1 }, value: 4, food: 3,
    look: 'Silver-grey with a huge sail-like dorsal fin edged in red', facts: 'Called "the lady of the stream". Fresh grayling are said to smell faintly of thyme.' },
  salmon: { name: 'Atlantic salmon', latin: 'Salmo salar', size: [55, 105], strength: 1.6, jumps: true, rare: true, water: { river: 1 }, spots: { pool: 2 }, time: { dawn: 1.5, day: 0.6, dusk: 1.5, night: 0.4 }, weather: { rain: 2, overcast: 1.4 }, bait: { spinner: 1.5, fly: 1.4 }, value: 12, food: 6,
    look: 'Bright silver with a few black X-shaped spots, forked tail', facts: 'Born in rivers, grows at sea, returns to its home river to spawn. It barely feeds in freshwater, yet will strike a lure or fly out of instinct. Rain-raised rivers bring fresh fish up.' },
  char: { name: 'Arctic char', latin: 'Salvelinus alpinus', size: [25, 60], strength: 0.9, water: { lake: 2 }, spots: { deep: 2 }, time: { dawn: 1.4, day: 0.8, dusk: 1.4, night: 0.4 }, weather: { overcast: 1.2 }, bait: { spinner: 1.4, worm: 1, minnow: 1.2 }, value: 6, food: 4, cold: true,
    look: 'Dark back, pale spots, and a blazing red-orange belly in spawning colours', facts: 'A relic of the Ice Age, surviving in deep, cold lakes.' },
  perch: { name: 'Perch', latin: 'Perca fluviatilis', size: [15, 42], strength: 0.6, water: { lake: 2, pond: 1.5, river: 0.8 }, spots: { weeds: 1.5, shore: 1 }, time: { dawn: 1, day: 1.4, dusk: 1, night: 0.2 }, weather: {}, bait: { worm: 1.6, minnow: 1.4, spinner: 1.3, grub: 1 }, value: 3, food: 3,
    look: 'Green with 5–9 dark vertical bars, red-orange lower fins, a spiny dorsal fin', facts: 'Hunts in packs. Mind the spines on the dorsal fin when handling.' },
  pike: { name: 'Pike', latin: 'Esox lucius', size: [45, 115], strength: 1.4, water: { lake: 2, pond: 1.5, river: 0.7 }, spots: { weeds: 2.2, lilies: 2 }, time: { dawn: 1.4, day: 1, dusk: 1.3, night: 0.3 }, weather: { overcast: 1.3 }, bait: { minnow: 2, spinner: 1.6 }, value: 6, food: 5, teeth: true,
    look: 'Long olive body with pale bean-shaped spots, a duck-bill snout full of teeth', facts: 'An ambush predator that lurks motionless among weeds, then strikes in a burst.' },
  zander: { name: 'Zander', latin: 'Sander lucioperca', size: [40, 85], strength: 1.1, water: { lake: 1.5, river: 0.7 }, spots: { deep: 1.5 }, time: { dawn: 0.8, day: 0.3, dusk: 2, night: 1.8 }, weather: { overcast: 1.3, rain: 1.2 }, bait: { minnow: 1.8, spinner: 1.2 }, value: 6, food: 5,
    look: 'Grey-green with dark saddle bands, glassy reflective eyes, prominent fangs', facts: 'Its large reflective eyes let it hunt in dim, murky water — fish for it at dusk.' },
  roach: { name: 'Roach', latin: 'Rutilus rutilus', size: [10, 32], strength: 0.35, small: true, water: { lake: 2, pond: 2, river: 1.5 }, spots: { shore: 1.5, weeds: 1 }, time: { dawn: 1, day: 1.3, dusk: 1, night: 0.3 }, weather: {}, bait: { worm: 1.4, grub: 1.6 }, value: 1, food: 1, bait_fish: true,
    look: 'Silver with a blue sheen, bright RED eyes and orange-red fins', facts: 'One of the commonest fish in still and slow water — and a favourite meal of pike and herons.' },
  rudd: { name: 'Rudd', latin: 'Scardinius erythrophthalmus', size: [12, 32], strength: 0.4, small: true, water: { pond: 2, lake: 1 }, spots: { lilies: 2, weeds: 1.4 }, time: { dawn: 0.8, day: 1.5, dusk: 1, night: 0.2 }, weather: { clear: 1.3 }, bait: { fly: 1.5, grub: 1.4 }, value: 2, food: 1, bait_fish: true,
    look: 'Golden flanks, blood-red fins, an upturned mouth', facts: 'Its upturned mouth is built for feeding at the surface on warm days.' },
  bream: { name: 'Common bream', latin: 'Abramis brama', size: [30, 65], strength: 0.7, water: { lake: 2, river: 0.6 }, spots: { deep: 1.4, shore: 1 }, time: { dawn: 1.4, day: 0.8, dusk: 1.4, night: 1.0 }, weather: { overcast: 1.2 }, bait: { worm: 1.5, grub: 1.4 }, value: 3, food: 3,
    look: 'Deep, flat bronze body, slimy, with a protrusible mouth', facts: 'Feeds in large shoals, grubbing in the mud — bubbles on the surface give them away.' },
  tench: { name: 'Tench', latin: 'Tinca tinca', size: [20, 55], strength: 0.9, water: { pond: 2.5, lake: 1 }, spots: { lilies: 2, weeds: 1.5 }, time: { dawn: 2, day: 0.6, dusk: 1.2, night: 0.6 }, weather: { mist: 1.3 }, bait: { worm: 1.8, grub: 1.2 }, value: 3, food: 3,
    look: 'Olive-green with tiny scales, small red eyes, very slimy', facts: 'Nicknamed "the doctor fish" from a legend that its slime healed other fish.' },
  carp: { name: 'Common carp', latin: 'Cyprinus carpio', size: [35, 85], strength: 1.5, water: { pond: 2, lake: 1.2 }, spots: { lilies: 1.5, shore: 1 }, time: { dawn: 1.6, day: 0.8, dusk: 1.4, night: 1 }, weather: { clear: 1.1 }, bait: { grub: 1.6, worm: 1.2 }, value: 5, food: 4,
    look: 'Bronze, heavy-bodied, with two pairs of barbels at the mouth', facts: 'Introduced across Europe by monks for fish ponds. Famous for long, powerful runs.' },
  eel: { name: 'European eel', latin: 'Anguilla anguilla', size: [40, 90], strength: 1.0, endangered: true, water: { river: 1, pond: 1, lake: 1 }, spots: { deep: 1.2, pool: 1.2 }, time: { dawn: 0.4, day: 0.15, dusk: 1.5, night: 3 }, weather: { rain: 1.5 }, bait: { worm: 1.6, minnow: 1.2 }, value: 4, food: 4,
    look: 'Snake-like, olive above and yellow or silver below, with a continuous fin', facts: 'Critically endangered. Every European eel is born in the Sargasso Sea and drifts thousands of kilometres to reach rivers. Anglers are asked to release them.' },
  burbot: { name: 'Burbot', latin: 'Lota lota', size: [30, 65], strength: 0.9, water: { lake: 1.5, river: 1 }, spots: { deep: 1.5 }, time: { dawn: 0.5, day: 0.2, dusk: 1.4, night: 2.5 }, weather: {}, bait: { minnow: 1.5, worm: 1.4 }, value: 4, food: 4, cold: true,
    look: 'Mottled brown, eel-like tail, a single barbel on the chin', facts: 'The only freshwater member of the cod family. Hunts at night in cold water.' },
};

export const BAIT = {
  worm: { name: 'Earthworms', desc: 'Dug from damp soil. Almost every fish will take a worm.', consumable: true },
  grub: { name: 'Grubs', desc: 'Beetle larvae from rotting logs. Loved by bottom feeders.', consumable: true },
  minnow: { name: 'Minnow', desc: 'A small live-bait fish. Predators can\'t resist it.', consumable: true },
  fly: { name: 'Hand-tied fly', desc: 'Feather and fibre tied to imitate an insect. Reusable.', consumable: false },
  spinner: { name: 'Copper spinner', desc: 'A flashing metal lure for predators. Reusable.', consumable: false },
};

// ------------------------------------------------------------------ animals & tracks
export const ANIMALS = {
  fox: { name: 'Red fox', latin: 'Vulpes vulpes', track: 'Oval print ~5 cm, four toes, an X-shaped gap between the pads; walks in a neat straight line', facts: 'Mainly active at dawn and dusk; hunts voles by listening, then pouncing.' },
  hare: { name: 'European hare', latin: 'Lepus europaeus', track: 'Groups of four: two long hind prints land IN FRONT of two small front prints, in a Y or triangle', facts: 'Can reach 70 km/h. Rests in a shallow scrape called a "form" and keeps to well-worn runs — where snares are set.' },
  squirrel: { name: 'Red squirrel', latin: 'Sciurus vulgaris', track: 'Paired hind prints ahead of small front prints, trail starting and ending at trees', facts: 'Buries nuts and forgets many — planting future forests.' },
  roe_deer: { name: 'Roe deer', latin: 'Capreolus capreolus', track: 'Small heart-shaped cloven "slots", 4–5 cm', facts: 'Shy and mostly seen at dawn and dusk at woodland edges.' },
  stork: { name: 'White stork', latin: 'Ciconia ciconia', facts: 'Wades through wet meadows hunting frogs; soars on thermals without flapping.' },
  mallard: { name: 'Mallard', latin: 'Anas platyrhynchos', facts: 'The drake has a glossy green head; the brown female does the quacking.' },
  robin: { name: 'European robin', latin: 'Erithacus rubecula', facts: 'Follows people digging, hoping for worms.' },
  blackbird: { name: 'Blackbird', latin: 'Turdus merula', facts: 'Flicks through leaf litter for food; its fluting song fills spring evenings.' },
  chaffinch: { name: 'Chaffinch', latin: 'Fringilla coelebs', facts: 'One of Europe\'s commonest birds; white wing bars flash as it flies.' },
  woodpecker: { name: 'Great spotted woodpecker', latin: 'Dendrocopos major', facts: 'Drums on dead branches to claim territory — up to 20 strikes per second.' },
  peacock_butterfly: { name: 'Peacock butterfly', latin: 'Aglais io', facts: 'Its eye-spots startle birds; it hibernates through winter.' },
  brimstone: { name: 'Brimstone', latin: 'Gonepteryx rhamni', facts: 'The original "butter-coloured fly" that may have given butterflies their name.' },
  dragonfly: { name: 'Emperor dragonfly', latin: 'Anax imperator', facts: 'Catches insects in mid-air; it can fly backwards.' },
};

// ------------------------------------------------------------------ bushcraft lessons
export const TRAPS = {
  snare: {
    name: 'Snare', needs: { fibre: 1, wood: 1 }, catches: 'hare',
    where: 'Across a hare run — a narrow trail worn through grass, with tracks and droppings.',
    steps: [
      ['Find a run', 'Look for a narrow trail worn through grass or a gap in undergrowth, with hare tracks or round droppings. Hares use the same runs every night.'],
      ['Make a running noose', 'Twist plant fibre into strong cord. Tie a small fixed loop at one end and pass the cord through it to make a noose that tightens when pulled.'],
      ['Size the loop', 'Open the noose to about a fist\'s width (10–12 cm).'],
      ['Set the height', 'Hang the loop across the run with its bottom edge about a hand\'s width (10 cm) above the ground — head height for a running hare.'],
      ['Anchor it', 'Tie the free end to a stake driven firmly into the ground, or to a sturdy sapling.'],
      ['Leave it be', 'Touch the run as little as possible and come back later. Check traps often.'],
    ],
    note: 'Snares are illegal or strictly regulated in many countries. This is a game lesson about traditional technique, not advice to set real snares.',
  },
  deadfall: {
    name: 'Figure-4 deadfall', needs: { wood: 2, stone: 1 }, catches: 'squirrel',
    where: 'In woodland near broadleaf trees where squirrels feed. Bait it.',
    steps: [
      ['Cut three sticks', 'An upright post, a diagonal lever and a horizontal trigger, each about forearm length.'],
      ['Carve the notches', 'Flatten the top of the upright to a chisel point. Notch the lever near one end, and the trigger so it catches on the upright.'],
      ['Assemble the "4"', 'Stand the upright, lay the trigger across it, and rest the lever on the upright\'s point with its notch locked onto the trigger — together they form a figure 4.'],
      ['Add the weight', 'Lean a heavy flat stone on the long end of the lever. The tension holds the trigger in place.'],
      ['Bait the trigger', 'Put bait (berries, nuts) on the trigger end. When it is disturbed the sticks collapse and the stone falls.'],
    ],
    note: 'Deadfalls are dangerous to set and are illegal for hunting in many places.',
  },
  fishtrap: {
    name: 'Fish basket trap', needs: { wood: 3, fibre: 2 }, catches: 'water',
    where: 'In shallow, gently flowing water near the bank, weighted with stones.',
    steps: [
      ['Weave the basket', 'Bend long flexible withies (willow or hazel) into rings and weave a long basket, closed at the far end.'],
      ['Weave the funnel', 'Make a cone that narrows to a hand-sized hole and push it into the open end, point inward.'],
      ['Bait it', 'Put worms or fish scraps inside.'],
      ['Set it', 'Lay it in slow current near the bank with the mouth facing downstream, so fish moving upstream swim in. Weigh it down with stones.'],
      ['Wait', 'Fish and crayfish find the way in easily but rarely the way out. Check it later.'],
    ],
    note: 'Fish traps are regulated or banned in many waters.',
  },
};

export const KNOWLEDGE_TO_RECOGNISE = 2; // correct identifications before you recognise a species at a glance
