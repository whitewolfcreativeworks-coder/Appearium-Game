// More of the wild, each where it belongs and behaving the way it really does:
//   mountain lion — rarely seen; watches from high ground, stalks a back that is turned, and
//     backs down from someone who faces it and stands tall (running invites a chase);
//   wolves — a pack trotting single file far off, keeping its distance; howls at night;
//   coyotes — a pair loping across canyon country;
//   moose — wades the shallows to feed; calm until you crowd it, then ears back and a charge;
//   elk — herds in high meadows, bulls bugling at dawn and dusk;
//   wild boar — a sow and her striped piglets rooting in the woods; get between them and she charges;
//   mountain goats and bighorn sheep — picking along cliffs where nothing else can follow;
//   capybara — lounging in family groups by tropical water, slipping in when alarmed;
//   coatis — a troop trotting through the jungle, tails held high;
//   otters — swimming, rolling and diving in rivers, lakes and coves.
import * as THREE from 'three';
import { Rig, vc, merge, deerGeometry } from './fauna.js';
import { smoothstep } from '../core/rng.js';
import { ANIMALS } from '../data/species.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const S = (r, w, h) => new THREE.SphereGeometry(r, w || 10, h || 7);
const Cyl = (a, b, l, n = 7) => new THREE.CylinderGeometry(a, b, l, n);
function tube(points, r, col, rEnd = r) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => V3(...p)));
  const g = new THREE.TubeGeometry(c, 12, r, 6, false);
  // taper towards the tip
  const pos = g.attributes.position, n = pos.count, segs = 13, ring = 7;
  for (let i = 0; i < n; i++) { const k = Math.floor(i / ring) / (segs - 1); const cp = c.getPointAt(Math.min(1, k)); const f = 1 + (rEnd / r - 1) * k; pos.setXYZ(i, cp.x + (pos.getX(i) - cp.x) * f, cp.y + (pos.getY(i) - cp.y) * f, cp.z + (pos.getZ(i) - cp.z) * f); }
  return vc(g, col);
}

// ------------------------------------------------------------------ bodies (head towards +z; white = coat colour)
function catGeometry() { // mountain lion: long, low, small head, heavy tail
  const c = '#ffffff', pale = '#f4eadc', dark = '#3a2a20';
  return {
    body: merge([
      vc(S(0.2, 12, 9).scale(0.95, 1.0, 2.7).translate(0, 0.62, 0), c),
      vc(S(0.21).translate(0, 0.64, 0.32), c), vc(S(0.2).translate(0, 0.64, -0.36), c),
      vc(S(0.15).scale(1, 0.6, 2.2).translate(0, 0.5, 0), pale),
      tube([[0, 0.66, -0.5], [0, 0.5, -0.8], [0, 0.32, -1.1], [0, 0.3, -1.3], [0, 0.4, -1.45]], 0.05, c, 0.04),
      vc(S(0.05, 6, 4).translate(0, 0.42, -1.47), dark),
    ]),
    neck: merge([
      vc(Cyl(0.09, 0.13, 0.28).rotateX(1.0).translate(0, 0.04, 0.08), c),
      vc(S(0.12, 10, 8).scale(1, 0.9, 1.05).translate(0, 0.11, 0.24), c),
      vc(S(0.065, 8, 6).scale(1, 0.85, 1).translate(0, 0.07, 0.34), pale),
      vc(S(0.02, 5, 4).translate(0, 0.1, 0.4), '#2a1c18'),
      ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.04, 0.07, 5).translate(sd * 0.07, 0.22, 0.2), c)),
      ...[-1, 1].map((sd) => vc(S(0.016, 5, 4).translate(sd * 0.045, 0.14, 0.34), '#1a1410')),
    ]),
    antlers: null,
    leg: merge([vc(Cyl(0.055, 0.04, 0.32).translate(0, -0.15, 0), c), vc(Cyl(0.035, 0.035, 0.24).translate(0, -0.42, 0), c), vc(S(0.05, 6, 4).scale(1, 0.6, 1.2).translate(0, -0.55, 0.02), c)]),
    hips: [[0.1, 0.58, 0.36], [-0.1, 0.58, 0.36], [0.1, 0.58, -0.38], [-0.1, 0.58, -0.38]],
    neckAt: [0, 0.7, 0.46],
  };
}
function canidGeometry() { // wolf / coyote
  const c = '#ffffff', pale = '#efe6da', dark = '#2a2622';
  return {
    body: merge([
      vc(S(0.19, 12, 9).scale(0.85, 1, 2.3).translate(0, 0.7, 0), c),
      vc(S(0.21).translate(0, 0.73, 0.28), c), vc(S(0.16).scale(1, 0.7, 1.4).translate(0, 0.6, 0.15), pale),
      tube([[0, 0.72, -0.4], [0, 0.6, -0.6], [0, 0.45, -0.78], [0, 0.4, -0.88]], 0.07, c, 0.05),
      vc(S(0.05, 6, 4).translate(0, 0.4, -0.9), dark),
    ]),
    neck: merge([
      vc(Cyl(0.08, 0.13, 0.3).rotateX(0.8).translate(0, 0.08, 0.08), c),
      vc(S(0.11, 9, 7).translate(0, 0.16, 0.24), c),
      vc(new THREE.ConeGeometry(0.06, 0.2, 7).rotateX(Math.PI / 2).translate(0, 0.12, 0.4), pale),
      vc(S(0.022, 5, 4).translate(0, 0.13, 0.5), '#141210'),
      ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.04, 0.12, 4).translate(sd * 0.06, 0.29, 0.2), c)),
    ]),
    antlers: null,
    leg: merge([vc(Cyl(0.05, 0.03, 0.36).translate(0, -0.17, 0), c), vc(Cyl(0.025, 0.025, 0.3).translate(0, -0.48, 0), c), vc(S(0.035, 6, 4).scale(1, 0.6, 1.3).translate(0, -0.64, 0.02), c)]),
    hips: [[0.09, 0.66, 0.3], [-0.09, 0.66, 0.3], [0.09, 0.66, -0.32], [-0.09, 0.66, -0.32]],
    neckAt: [0, 0.8, 0.42],
  };
}
function mooseGeometry() { // tall, humped, long-nosed; palmate antlers on bulls
  const c = '#ffffff', leg = '#c8bcae';
  return {
    body: merge([
      vc(S(0.42, 14, 10).scale(0.8, 0.95, 1.9).translate(0, 1.55, 0), c),
      vc(S(0.4).translate(0, 1.72, 0.45), c), vc(S(0.36).translate(0, 1.55, -0.5), c),
      vc(new THREE.ConeGeometry(0.06, 0.15, 5).rotateX(Math.PI).translate(0, 1.46, -0.85), c),
    ]),
    neck: merge([
      vc(Cyl(0.16, 0.24, 0.5).rotateX(1.15).translate(0, 0.0, 0.18), c),
      vc(S(0.15, 9, 7).scale(1, 1.1, 1.3).translate(0, 0.02, 0.42), c),
      vc(Cyl(0.11, 0.14, 0.42).rotateX(Math.PI / 2 + 0.25).translate(0, -0.06, 0.66), c), // long muzzle
      vc(S(0.12, 8, 6).scale(1, 0.9, 1).translate(0, -0.1, 0.86), c),                    // overhanging nose
      vc(Cyl(0.04, 0.02, 0.3).translate(0, -0.3, 0.38), c),                              // the "bell"
      ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.06, 0.2, 5).rotateZ(sd * 1.0).translate(sd * 0.19, 0.16, 0.3), c)),
    ]),
    antlers: merge([-1, 1].flatMap((sd) => [
      vc(Cyl(0.03, 0.035, 0.28, 5).rotateZ(sd * 1.2).translate(sd * 0.22, 0.24, 0.28), '#c8b896'),
      vc(new THREE.BoxGeometry(0.55, 0.05, 0.36).rotateZ(sd * 0.3).translate(sd * 0.55, 0.36, 0.28), '#c8b896'),
      ...[0, 1, 2, 3].map((k) => vc(new THREE.ConeGeometry(0.03, 0.18, 4).rotateZ(sd * 0.2).translate(sd * (0.4 + k * 0.1), 0.48 + k * 0.03, 0.15 + k * 0.08), '#d8ccb0')),
    ])),
    leg: merge([vc(Cyl(0.09, 0.06, 0.6).translate(0, -0.28, 0), leg), vc(Cyl(0.045, 0.045, 0.72).translate(0, -0.92, 0), leg), vc(Cyl(0.05, 0.06, 0.1, 5).translate(0, -1.32, 0), '#3a3028')]),
    hips: [[0.22, 1.36, 0.5], [-0.22, 1.36, 0.5], [0.22, 1.36, -0.55], [-0.22, 1.36, -0.55]],
    neckAt: [0, 1.8, 0.72],
  };
}
function elkGeometry() { // a big deer with a dark mane and pale rump; wide many-tined antlers
  const d = deerGeometry(), c = '#ffffff';
  d.body = merge([
    vc(S(0.27, 12, 9).scale(0.85, 1.0, 2.1).translate(0, 0.98, 0), c), vc(S(0.23).translate(0, 1.0, 0.42), '#b8a898'),
    vc(S(0.24).translate(0, 1.02, -0.42), c), vc(S(0.2, 8, 6).scale(1, 0.85, 0.7).translate(0, 1.0, -0.6), '#ffffff'),
  ]);
  d.neck = merge([
    vc(Cyl(0.1, 0.17, 0.6).translate(0, 0.3, 0).rotateX(0.35), '#7a6a5a'),
    vc(Cyl(0.06, 0.11, 0.4).rotateX(Math.PI / 2 + 0.6).translate(0, 0.58, 0.3), '#8a7868'),
    vc(S(0.05, 6, 4).translate(0, 0.45, 0.49), '#1a1614'),
    ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.05, 0.18, 4).scale(1, 1, 0.4).rotateZ(sd * 0.6).translate(sd * 0.1, 0.72, 0.18), '#8a7868')),
  ]);
  d.antlers = merge([-1, 1].flatMap((sd) => [
    tube([[sd * 0.08, 0.74, 0.18], [sd * 0.25, 1.0, 0.05], [sd * 0.36, 1.3, -0.15], [sd * 0.34, 1.55, -0.3]], 0.038, '#d8ccb4', 0.016),
    ...[0.85, 1.05, 1.25, 1.42].map((y, k) => vc(new THREE.ConeGeometry(0.022, 0.3 - k * 0.03, 4).rotateX(0.9 - k * 0.2).translate(sd * (0.18 + k * 0.05), y, 0.12 - k * 0.12), '#e0d6c0')),
  ]));
  return d;
}
function boarGeometry() { // wedge-shaped: heavy shoulders, long snout, short legs
  const c = '#ffffff', dark = '#2a221c';
  return {
    body: merge([
      vc(S(0.28, 12, 9).scale(0.8, 1.0, 1.7).translate(0, 0.5, 0), c), vc(S(0.27).scale(0.9, 1.15, 1).translate(0, 0.56, 0.28), c),
      vc(new THREE.BoxGeometry(0.06, 0.12, 0.6).translate(0, 0.84, 0.15), dark), // bristly mane
      vc(Cyl(0.012, 0.01, 0.22, 4).rotateX(0.3).translate(0, 0.42, -0.52), c),
    ]),
    neck: merge([
      vc(new THREE.ConeGeometry(0.2, 0.5, 8).rotateX(Math.PI / 2).translate(0, -0.04, 0.2), c),
      vc(Cyl(0.06, 0.06, 0.05, 8).rotateX(Math.PI / 2).translate(0, -0.06, 0.46), '#6a5248'),
      ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.012, 0.07, 4).rotateZ(sd * -0.6).translate(sd * 0.06, -0.06, 0.36), '#efe8d8')),
      ...[-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.05, 0.1, 4).translate(sd * 0.1, 0.16, 0.0), c)),
    ]),
    antlers: null,
    leg: merge([vc(Cyl(0.06, 0.04, 0.2).translate(0, -0.09, 0), c), vc(Cyl(0.03, 0.03, 0.18).translate(0, -0.28, 0), dark)]),
    hips: [[0.12, 0.38, 0.3], [-0.12, 0.38, 0.3], [0.12, 0.38, -0.3], [-0.12, 0.38, -0.3]],
    neckAt: [0, 0.56, 0.48],
  };
}
function goatGeometry(kind) { // mountain goat (shaggy, beard, short black horns) or bighorn (curled horns, white rump)
  const c = '#ffffff', horn = kind === 'goat' ? '#1e1c1a' : '#b8a888';
  const horns = kind === 'goat'
    ? [-1, 1].map((sd) => vc(new THREE.ConeGeometry(0.025, 0.2, 5).rotateX(-0.5).translate(sd * 0.05, 0.3, 0.12), horn))
    : [-1, 1].map((sd) => vc(new THREE.TorusGeometry(0.1, 0.035, 5, 10, Math.PI * 1.5).rotateY(Math.PI / 2).rotateX(0.4).translate(sd * 0.1, 0.2, 0.1), horn));
  return {
    body: merge([
      vc(S(0.25, 12, 9).scale(0.85, 1.0, 1.75).translate(0, 0.78, 0), c), vc(S(0.25).scale(1, 1.1, 1).translate(0, 0.84, 0.25), c),
      vc(S(0.18, 8, 6).scale(1, 0.9, 0.6).translate(0, 0.8, -0.4), kind === 'goat' ? c : '#ffffff'),
    ]),
    neck: merge([
      vc(Cyl(0.07, 0.12, 0.3).rotateX(0.5).translate(0, 0.08, 0.06), c),
      vc(S(0.09, 8, 6).scale(0.9, 1, 1.4).translate(0, 0.18, 0.2), c),
      ...(kind === 'goat' ? [vc(new THREE.ConeGeometry(0.04, 0.16, 5).rotateX(Math.PI).translate(0, 0.02, 0.24), c)] : []),
      vc(S(0.02, 5, 4).translate(0, 0.16, 0.33), '#141210'),
      ...horns,
    ]),
    antlers: null,
    leg: merge([vc(Cyl(0.055, 0.04, 0.3).translate(0, -0.14, 0), c), vc(Cyl(0.03, 0.03, 0.28).translate(0, -0.42, 0), c), vc(Cyl(0.035, 0.04, 0.05, 5).translate(0, -0.57, 0), '#2a2622')]),
    hips: [[0.1, 0.6, 0.28], [-0.1, 0.6, 0.28], [0.1, 0.6, -0.3], [-0.1, 0.6, -0.3]],
    neckAt: [0, 0.92, 0.4],
  };
}
function capybaraGeometry() {
  const c = '#ffffff';
  return {
    body: merge([vc(S(0.28, 12, 9).scale(0.9, 0.85, 1.55).translate(0, 0.42, 0), c), vc(S(0.26).translate(0, 0.42, -0.25), c)]),
    neck: merge([
      vc(S(0.15, 9, 7).scale(0.85, 1, 1.5).translate(0, 0.04, 0.12), c),
      vc(new THREE.BoxGeometry(0.17, 0.17, 0.2).translate(0, 0.01, 0.3), c),
      ...[-1, 1].map((sd) => vc(S(0.035, 5, 4).translate(sd * 0.08, 0.15, 0.04), c)),
      ...[-1, 1].map((sd) => vc(S(0.016, 4, 3).translate(sd * 0.085, 0.08, 0.22), '#141210')),
    ]),
    antlers: null,
    leg: merge([vc(Cyl(0.05, 0.04, 0.18).translate(0, -0.08, 0), c), vc(Cyl(0.035, 0.035, 0.08).translate(0, -0.2, 0), '#3a2c24')]),
    hips: [[0.12, 0.27, 0.25], [-0.12, 0.27, 0.25], [0.12, 0.27, -0.28], [-0.12, 0.27, -0.28]],
    neckAt: [0, 0.5, 0.38],
  };
}
function coatiGeometry() {
  const c = '#ffffff', ring = '#5a4a3a';
  const tail = []; for (let k = 0; k < 8; k++) tail.push(vc(Cyl(0.032 - k * 0.002, 0.034 - k * 0.002, 0.075, 6).translate(0, 0.32 + k * 0.07, -0.34 - k * 0.012), k % 2 ? ring : c));
  return {
    body: merge([vc(S(0.11, 10, 8).scale(0.9, 0.95, 2.4).translate(0, 0.27, 0), c), vc(S(0.11).translate(0, 0.27, -0.2), c), ...tail]),
    neck: merge([
      vc(S(0.07, 8, 6).translate(0, 0.02, 0.06), c),
      vc(new THREE.ConeGeometry(0.035, 0.16, 6).rotateX(Math.PI / 2 + 0.2).translate(0, -0.01, 0.18), c),
      vc(S(0.012, 4, 3).translate(0, -0.03, 0.26), '#141210'),
      vc(S(0.02, 4, 3).scale(1.2, 0.6, 1).translate(0, 0.04, 0.12), '#f0e8d8'),
      ...[-1, 1].map((sd) => vc(S(0.022, 5, 4).translate(sd * 0.045, 0.07, 0.03), c)),
    ]),
    antlers: null,
    leg: merge([vc(Cyl(0.025, 0.02, 0.2).translate(0, -0.09, 0), '#3a2e26')]),
    hips: [[0.06, 0.2, 0.16], [-0.06, 0.2, 0.16], [0.06, 0.2, -0.18], [-0.06, 0.2, -0.18]],
    neckAt: [0, 0.3, 0.26],
  };
}

// ------------------------------------------------------------------ the herd-type behaviour (grazers)
const HERD = {
  elk:          { geo: elkGeometry, n: [4, 9], col: [0.72, 0.56, 0.38], scale: [1.25, 1.4], flee: 48, fleeSpeed: 11, walk: 1.0, range: [70, 160], rate: 0.05, antlers: 0.5, sound: 'elk', habitat: (q, a) => a > 1 && q.forest < 0.35 && q.cliff < 0.4 },
  mountain_goat:{ geo: () => goatGeometry('goat'), n: [2, 5], col: [0.93, 0.92, 0.88], scale: [0.95, 1.1], flee: 22, fleeSpeed: 4, walk: 0.5, range: [50, 130], rate: 0.06, habitat: (q, a, sl) => a > 6 && sl > 0.45 },
  bighorn:      { geo: () => goatGeometry('bighorn'), n: [3, 6], col: [0.6, 0.48, 0.36], scale: [1.0, 1.15], flee: 26, fleeSpeed: 5, walk: 0.5, range: [50, 140], rate: 0.06, habitat: (q, a, sl) => a > 3 && (sl > 0.4 || q.cliff > 0.5) },
  wild_boar:    { geo: boarGeometry, n: [3, 7], col: [0.3, 0.24, 0.2], scale: [1, 1.1], flee: 20, fleeSpeed: 8, walk: 0.6, range: [45, 110], rate: 0.035, young: true, youngCol: [0.55, 0.42, 0.3], sound: 'boar', habitat: (q, a) => a > 0.8 && q.forest > 0.35 },
  capybara:     { geo: capybaraGeometry, n: [3, 8], col: [0.52, 0.38, 0.26], scale: [0.95, 1.1], flee: 12, fleeSpeed: 4, walk: 0.35, range: [35, 110], rate: 0.06, swimmer: true, habitat: (q, a) => a > 0.15 && a < 1.6 },
  coati:        { geo: coatiGeometry, n: [4, 10], col: [0.58, 0.4, 0.24], scale: [0.95, 1.1], flee: 10, fleeSpeed: 6, walk: 1.4, range: [30, 90], rate: 0.05, habitat: (q, a) => a > 0.6 && q.forest > 0.3 },
};
const PACK = {
  wolf:   { n: [3, 6], col: [0.52, 0.5, 0.46], scale: [0.95, 1.08], trot: 2.6, flee: 55, range: [90, 170], rate: 0.012, sound: 'wolf' },
  coyote: { n: [1, 3], col: [0.66, 0.54, 0.4], scale: [0.72, 0.8], trot: 2.8, flee: 40, range: [60, 140], rate: 0.02, sound: 'coyote' },
};

export class Beasts {
  constructor(game, world, kinds) {
    this.game = game; this.world = world; this.kinds = kinds || [];
    this.group = new THREE.Group(); this.group.name = 'beasts'; game.scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    this.rng = world.fauna?.rng || { next: Math.random, range: (a, b) => a + Math.random() * (b - a), int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), chance: (p) => Math.random() < p, pick: (l) => l[Math.floor(Math.random() * l.length)] };
    this.herds = {}; this.packs = {}; this.t = 0; this.rigs = {};
    for (const k of this.kinds) {
      if (HERD[k]) { this.herds[k] = []; this.rigs[k] = new Rig(this.group, HERD[k].geo(), this.mat, HERD[k].young ? 12 : 12); }
      if (PACK[k]) { this.packs[k] = []; this.rigs[k] = new Rig(this.group, canidGeometry(), this.mat, 8); }
    }
    if (this.kinds.includes('mountain_lion')) { this.catRig = new Rig(this.group, catGeometry(), this.mat, 1); this.cat = null; this.catTimer = this.rng.range(40, 110); }
    if (this.kinds.includes('moose')) { this.mooseRig = new Rig(this.group, mooseGeometry(), this.mat, 2); this.moose = null; this.mooseTimer = this.rng.range(10, 40); }
    if (this.kinds.includes('otter')) {
      const g = merge([vc(S(0.12, 10, 7).scale(0.85, 0.7, 3.2).translate(0, 0, -0.1), '#4a3a2c'), vc(S(0.08, 8, 6).scale(1, 0.85, 1.2).translate(0, 0.05, 0.32), '#4a3a2c'),
        vc(S(0.04, 6, 4).translate(0, 0.02, 0.42), '#8a7a68'), tube([[0, 0, -0.45], [0, -0.02, -0.7], [0, -0.04, -0.9]], 0.045, '#4a3a2c', 0.015)]);
      this.otterMesh = new THREE.InstancedMesh(g, this.mat, 3); this.otterMesh.count = 0; this.otterMesh.frustumCulled = false; this.group.add(this.otterMesh);
      this.otters = []; this.otterTimer = this.rng.range(5, 25);
    }
    this.howlT = this.rng.range(30, 90);
  }

  dispose() { this.game.scene.remove(this.group); }
  gen() { return this.world.gen; }
  inDest(x, z) { return this.world.gen.biomeT(x, z) > 0.55; }
  slope(x, z) { const g = this.gen(), e = 2; return Math.min(1.5, Math.hypot(g.height(x + e, z) - g.height(x - e, z), g.height(x, z + e) - g.height(x, z - e)) / (2 * e)); }
  spot(p, test, rMin, rMax, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const a = this.rng.next() * 6.283, r = this.rng.range(rMin, rMax), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (this.inDest(x, z) && test(x, z)) return { x, z };
    }
    return null;
  }
  facing(p, pos) { // how squarely the player is looking at pos (1 = straight at it)
    const f = this.game.player.forward(V3()); const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz) || 1;
    return (f.x * dx + f.z * dz) / d;
  }
  call(kind, pos) { this.game.audio?.call?.(kind, pos); }
  toastOnce(key, html) { this.seen = this.seen || {}; if (this.seen[key]) return; this.seen[key] = true; this.game.ui.toast(html, true); }

  update(dt, ctx) {
    this.t += dt;
    for (const k of Object.keys(this.herds)) this.updateHerd(k, dt, ctx);
    for (const k of Object.keys(this.packs)) this.updatePack(k, dt, ctx);
    if (this.catRig) this.updateCat(dt, ctx);
    if (this.mooseRig) this.updateMoose(dt, ctx);
    if (this.otterMesh) this.updateOtters(dt, ctx);
    // wolves howl at night whether or not you can see them
    if (this.packs.wolf) {
      this.howlT -= dt;
      if (this.howlT < 0) {
        this.howlT = this.rng.range(40, 120) * (ctx.day < 0.3 ? 1 : 3);
        if (ctx.day < 0.35 || this.rng.chance(0.15)) { const a = this.rng.next() * 6.28, p = ctx.player.pos; this.call('wolf', this.packs.wolf[0]?.pos || V3(p.x + Math.cos(a) * 280, p.y, p.z + Math.sin(a) * 280)); }
      }
    }
  }

  // ---------------------------------------------------------------- grazers
  updateHerd(k, dt, ctx) {
    const H = HERD[k], list = this.herds[k], p = ctx.player.pos, g = this.gen(), W = g.p.water;
    if (!list.length && this.rng.chance(dt * H.rate)) {
      const s = this.spot(p, (x, z) => { const q = g.sample(x, z); return H.habitat(q, q.h - W, this.slope(x, z)); }, H.range[0], H.range[1]);
      if (s) {
        const n = this.rng.int(H.n[0], H.n[1]);
        for (let i = 0; i < n; i++) {
          const young = H.young && i > 0;
          let x = s.x + this.rng.range(-7, 7), z = s.z + this.rng.range(-7, 7);
          list.push({ pos: V3(x, g.height(x, z), z), h: this.rng.range(0, 6.28), state: 'graze', timer: this.rng.range(1, 6), speed: 0, gait: this.rng.range(0, 6), neck: 1.5, male: i === 0 && H.antlers && this.rng.chance(0.8), young, scale: (young ? 0.38 : 1) * this.rng.range(H.scale[0], H.scale[1]) });
        }
        if (H.sound && this.rng.chance(0.6)) this.call(H.sound, list[0].pos);
      }
    }
    if (!list.length) { if (this.rigs[k].n || this.rigs[k].body.count) { this.rigs[k].begin(); this.rigs[k].end(); } return; }
    let alarm = false, nearest = 1e9;
    for (const d of list) { const dist = d.pos.distanceTo(p); nearest = Math.min(nearest, dist); if (dist < H.flee || (dist < H.flee * 1.6 && ctx.player.running)) alarm = true; }
    // a boar sow defends her piglets if you blunder in among them
    if (k === 'wild_boar' && !this.sowCharged && nearest < 8) {
      const sow = list[0]; this.sowCharged = true; sow.state = 'charge'; sow.timer = 1.6;
      this.call('boar', sow.pos); this.game.ui.toast('<b>The sow charges!</b> You came between her and her piglets.', true);
    }
    const R = this.rigs[k]; R.begin();
    for (const d of list) {
      const dist = d.pos.distanceTo(p); d.timer -= dt;
      if (d.state === 'charge') {
        d.h += angDiff(Math.atan2(p.x - d.pos.x, p.z - d.pos.z), d.h) * Math.min(1, dt * 5);
        if (dist < 1.3) { d.state = 'flee'; d.timer = 8; this.game.onAnimalAttack?.('wild_boar'); }
        else if (d.timer < 0) { d.state = 'flee'; d.timer = 8; }
      } else if (alarm && d.state !== 'flee') {
        if (d.state !== 'alert') { d.state = 'alert'; d.timer = this.rng.range(0.3, 1.2) * (k === 'mountain_goat' || k === 'bighorn' ? 2 : 1); }
        else if (d.timer < 0) { d.state = 'flee'; d.timer = 9; if (H.sound && !d.called) { d.called = true; this.call(H.sound, d.pos); } }
      }
      if (d.state === 'flee' && d.timer < 0) { d.state = 'graze'; d.timer = 3; if (dist > 110) d.dead = true; }
      if ((d.state === 'graze' || d.state === 'walk') && d.timer < 0) { d.state = this.rng.chance(0.55) ? 'graze' : 'walk'; d.timer = this.rng.range(2, 7); d.h += this.rng.range(-1, 1); }
      // the young keep close to the first animal (their mother)
      if (d.young && list[0] !== d && d.state !== 'flee') { const m = list[0]; if (d.pos.distanceTo(m.pos) > 3) { d.h += angDiff(Math.atan2(m.pos.x - d.pos.x, m.pos.z - d.pos.z), d.h) * Math.min(1, dt * 3); if (d.state === 'graze') d.state = 'walk'; } }
      let target = 0, neckT = 1.5;
      if (d.state === 'walk') { target = H.walk * (d.young ? 1.6 : 1); neckT = 0.5; }
      if (d.state === 'alert') { neckT = -0.3; d.h += angDiff(Math.atan2(p.x - d.pos.x, p.z - d.pos.z), d.h) * Math.min(1, dt * 2); }
      if (d.state === 'flee') { target = H.fleeSpeed; neckT = 0; d.h += angDiff(Math.atan2(d.pos.x - p.x, d.pos.z - p.z), d.h) * Math.min(1, dt * 2.5); }
      if (d.state === 'charge') { target = 9; neckT = 0.6; }
      d.speed += (target - d.speed) * Math.min(1, dt * 3);
      d.neck += (neckT - d.neck) * Math.min(1, dt * 3);
      if (d.speed > 0.03) {
        const nx = d.pos.x + Math.sin(d.h) * d.speed * dt, nz = d.pos.z + Math.cos(d.h) * d.speed * dt, nh = g.height(nx, nz);
        const ok = H.swimmer ? true : nh > W + 0.1;
        // goats and sheep keep to their cliffs
        const cliffOK = !(k === 'mountain_goat' || k === 'bighorn') || d.state === 'flee' || this.slope(nx, nz) > 0.3;
        if (ok && cliffOK) { d.pos.x = nx; d.pos.z = nz; } else d.h += 1.3;
      }
      const gy = g.height(d.pos.x, d.pos.z);
      d.swim = H.swimmer && gy < W - 0.25;
      d.pos.y = d.swim ? W - 0.32 * d.scale : gy;
      d.gait += dt * (d.speed < 3 ? d.speed * 3.4 / Math.max(0.4, d.scale) : 7 + d.speed * 0.4);
      const gallop = smoothstep(3, 6, d.speed);
      R.draw({ pos: d.pos, h: d.h, scale: d.scale, gait: d.gait, sw: Math.min(1, d.speed), gallop, neck: d.neck - (k === 'wild_boar' ? 1.2 : k === 'capybara' || k === 'coati' ? 1.0 : 0), col: d.young ? H.youngCol || H.col : H.col, antlers: d.male, bounce: gallop * Math.abs(Math.sin(d.gait)) * 0.25 * d.scale });
    }
    this.herds[k] = list.filter((d) => !d.dead && d.pos.distanceTo(p) < 260);
    if (!this.herds[k].length) this.sowCharged = false;
    R.end();
  }

  // ---------------------------------------------------------------- wolves & coyotes: trotting single file, keeping away
  updatePack(k, dt, ctx) {
    const P = PACK[k], list = this.packs[k], p = ctx.player.pos, g = this.gen(), W = g.p.water;
    if (!list.length && this.rng.chance(dt * P.rate * (ctx.day < 0.35 ? 2.5 : 1))) {
      const s = this.spot(p, (x, z) => { const q = g.sample(x, z); return q.h - W > 1 && q.cliff < 0.5; }, P.range[0], P.range[1]);
      if (s) {
        const n = this.rng.int(P.n[0], P.n[1]), toP = Math.atan2(p.x - s.x, p.z - s.z), h = toP + (this.rng.chance(0.5) ? 1.3 : -1.3);
        for (let i = 0; i < n; i++) list.push({ pos: V3(s.x - Math.sin(h) * i * 3, 0, s.z - Math.cos(h) * i * 3), h, speed: P.trot, gait: i, scale: this.rng.range(P.scale[0], P.scale[1]), neck: 0.3, i });
        if (k === 'coyote' && ctx.day < 0.4) this.call('coyote', list[0].pos);
      }
    }
    if (!list.length) { if (this.rigs[k].body.count) { this.rigs[k].begin(); this.rigs[k].end(); } return; }
    const lead = list[0], dLead = lead.pos.distanceTo(p);
    const wary = dLead < P.flee || (ctx.player.running && dLead < P.flee * 1.5);
    if (wary && !this.packWary) { this.packWary = true; this.toastOnce('pack_' + k, k === 'wolf' ? 'Wolves! They have seen you — and want nothing to do with you.' : 'A coyote lopes away, glancing back at you.'); }
    const R = this.rigs[k]; R.begin();
    list.forEach((w, i) => {
      if (i === 0) {
        if (wary) { w.h += angDiff(Math.atan2(w.pos.x - p.x, w.pos.z - p.z), w.h) * Math.min(1, dt * 2); w.speed += (8 - w.speed) * Math.min(1, dt * 2); }
        else { w.h += Math.sin(this.t * 0.2 + w.gait * 0.01) * dt * 0.15; w.speed += (P.trot - w.speed) * dt; }
      } else { // follow the one in front, in its footsteps
        const f = list[i - 1], dx = f.pos.x - w.pos.x, dz = f.pos.z - w.pos.z, d = Math.hypot(dx, dz);
        w.h += angDiff(Math.atan2(dx, dz), w.h) * Math.min(1, dt * 4); w.speed = lead.speed * (d > 3.2 ? 1.25 : d < 2.5 ? 0.7 : 1);
      }
      const nx = w.pos.x + Math.sin(w.h) * w.speed * dt, nz = w.pos.z + Math.cos(w.h) * w.speed * dt;
      if (g.height(nx, nz) > W + 0.1) { w.pos.x = nx; w.pos.z = nz; } else w.h += 1.5;
      w.pos.y = g.height(w.pos.x, w.pos.z);
      w.gait += dt * (w.speed < 3 ? w.speed * 4.5 : 8 + w.speed * 0.5);
      const gallop = smoothstep(4, 7, w.speed);
      R.draw({ pos: w.pos, h: w.h, scale: w.scale, gait: w.gait, sw: Math.min(1, w.speed / 2), gallop, neck: 0.25 + (wary ? -0.3 : 0), col: P.col, bounce: gallop * Math.abs(Math.sin(w.gait)) * 0.18 });
    });
    if (dLead > 280) { this.packs[k] = []; this.packWary = false; }
    R.end();
  }

  // ---------------------------------------------------------------- the mountain lion
  updateCat(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water, pl = ctx.player;
    if (!this.cat) {
      if (this.catRig.body.count) { this.catRig.begin(); this.catRig.end(); }
      this.catTimer -= dt;
      if (this.catTimer < 0) {
        const twilight = ctx.day > 0.05 && ctx.day < 0.55;
        this.catTimer = this.rng.range(90, 200) * (twilight ? 0.6 : 1);
        if (this.rng.chance(0.6)) {
          // on a rise, in the open edge of cover, ahead of the player where it can be noticed
          const f = pl.forward(V3());
          for (let k = 0; k < 30; k++) {
            const a = Math.atan2(f.x, f.z) + this.rng.range(-1.2, 1.2), r = this.rng.range(38, 70), x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
            if (!this.inDest(x, z)) continue; const q = g.sample(x, z);
            if (q.h - W < 1.5 || q.h < p.y - 3) continue;
            this.cat = { pos: V3(x, q.h, z), h: Math.atan2(p.x - x, p.z - z), state: 'watch', timer: this.rng.range(7, 13), speed: 0, gait: 0, neck: -0.1, crouch: 0, faced: 0, hunger: this.rng.range(0.3, 1) };
            break;
          }
        }
      }
      return;
    }
    const c = this.cat, d = c.pos.distanceTo(p), toP = Math.atan2(p.x - c.pos.x, p.z - c.pos.z), face = this.facing(p, c.pos);
    const seen = face > 0.82 && d < 90;
    if (seen && !c.noticed) { c.noticed = true; this.toastOnce('cat', '<b>A mountain lion is watching you.</b> Face it. Stand tall. Never turn your back or run.'); }
    c.timer -= dt;
    // running from a big cat triggers its chase instinct
    if (pl.running && d < 40 && c.state !== 'leave' && c.state !== 'chase' && c.state !== 'attack') { c.state = 'chase'; this.call('cougar', c.pos); }
    switch (c.state) {
      case 'watch':
        c.h += angDiff(toP, c.h) * Math.min(1, dt * 2);
        if (c.timer < 0) { if (face < 0.2 && c.hunger > 0.5 && d < 75) { c.state = 'stalk'; } else { c.state = 'leave'; c.timer = 20; } }
        break;
      case 'stalk': // creeps in while your back is turned; freezes when you look round
        c.h += angDiff(toP, c.h) * Math.min(1, dt * 2);
        if (face > 0.75) { c.state = 'freeze'; c.timer = 0; }
        else if (d < 3.5) { c.state = 'attack'; this.call('cougar', c.pos); this.game.onAnimalAttack?.('mountain_lion'); }
        break;
      case 'freeze':
        c.timer += dt;
        if (face > 0.75) { c.faced += dt; if (c.faced > 2.5 + (d < 12 ? 1.5 : 0)) { c.state = 'leave'; c.timer = 25; this.call('cougar_hiss', c.pos); this.game.ui.toast('It holds your gaze… then slinks away. Facing it was right.', true); } }
        else if (c.timer > 1.2) { c.state = 'stalk'; c.faced = Math.max(0, c.faced - 1); }
        break;
      case 'chase':
        c.h += angDiff(toP, c.h) * Math.min(1, dt * 5);
        if (!pl.running && face > 0.8 && d > 3) { c.state = 'freeze'; c.timer = 0; c.faced = 0.5; this.game.ui.toast('You stop and face it. It checks its rush.', true); }
        else if (d < 2.2) { c.state = 'attack'; this.game.onAnimalAttack?.('mountain_lion'); }
        break;
      case 'leave':
        if (c.timer < 0 || d > 120) { this.cat = null; return; }
        break;
      case 'attack': if ((c.t = (c.t || 0) + dt) > 4) { this.cat = null; return; } break;
    }
    let target = 0, crouchT = 0, neckT = -0.1;
    if (c.state === 'stalk') { target = 1.7; crouchT = 0.22; neckT = 0.25; }
    if (c.state === 'freeze') { crouchT = 0.28; neckT = 0.2; }
    if (c.state === 'chase') { target = 15; crouchT = 0.05; neckT = 0.25; }
    if (c.state === 'leave') { target = 3.2; c.h += angDiff(toP + Math.PI, c.h) * Math.min(1, dt * 2); }
    c.speed += (target - c.speed) * Math.min(1, dt * (c.state === 'chase' ? 4 : 2));
    c.crouch += (crouchT - c.crouch) * Math.min(1, dt * 3);
    c.neck += (neckT - c.neck) * Math.min(1, dt * 3);
    if (c.speed > 0.05) { const nx = c.pos.x + Math.sin(c.h) * c.speed * dt, nz = c.pos.z + Math.cos(c.h) * c.speed * dt; if (g.height(nx, nz) > W + 0.1) { c.pos.x = nx; c.pos.z = nz; } else c.h += 1; }
    c.pos.y = g.height(c.pos.x, c.pos.z) - c.crouch;
    c.gait += dt * (c.speed < 3 ? c.speed * 3.6 : 8 + c.speed * 0.4);
    const gallop = smoothstep(4, 8, c.speed);
    const R = this.catRig; R.begin();
    R.draw({ pos: c.pos, h: c.h, scale: 1.05, gait: c.gait, sw: Math.min(1, c.speed), gallop, neck: c.neck + 0.5, col: [0.72, 0.56, 0.4], bounce: gallop * Math.abs(Math.sin(c.gait)) * 0.22 });
    R.end();
  }

  // ---------------------------------------------------------------- moose
  updateMoose(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water;
    if (!this.moose) {
      if (this.mooseRig.body.count) { this.mooseRig.begin(); this.mooseRig.end(); }
      this.mooseTimer -= dt;
      if (this.mooseTimer < 0) {
        this.mooseTimer = this.rng.range(80, 160);
        // wading in the shallows to feed on water plants, or browsing at the edge of the woods
        const s = this.spot(p, (x, z) => { const q = g.sample(x, z), dd = W - q.h; return (dd > 0.1 && dd < 0.9) || (q.h - W > 0.5 && q.forest > 0.3 && q.forest < 0.7); }, 60, 140);
        if (s) this.moose = { pos: V3(s.x, 0, s.z), h: this.rng.range(0, 6.28), state: 'feed', timer: 4, speed: 0, gait: 0, neck: 1.3, bull: this.rng.chance(0.6), calf: null };
      }
      return;
    }
    const m = this.moose, d = m.pos.distanceTo(p), toP = Math.atan2(p.x - m.pos.x, p.z - m.pos.z);
    const prevD = this.prevMooseD ?? d; const closing = (prevD - d) / Math.max(dt, 1e-3); this.prevMooseD = d;
    m.timer -= dt;
    switch (m.state) {
      case 'feed': case 'browse':
        if (m.timer < 0) { m.timer = this.rng.range(3, 8); m.h += this.rng.range(-1, 1); m.walking = this.rng.chance(0.4); if (this.rng.chance(0.15)) this.call('moose', m.pos); }
        if (d < 40) { m.state = 'watch'; m.timer = 3; this.toastOnce('moose', '<b>A moose.</b> It looks calm — but moose charge more people than bears do. Give it plenty of room.'); }
        break;
      case 'watch':
        if (d < 18 || (closing > 0.5 && d < 26)) { m.state = 'warn'; m.timer = 2.2; this.call('moose', m.pos); this.game.ui.toast('Its ears go back and the hair on its hump rises — <b>back off now!</b>', true); }
        else if (d > 48) { m.state = 'feed'; m.timer = 3; }
        break;
      case 'warn':
        if (d > 24) { m.state = 'watch'; m.timer = 3; }
        else if (m.timer < 0) { m.state = 'charge'; m.timer = 3.5; this.game.ui.toast('The moose charges! Get something solid — a tree, a rock — between you!', true); }
        break;
      case 'charge':
        if (d < 2.2) { m.state = 'feed'; m.timer = 10; this.game.onAnimalAttack?.('moose'); }
        else if (m.timer < 0 || d > 30) { m.state = 'watch'; m.timer = 4; }
        break;
    }
    let target = 0, neckT = 1.3;
    if (m.state === 'feed') { target = m.walking ? 0.6 : 0; neckT = 1.6 + Math.sin(this.t * 0.4) * 0.2; }
    if (m.state === 'watch' || m.state === 'warn') { neckT = m.state === 'warn' ? 0.35 : -0.1; m.h += angDiff(toP, m.h) * Math.min(1, dt * 2); }
    if (m.state === 'charge') { target = 11; neckT = 0.5; m.h += angDiff(toP, m.h) * Math.min(1, dt * 3); }
    m.speed += (target - m.speed) * Math.min(1, dt * 2.5);
    m.neck += (neckT - m.neck) * Math.min(1, dt * 3);
    if (m.speed > 0.05) { const nx = m.pos.x + Math.sin(m.h) * m.speed * dt, nz = m.pos.z + Math.cos(m.h) * m.speed * dt; if (g.height(nx, nz) > W - 1.0) { m.pos.x = nx; m.pos.z = nz; } else m.h += 1; }
    m.pos.y = Math.max(g.height(m.pos.x, m.pos.z), W - 1.0);
    if (W - g.height(m.pos.x, m.pos.z) > 0.05 && m.speed > 0.3) { this.wakeT = (this.wakeT || 0) - dt; if (this.wakeT < 0) { this.wakeT = 0.25; this.game.ripples?.drop(m.pos.x, m.pos.z, 0.9, 0.12); } }
    m.gait += dt * (m.speed < 3 ? m.speed * 2.6 : 5.5 + m.speed * 0.35);
    if (d > 260) { this.moose = null; return; }
    const R = this.mooseRig; R.begin();
    R.draw({ pos: m.pos, h: m.h, scale: 1, gait: m.gait, sw: Math.min(1, m.speed), gallop: smoothstep(3, 7, m.speed), neck: m.neck - 0.9, col: [0.3, 0.22, 0.16], antlers: m.bull, bounce: smoothstep(3, 7, m.speed) * Math.abs(Math.sin(m.gait)) * 0.2 });
    R.end();
  }

  // ---------------------------------------------------------------- otters
  updateOtters(dt, ctx) {
    const p = ctx.player.pos, g = this.gen(), W = g.p.water, M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new THREE.Vector3(1, 1, 1);
    this.otterTimer -= dt;
    if (this.otterTimer < 0 && this.otters.length < 2) {
      this.otterTimer = this.rng.range(40, 90);
      const s = this.spot(p, (x, z) => W - g.height(x, z) > 1.2, 18, 55);
      if (s) this.otters.push({ pos: V3(s.x, W, s.z), h: this.rng.range(0, 6.28), dive: 0, timer: this.rng.range(3, 8), under: false, life: this.rng.range(60, 120) });
    }
    let n = 0;
    for (const o of this.otters) {
      const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z); o.timer -= dt; o.life -= dt;
      if (d < 10 && !o.under) { o.under = true; o.timer = 6; o.h = Math.atan2(o.pos.x - p.x, o.pos.z - p.z); this.game.ripples?.drop(o.pos.x, o.pos.z, 0.5, 0.35); this.game.audio?.plopAt?.(o.pos); }
      if (o.timer < 0) {
        o.under = !o.under; o.timer = o.under ? this.rng.range(3, 7) : this.rng.range(4, 10);
        this.game.ripples?.drop(o.pos.x, o.pos.z, 0.45, o.under ? 0.3 : 0.15);
        if (!o.under) { o.h += this.rng.range(-1.5, 1.5); if (this.rng.chance(0.3)) this.call('otter', o.pos); }
      }
      const v = o.under ? 1.6 : 0.7, nx = o.pos.x + Math.sin(o.h) * v * dt, nz = o.pos.z + Math.cos(o.h) * v * dt;
      if (W - g.height(nx, nz) > 0.6) { o.pos.x = nx; o.pos.z = nz; } else o.h += 1.6;
      // surfacing in a rolling arc, swimming low with head up, then a curl down and under
      o.dive += ((o.under ? 1 : 0) - o.dive) * Math.min(1, dt * 2.5);
      if (!o.under) { this.wk = (this.wk || 0) - dt; if (this.wk < 0) { this.wk = 0.35; this.game.ripples?.drop(o.pos.x - Math.sin(o.h) * 0.5, o.pos.z - Math.cos(o.h) * 0.5, 0.3, 0.05); } }
      if (o.dive > 0.95) continue;
      E.set(o.dive * 0.9, o.h, 0, 'YXZ'); Q.setFromEuler(E);
      M.compose(V3(o.pos.x, W - 0.04 - o.dive * 0.5 + Math.sin(this.t * 3 + o.h) * 0.015, o.pos.z), Q, SC);
      this.otterMesh.setMatrixAt(n++, M);
    }
    this.otters = this.otters.filter((o) => o.life > 0 && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 150);
    this.otterMesh.count = n; this.otterMesh.instanceMatrix.needsUpdate = true;
  }

  // (dev/testing) put an animal of this kind at x, z
  debugSpawn(kind, x, z) {
    const g = this.gen(), y = g.height(x, z);
    if (HERD[kind]) { const H = HERD[kind]; this.herds[kind] = []; for (let i = 0; i < 4; i++) this.herds[kind].push({ pos: V3(x + i * 2.2, y, z + (i % 2) * 1.5), h: 0.6 * i, state: 'graze', timer: 5, speed: 0, gait: i, neck: 0.8, male: i === 0 && !!H.antlers, young: H.young && i > 0, scale: (H.young && i > 0 ? 0.38 : 1) * H.scale[0] }); }
    if (PACK[kind]) { this.packs[kind] = []; for (let i = 0; i < 3; i++) this.packs[kind].push({ pos: V3(x - i * 3, y, z), h: Math.PI / 2, speed: 0.01, gait: i, scale: PACK[kind].scale[0], neck: 0.3, i }); }
    if (kind === 'mountain_lion') this.cat = { pos: V3(x, y, z), h: Math.PI, state: 'watch', timer: 30, speed: 0, gait: 0, neck: -0.1, crouch: 0, faced: 0, hunger: 1 };
    if (kind === 'moose') this.moose = { pos: V3(x, Math.max(y, g.p.water - 1), z), h: 1, state: 'feed', timer: 30, speed: 0, gait: 0, neck: 1.0, bull: true };
    if (kind === 'otter') this.otters.push({ pos: V3(x, g.p.water, z), h: 1, dive: 0, timer: 30, under: false, life: 99 });
  }

  observable(p, look, cam) {
    let best = null, bd = 1e9;
    const consider = (pos, kind, ref, dmin, dmax, yo = 0.8) => {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz); if (d > dmax || d < dmin || d > bd) return;
      const dir = V3(dx, pos.y + yo - cam.y, dz).normalize(); if (look.dot(dir) < (d < 8 ? 0.9 : 0.965)) return;
      bd = d; best = { kind, ref, dist: d };
    };
    for (const [k, list] of Object.entries(this.herds)) for (const d of list) if (d.state !== 'flee' && d.state !== 'charge') consider(d.pos, k, d, 0, 110, d.scale * 0.8);
    for (const [k, list] of Object.entries(this.packs)) for (const w of list) consider(w.pos, k, w, 0, 160, 0.6);
    if (this.cat && this.cat.state !== 'attack' && this.cat.state !== 'chase') consider(this.cat.pos, 'mountain_lion', this.cat, 6, 120, 0.6);
    if (this.moose && this.moose.state !== 'charge') consider(this.moose.pos, 'moose', this.moose, 18, 140, 1.6);
    for (const o of this.otters || []) if (!o.under) consider(o.pos, 'otter', o, 0, 60, 0.05);
    return best;
  }
}

export const BEAST_KINDS = [...Object.keys(HERD), ...Object.keys(PACK), 'mountain_lion', 'moose', 'otter'];
