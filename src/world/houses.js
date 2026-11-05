// Walk-in buildings for the village plots. Every structure is built in local space (door facing +z,
// floor top at FLOOR) with real door and window openings, a furnished interior that depends on
// what the building is for and how far it has been upgraded, rafters you see from inside, and
// colliders for each piece of wall so you walk in through the door and not through the wall.
import * as THREE from 'three';
import { M, cloth, prop } from './structures.js';

export const FLOOR = 0.12;               // top of the floor above the yard
export const WIN_GLASS = new THREE.MeshStandardMaterial({ color: 0xa8c4cc, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
const COALS = new THREE.MeshStandardMaterial({ color: 0x331008, emissive: 0xff5a14, emissiveIntensity: 1.6, roughness: 0.9 });
const FLAME = new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xffa040, emissiveIntensity: 2.4, roughness: 1, transparent: true, opacity: 0.85 });
const C = { blanket: cloth(0x8a3a2a), blanket2: cloth(0x3a5a7a), linen: cloth(0xe8e0cc), sack: cloth(0xc8b48a), rug: cloth(0x7a4a3a), herb: cloth(0x6a7a3a), yarn: cloth(0xb85a3a), yarn2: cloth(0x4a6a8a), yarn3: cloth(0xd8c070), curtain: cloth(0xb8a888) };

// architectures: walls, roof, and the extra materials the style needs on top of the building's own cost
export const STYLES = {
  timber:    { name: 'Timber & thatch', wall: 'logs', roof: 'thatch', cost: {}, desc: 'Log walls under a deep thatch.' },
  whitewash: { name: 'Whitewashed', wall: 'plaster', roof: 'thatch', cost: { clay: 4, stone: 4 }, desc: 'Lime-washed walls, thatched roof — bright and cosy.' },
  plank:     { name: 'Plank & tile', wall: 'planks', roof: 'tiles', cost: { wood: 6, tile: 6 }, desc: 'Weathered boards under fired clay tiles.' },
  stone:     { name: 'Stone & tile', wall: 'stone', roof: 'tiles', cost: { stone: 14, tile: 6 }, desc: 'Thick stone walls that stay cool in summer, warm in winter.' },
  sandstone: { name: 'Canyon sandstone', wall: 'sandstone', roof: 'flat', cost: { sandstone: 12 }, desc: 'Warm red slabs from canyon country, with a flat roof.' },
  driftwood: { name: 'Driftwood', wall: 'grey', roof: 'thatch', cost: { driftwood: 10 }, desc: 'Silvered, salt-hardened boards from the beach.' },
  tropical:  { name: 'Palm & plank', wall: 'planks', roof: 'frond', cost: { frond: 12, wood: 4 }, desc: 'Open, airy walls under a steep roof of palm fronds.' },
};

// a transform helper: local (x, z) → world, for a building at (ox, oz) turned by ry
function frame(b, ox, oz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (x, z) => [ox + x * c + z * s, oz - x * s + z * c];
  const box = (mat, w, h, d, x, y, z, o = {}) => { const [wx, wz] = P(x, z); return b.box(mat, w, h, d, wx, y, wz, { ...o, ry: (o.ry || 0) + ry }); };
  const cyl = (mat, r0, r1, h, x, y, z, o = {}) => { const [wx, wz] = P(x, z); return b.cyl(mat, r0, r1, h, wx, y, wz, { ...o, ry: (o.ry || 0) + ry }); };
  const col = (x, z, hw, hd) => { const [wx, wz] = P(x, z); b.colliders.push({ x: wx, z: wz, hw, hd, rot: -ry }); };
  const colR = (x, z, r) => { const [wx, wz] = P(x, z); b.colliders.push({ x: wx, z: wz, r }); };
  return { P, box, cyl, col, colR, c, s };
}

// a straight wall from a to b along local x (at z) or along local z (at x), with openings
function wallRun(F, mat, { along, at, from, to, H, t, openings = [] }) {
  const ops = openings.slice().sort((a, b) => a.c - b.c);
  let cur = from;
  const seg = (u0, u1, y0, y1, collide) => {
    if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
    const len = u1 - u0, uc = (u0 + u1) / 2, h = y1 - y0, yc = FLOOR + y0 + h / 2;
    if (along === 'x') { F.box(mat, len, h, t, uc, yc, at, { ts: 2.2 }); if (collide) F.col(uc, at, len / 2, t / 2 + 0.04); }
    else { F.box(mat, t, h, len, at, yc, uc, { ts: 2.2 }); if (collide) F.col(at, uc, t / 2 + 0.04, len / 2); }
  };
  for (const o of ops) {
    const u0 = o.c - o.w / 2, u1 = o.c + o.w / 2;
    seg(cur, u0, 0, H, true);
    seg(u0, u1, o.y1, H, false);                    // above the opening
    if (o.y0 > 0) seg(u0, u1, 0, o.y0, true);       // below a window
    if (o.glass) { // a pane and a frame
      const yc = FLOOR + (o.y0 + o.y1) / 2, h = o.y1 - o.y0;
      if (along === 'x') { F.box(WIN_GLASS, o.w, h, 0.03, o.c, yc, at); F.box(M.darkwood, o.w + 0.16, 0.08, t + 0.1, o.c, FLOOR + o.y0, at); F.box(M.darkwood, 0.05, h, 0.06, o.c, yc, at); }
      else { F.box(WIN_GLASS, 0.03, h, o.w, at, yc, o.c); F.box(M.darkwood, t + 0.1, 0.08, o.w + 0.16, at, FLOOR + o.y0, o.c); F.box(M.darkwood, 0.06, h, 0.05, at, yc, o.c); }
    }
    if (o.y0 === 0 && o.frame !== false) { // a door frame
      if (along === 'x') { F.box(M.darkwood, o.w + 0.24, 0.16, t + 0.12, o.c, FLOOR + o.y1 + 0.06, at); for (const s of [-1, 1]) F.box(M.darkwood, 0.12, o.y1, t + 0.12, o.c + s * (o.w / 2 + 0.04), FLOOR + o.y1 / 2, at); }
      else { F.box(M.darkwood, t + 0.12, 0.16, o.w + 0.24, at, FLOOR + o.y1 + 0.06, o.c); for (const s of [-1, 1]) F.box(M.darkwood, t + 0.12, o.y1, 0.12, at, FLOOR + o.y1 / 2, o.c + s * (o.w / 2 + 0.04)); }
    }
    cur = u1;
  }
  seg(cur, to, 0, H, true);
}

// sizes by level
export const SIZES = { 1: { w: 5.4, d: 4.4, H: 2.6 }, 2: { w: 7, d: 5.4, H: 2.8 }, 3: { w: 8.6, d: 6.2, H: 3.0 } };

// spec: { x, z, ry, type, level, style }
export function buildStructure(b, spec) {
  const st = STYLES[spec.style] || STYLES.timber, L = Math.max(1, Math.min(3, spec.level || 1));
  const { w, d, H } = SIZES[L], t = 0.22;
  const F = frame(b, spec.x, spec.z, spec.ry);
  const wallMat = M[st.wall] || M.logs, flat = st.roof === 'flat', roofMat = flat ? M.sandstone : M[st.roof] || M.thatch;
  const out = { stations: [], w, d, H, chimney: null, fire: null, glow: [] };
  const open = spec.type === 'workshop' && L === 1; // the first workshop is an open shed
  // footing and floor
  F.box(M.stone, w + 0.3, 0.22, d + 0.3, 0, -0.03, 0, { ts: 2.5 });
  F.box(spec.type === 'forge' || spec.type === 'kiln' || spec.type === 'smokehouse' ? M.cobble : M.planks, w - 0.1, 0.06, d - 0.1, 0, FLOOR - 0.03, 0, { ts: 1.6 });
  F.box(M.stone, 1.4, 0.12, 0.5, 0, 0.0, d / 2 + 0.3, { ts: 1.4 }); // doorstep
  // walls with a door in front and windows
  const winY0 = 0.95, winY1 = 1.85, door = { c: 0, w: 1.2, y0: 0, y1: 2.1 };
  if (!open) {
    const fw = (L >= 2 ? [{ c: -w / 2 + 1.3, w: 0.9, y0: winY0, y1: winY1, glass: true }, { c: w / 2 - 1.3, w: 0.9, y0: winY0, y1: winY1, glass: true }] : [{ c: w / 2 - 1.1, w: 0.8, y0: winY0, y1: winY1, glass: true }]);
    wallRun(F, wallMat, { along: 'x', at: d / 2 - t / 2, from: -w / 2, to: w / 2, H, t, openings: [door, ...fw] });
    wallRun(F, wallMat, { along: 'x', at: -d / 2 + t / 2, from: -w / 2, to: w / 2, H, t, openings: L >= 3 ? [{ c: w / 4, w: 0.9, y0: winY0, y1: winY1, glass: true }] : [] });
    for (const sx of [-1, 1]) wallRun(F, wallMat, { along: 'z', at: sx * (w / 2 - t / 2), from: -d / 2 + t, to: d / 2 - t, H, t, openings: [{ c: 0, w: 0.8, y0: winY0, y1: winY1, glass: true }] });
    // a door leaf standing open, inside
    F.box(M.darkwood, 0.07, 2.05, 1.1, -0.6 + 0.04, FLOOR + 1.03, d / 2 - t - 0.55, { ts: 1.2 });
  } else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { F.cyl(M.logs, 0.14, 0.12, H, sx * (w / 2 - 0.2), FLOOR + H / 2, sz * (d / 2 - 0.2), { seg: 7 }); F.colR(sx * (w / 2 - 0.2), sz * (d / 2 - 0.2), 0.2); }
    wallRun(F, M.planks, { along: 'x', at: -d / 2 + t / 2, from: -w / 2, to: w / 2, H, t }); // a back wall to hang tools on
  }
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(M.darkwood, 0.3, H + 0.05, 0.3, sx * (w / 2 - 0.06), FLOOR + H / 2, sz * (d / 2 - 0.06), { ts: 1.5 });
  // roof
  const top = FLOOR + H;
  if (flat) {
    F.box(roofMat, w + 0.5, 0.22, d + 0.5, 0, top + 0.11, 0, { ts: 1.6 });
    for (const sz of [-1, 1]) F.box(roofMat, w + 0.5, 0.45, 0.2, 0, top + 0.45, sz * (d / 2 + 0.15), { ts: 1.6 });
    for (const sx of [-1, 1]) F.box(roofMat, 0.2, 0.45, d + 0.5, sx * (w / 2 + 0.15), top + 0.45, 0, { ts: 1.6 });
    for (let i = 0; i < Math.round(w / 0.9); i++) F.cyl(M.logs, 0.08, 0.08, d + 0.7, -w / 2 + 0.45 + i * 0.9, top - 0.08, 0, { rx: Math.PI / 2, seg: 6 }); // vigas
  } else {
    const pitch = st.roof === 'frond' ? 0.82 : st.roof === 'tiles' ? 0.6 : 0.7, rise = (d / 2) * Math.tan(pitch);
    if (!open) for (const sx of [-1, 1]) { const [gx, gz] = F.P(sx * (w / 2 - t / 2), 0); b.gable(wallMat, d, rise, gx, top, gz, spec.ry + Math.PI / 2); }
    const over = st.roof === 'frond' ? 0.7 : 0.45, Lr = w + 2 * over, slope = (d / 2 + over) / Math.cos(pitch);
    for (const sz of [-1, 1]) F.box(roofMat, Lr, 0.16, slope, 0, top + rise / 2 - over * Math.tan(pitch) / 2 + 0.05, sz * (d / 4 + over / 2 - 0.05), { rx: sz * pitch, ts: 2.5 });
    F.box(M.darkwood, Lr, 0.2, 0.2, 0, top + rise + 0.05, 0);
    // what you see from inside: tie beams and the ridge
    for (let i = 0; i < L + 1; i++) { const x = -w / 2 + (i + 0.5) * (w / (L + 1)); F.box(M.darkwood, 0.16, 0.18, d - 0.2, x, top - 0.1, 0, { ts: 1.4 }); }
    F.box(M.darkwood, 0.14, rise, 0.14, 0, top + rise / 2, 0);
  }
  // inside: what this building is for
  furnish(F, spec.type, L, w, d, H, out);
  // chimney where there's a fire
  if (out.fire) {
    const [cx, cz] = [out.fire[0], out.fire[1]];
    const ch = (flat ? 0.9 : (d / 2) * Math.tan(0.7) + 1.0) + H, base = 1.05; // the breast rises from above the fire
    F.box(M.stone, 0.75, ch - base, 0.6, cx, FLOOR + base + (ch - base) / 2, cz - 0.05, { ts: 1.6 });
    const [wx, wz] = F.P(cx, cz); out.chimney = new THREE.Vector3(wx, FLOOR + ch + 0.2, wz);
  }
  // where things are, in world space
  const toW = (x, z, y = 1) => { const [wx, wz] = F.P(x, z); return new THREE.Vector3(wx, y, wz); };
  out.door = toW(0, d / 2 + 1.1, 1); out.inside = toW(0, 0, 1);
  out.stations = out.stations.map((s) => ({ ...s, pos: toW(s.x, s.z, s.y ?? 1) }));
  out.fireW = out.fire ? toW(out.fire[0], out.fire[1] + 0.55, FLOOR) : null;
  out.lightPos = toW(0, 0, FLOOR + H - 0.5);
  out.glow = out.glow.map(([x, y, z]) => toW(x, z, y));
  return out;
}

// ---------------------------------------------------------------- furniture by building type
function hearth(F, x, z, d, out) { // a stone fireplace against the back wall
  F.box(M.stone, 1.5, 0.95, 0.65, x, FLOOR + 0.48, z, { ts: 1.4 });
  F.box(M.iron, 0.9, 0.55, 0.06, x, FLOOR + 0.35, z - 0.05); // fire-back
  F.box(COALS, 0.6, 0.08, 0.3, x, FLOOR + 0.12, z + 0.14);
  F.box(FLAME, 0.4, 0.25, 0.06, x, FLOOR + 0.28, z + 0.18);
  F.box(M.darkwood, 1.7, 0.12, 0.5, x, FLOOR + 1.0, z + 0.05); // mantel
  F.col(x, z, 0.75, 0.33);
  out.fire = [x, z - 0.2];
}
function shelf(F, x, z, w, ry = 0, n = 3) {
  const o = { ry }; for (let i = 0; i < n; i++) F.box(M.planks, w, 0.05, 0.32, x, FLOOR + 0.45 + i * 0.5, z, o);
  for (const s of [-1, 1]) F.box(M.darkwood, 0.05, 0.5 * n + 0.2, 0.32, x + (ry ? 0 : s * w / 2), FLOOR + (0.5 * n + 0.2) / 2, z + (ry ? s * w / 2 : 0), o);
}
function jars(F, x, z, n, y, along = 'x') {
  const mats = [M.pot, M.glass, C.herb, M.pot];
  for (let i = 0; i < n; i++) F.cyl(mats[i % mats.length], 0.06, 0.05, 0.16 + (i % 3) * 0.05, x + (along === 'x' ? (i - n / 2) * 0.17 : 0), y + 0.09, z + (along === 'z' ? (i - n / 2) * 0.17 : 0), { seg: 8 });
}
function table(F, x, z, w = 1.3, dd = 0.8) {
  F.box(M.planks, w, 0.06, dd, x, FLOOR + 0.76, z, { ts: 1.4 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(M.darkwood, 0.07, 0.74, 0.07, x + sx * (w / 2 - 0.08), FLOOR + 0.37, z + sz * (dd / 2 - 0.08));
  F.col(x, z, w / 2, dd / 2);
}
function stool(F, x, z) { F.cyl(M.planks, 0.18, 0.18, 0.05, x, FLOOR + 0.46, z, { seg: 10 }); for (let i = 0; i < 3; i++) { const a = i * 2.09; F.cyl(M.darkwood, 0.025, 0.025, 0.45, x + Math.cos(a) * 0.12, FLOOR + 0.22, z + Math.sin(a) * 0.12, { seg: 5 }); } }
function barrel(F, x, z) { F.cyl(M.planks, 0.3, 0.3, 0.8, x, FLOOR + 0.4, z, { seg: 12, ts: 1 }); for (const y of [0.15, 0.65]) F.cyl(M.iron, 0.31, 0.31, 0.04, x, FLOOR + y, z, { seg: 12 }); F.colR(x, z, 0.32); }
function sack(F, x, z) { F.cyl(C.sack, 0.24, 0.18, 0.55, x, FLOOR + 0.27, z, { seg: 8 }); }

function furnish(F, type, L, w, d, H, out) {
  const back = -d / 2 + 0.25 + 0.22, left = -w / 2 + 0.22, right = w / 2 - 0.22;
  const st = (stype, x, z, label, r = 1.6, y = 1) => out.stations.push({ type: stype, x, z, label, radius: r, y });
  switch (type) {
    case 'house': {
      // bed in the corner
      const bx = left + 0.55, bz = back + 1.05;
      F.box(M.darkwood, 1.0, 0.35, 2.0, bx, FLOOR + 0.2, bz); F.box(C.linen, 0.92, 0.12, 1.9, bx, FLOOR + 0.43, bz); F.box(L >= 2 ? C.blanket2 : C.blanket, 0.96, 0.08, 1.25, bx, FLOOR + 0.5, bz + 0.3);
      F.box(C.linen, 0.6, 0.1, 0.35, bx, FLOOR + 0.52, bz - 0.7); F.box(M.darkwood, 1.0, 0.8, 0.08, bx, FLOOR + 0.4, back - 0.02);
      F.col(bx, bz, 0.5, 1.0); st('rest', bx + 0.8, bz, 'Rest in your bed', 1.6);
      // table and stools
      table(F, 0.4, 0.1); stool(F, 0.4 - 0.9, 0.1); stool(F, 0.4 + 0.9, 0.1);
      // chest, shelf, rug
      F.box(M.darkwood, 0.9, 0.5, 0.5, right - 0.35, FLOOR + 0.25, d / 2 - 0.9); F.box(M.iron, 0.92, 0.05, 0.52, right - 0.35, FLOOR + 0.42, d / 2 - 0.9); F.col(right - 0.35, d / 2 - 0.9, 0.46, 0.27);
      st('store', right - 0.9, d / 2 - 0.9, 'Open your chest (the storehouse)', 1.4);
      shelf(F, right - 0.2, back + 1.2, 1.0, Math.PI / 2, 2); jars(F, right - 0.2, back + 1.2, 4, FLOOR + 0.95, 'z');
      F.box(C.rug, 1.8, 0.02, 1.2, 0.3, FLOOR + 0.01, 0.2);
      if (L >= 2) { hearth(F, 1.2, back, d, out); st('hearth', 1.2, back + 1.0, 'Cook & bake at your hearth', 1.6); }
      if (L >= 3) { // a second bed and a bench by the window
        F.box(M.darkwood, 0.9, 0.3, 1.9, right - 0.5, FLOOR + 0.18, back + 1.0 + 1.4); F.box(C.blanket, 0.85, 0.1, 1.6, right - 0.5, FLOOR + 0.38, back + 2.6); F.col(right - 0.5, back + 2.4, 0.45, 0.95);
        F.box(M.planks, 1.6, 0.06, 0.4, -w / 2 + 2.6, FLOOR + 0.45, d / 2 - 0.45); F.col(-w / 2 + 2.6, d / 2 - 0.45, 0.8, 0.2);
      }
      out.glow.push([0, FLOOR + H - 0.4, 0]);
      break;
    }
    case 'store': {
      shelf(F, left + 0.2, 0, Math.min(3, d - 1.2), Math.PI / 2, 3); jars(F, left + 0.2, 0, 6, FLOOR + 0.95, 'z');
      shelf(F, 0, back, Math.min(3.6, w - 1.6), 0, 3);
      for (let i = 0; i < 2 + L; i++) barrel(F, right - 0.45, back + 0.45 + i * 0.68);
      for (let i = 0; i < 3 + L; i++) sack(F, -0.8 + (i % 3) * 0.5, back + 0.9 + Math.floor(i / 3) * 0.5);
      F.col(0, back, Math.min(1.8, w / 2 - 0.8), 0.2); F.col(left + 0.2, 0, 0.2, Math.min(1.5, d / 2 - 0.6));
      st('store', 0, 0.6, 'Open the storehouse', 2.2);
      break;
    }
    case 'workshop': {
      table(F, 0, back + 0.55, 2.4, 0.9);
      F.box(M.iron, 0.4, 0.12, 0.2, 0.6, FLOOR + 0.85, back + 0.55); F.box(M.darkwood, 0.6, 0.06, 0.25, -0.5, FLOOR + 0.82, back + 0.55);
      for (let i = 0; i < 5; i++) F.box(M.darkwood, 0.05, 0.6, 0.05, -1 + i * 0.45, FLOOR + 1.6, back - 0.15); // tools on the wall
      F.box(M.darkwood, 2.4, 0.08, 0.06, 0, FLOOR + 1.95, back - 0.13);
      F.box(M.planks, 1.0, 0.08, 0.3, right - 0.8, FLOOR + 0.55, 0.4); for (const s of [-1, 1]) F.box(M.darkwood, 0.08, 0.55, 0.3, right - 0.8 + s * 0.4, FLOOR + 0.27, 0.4); // sawhorse
      F.cyl(M.logs, 0.25, 0.25, 0.5, left + 0.5, FLOOR + 0.25, 0.4, { seg: 9 }); F.colR(left + 0.5, 0.4, 0.3);
      st('craft', 0, back + 1.4, 'Work at the workbench', 1.8);
      break;
    }
    case 'forge': {
      // the forge: a raised hearth with glowing coals under a hood, an anvil, a quench trough
      F.box(M.stone, 1.6, 0.85, 1.1, 0, FLOOR + 0.43, back + 0.4, { ts: 1.4 }); F.box(COALS, 1.0, 0.06, 0.6, 0, FLOOR + 0.88, back + 0.45);
      F.box(M.stone, 1.4, 0.9, 0.9, 0, FLOOR + 1.9, back + 0.35, { ts: 1.4 }); F.col(0, back + 0.4, 0.8, 0.55);
      out.fire = [0, back + 0.1];
      F.box(M.iron, 0.6, 0.18, 0.22, 0.2, FLOOR + 0.75, 0.6); F.cyl(M.logs, 0.25, 0.28, 0.65, 0.2, FLOOR + 0.32, 0.6, { seg: 9 }); F.colR(0.2, 0.6, 0.35); // anvil on a stump
      F.box(M.planks, 1.2, 0.45, 0.45, right - 0.4, FLOOR + 0.23, back + 0.9); F.box(M.glass, 1.1, 0.02, 0.36, right - 0.4, FLOOR + 0.42, back + 0.9); F.col(right - 0.4, back + 0.9, 0.6, 0.25);
      F.box(C.sack, 0.7, 0.35, 0.5, left + 0.5, FLOOR + 0.2, back + 0.6); // bellows
      for (let i = 0; i < 4; i++) F.box(M.iron, 0.04, 0.5, 0.04, -1 + i * 0.25, FLOOR + 1.5, back - 0.12);
      st('forge', 0, 0.3, 'Work the forge', 2);
      out.glow.push([0, FLOOR + 1.0, back + 0.6]);
      break;
    }
    case 'mill': {
      // a hand-turned millstone pair on a stone bed, a hopper, flour sacks
      F.cyl(M.stone, 0.7, 0.7, 0.35, 0, FLOOR + 0.4, -0.2, { seg: 16 }); F.cyl(M.stone, 0.62, 0.62, 0.22, 0, FLOOR + 0.69, -0.2, { seg: 16 });
      F.cyl(M.darkwood, 0.04, 0.04, 0.6, 0.5, FLOOR + 1.0, -0.2, { seg: 6 }); F.colR(0, -0.2, 0.75);
      F.box(M.planks, 0.5, 0.4, 0.5, 0, FLOOR + 1.15, -0.2, { rx: 0.0 });
      for (let i = 0; i < 2 + L; i++) sack(F, right - 0.4, back + 0.4 + i * 0.5);
      shelf(F, left + 0.2, 0, Math.min(2.4, d - 1.4), Math.PI / 2, 2);
      st('mill', 0, 0.9, 'Grind at the millstones', 1.8);
      break;
    }
    case 'smokehouse': {
      // a smouldering pit with racks of fish and meat hanging above it
      F.cyl(M.stone, 0.6, 0.6, 0.2, 0, FLOOR + 0.1, -0.3, { seg: 12 }); F.cyl(COALS, 0.45, 0.45, 0.05, 0, FLOOR + 0.2, -0.3, { seg: 12 }); F.colR(0, -0.3, 0.65);
      for (let r = 0; r < 2; r++) { F.box(M.darkwood, w - 1, 0.06, 0.06, 0, FLOOR + 1.9, -0.8 + r * 0.9); for (let i = 0; i < 6; i++) F.box(i % 2 ? C.rug : C.sack, 0.1, 0.45, 0.04, -w / 2 + 0.9 + i * ((w - 1.8) / 5), FLOOR + 1.65, -0.8 + r * 0.9); }
      out.fire = [0, back]; st('smokehouse', 0, 0.8, 'Smoke fish and meat', 1.8);
      out.glow.push([0, FLOOR + 0.4, -0.3]);
      break;
    }
    case 'kiln': {
      // a domed clay kiln with a fire mouth, shelves of drying pots
      F.cyl(M.pot, 0.95, 1.05, 1.0, 0, FLOOR + 0.5, back + 0.9, { seg: 14 }); F.cyl(M.pot, 0.0, 0.95, 0.6, 0, FLOOR + 1.3, back + 0.9, { seg: 14 });
      F.box(COALS, 0.45, 0.35, 0.1, 0, FLOOR + 0.25, back + 1.92); F.colR(0, back + 0.9, 1.05);
      out.fire = [0, back + 0.6];
      shelf(F, left + 0.2, 0.4, Math.min(2.4, d - 1.6), Math.PI / 2, 3); jars(F, left + 0.2, 0.4, 5, FLOOR + 0.48, 'z'); jars(F, left + 0.2, 0.4, 4, FLOOR + 0.98, 'z');
      table(F, right - 0.6, 0.6, 0.9, 1.0); F.cyl(M.pot, 0.25, 0.25, 0.1, right - 0.6, FLOOR + 0.84, 0.6, { seg: 12 });
      st('kiln', 0, 0.9, 'Fire pots and tiles in the kiln', 1.8);
      out.glow.push([0, FLOOR + 0.3, back + 1.9]);
      break;
    }
    case 'loom': {
      // an upright loom with cloth half woven, baskets of yarn
      for (const s of [-1, 1]) F.box(M.darkwood, 0.08, 1.9, 0.08, s * 0.8, FLOOR + 0.95, back + 0.8);
      F.box(M.darkwood, 1.8, 0.08, 0.1, 0, FLOOR + 1.85, back + 0.8); F.box(M.darkwood, 1.8, 0.08, 0.1, 0, FLOOR + 0.35, back + 0.8);
      F.box(C.yarn, 1.5, 0.9, 0.02, 0, FLOOR + 0.9, back + 0.8); F.box(C.linen, 1.5, 0.5, 0.02, 0, FLOOR + 1.55, back + 0.8);
      F.col(0, back + 0.8, 0.9, 0.12);
      for (let i = 0; i < 3; i++) { F.cyl(M.thatch, 0.25, 0.2, 0.3, right - 0.5, FLOOR + 0.15, -0.6 + i * 0.6, { seg: 10 }); F.cyl([C.yarn, C.yarn2, C.yarn3][i], 0.18, 0.18, 0.18, right - 0.5, FLOOR + 0.35, -0.6 + i * 0.6, { seg: 10 }); }
      stool(F, 0, back + 1.4);
      st('loom', 0, back + 1.8, 'Spin and weave at the loom', 1.8);
      break;
    }
    case 'apothecary': {
      // shelves of jars, herbs drying from the beams, a mortar on the table
      shelf(F, 0, back, Math.min(3.2, w - 1.6), 0, 3); jars(F, 0, back, 9, FLOOR + 0.48); jars(F, 0, back, 8, FLOOR + 0.98); jars(F, 0, back, 7, FLOOR + 1.48);
      F.col(0, back, Math.min(1.6, w / 2 - 0.8), 0.2);
      for (let i = 0; i < 7; i++) F.cyl(i % 2 ? C.herb : C.sack, 0.07, 0.01, 0.38, -w / 2 + 1 + i * ((w - 2) / 6), FLOOR + H - 0.45, 0.2, { seg: 6 });
      table(F, 0.3, 0.6, 1.2, 0.7); F.cyl(M.stone, 0.12, 0.09, 0.12, 0.3, FLOOR + 0.85, 0.6, { seg: 10 });
      st('apothecary', 0.3, 1.5, 'Prepare remedies', 1.6);
      break;
    }
  }
}
