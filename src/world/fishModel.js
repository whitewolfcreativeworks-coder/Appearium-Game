// Procedural fish: species-specific body shape, fins and painted markings (canvas texture).
// Model is built head toward +x, length 1 (scale by real length).
import * as THREE from 'three';

const SHAPES = {
  // depth: body depth / length; width; snout: 0 round … 1 duck-bill; dorsal: [start, end, height]; tail: fork 0..1
  trout:   { depth: 0.22, width: 0.12, dorsal: [0.42, 0.58, 0.09], adipose: true, tail: 0.15, back: '#5a4a24', side: '#b8963c', belly: '#efe2b8', pattern: 'spots', spotCol: ['#1a1410', '#b8281c'], halo: true, fin: '#9a7a3a' },
  grayling:{ depth: 0.2, width: 0.11, dorsal: [0.32, 0.62, 0.2], adipose: true, tail: 0.5, back: '#4a5058', side: '#a8acb0', belly: '#e8e6e0', pattern: 'fleck', spotCol: ['#2a2a30'], fin: '#6a3a5a', dorsalCol: '#7a3060' },
  salmon:  { depth: 0.22, width: 0.12, dorsal: [0.42, 0.56, 0.08], adipose: true, tail: 0.35, back: '#3a4a5a', side: '#c8d0d6', belly: '#f4f4f2', pattern: 'xspots', spotCol: ['#1a1e24'], fin: '#5a6670' },
  char:    { depth: 0.21, width: 0.12, dorsal: [0.42, 0.56, 0.08], adipose: true, tail: 0.3, back: '#2e3a3a', side: '#6a7a6a', belly: '#e8501c', pattern: 'palespots', spotCol: ['#e8c0a0'], fin: '#c8401c', finEdge: '#ffffff' },
  perch:   { depth: 0.27, width: 0.11, dorsal: [0.38, 0.72, 0.13], spiny: true, tail: 0.25, back: '#3e5a2a', side: '#9cae5a', belly: '#e8e0b0', pattern: 'bars', spotCol: ['#24301a'], fin: '#d8601c' },
  pike:    { depth: 0.14, width: 0.1, snout: 1, dorsal: [0.16, 0.28, 0.08], dorsalBack: true, tail: 0.2, back: '#34401e', side: '#6a7a3a', belly: '#e6e2c8', pattern: 'beans', spotCol: ['#d8d49a'], fin: '#8a6a3a' },
  zander:  { depth: 0.18, width: 0.1, snout: 0.4, dorsal: [0.36, 0.7, 0.11], spiny: true, tail: 0.3, back: '#3a4038', side: '#a8b0a0', belly: '#ecece4', pattern: 'saddles', spotCol: ['#40463c'], fin: '#7a7a6a', bigEye: true },
  roach:   { depth: 0.3, width: 0.1, dorsal: [0.44, 0.58, 0.12], tail: 0.45, back: '#3a4a5a', side: '#c8ccd0', belly: '#f0f0ec', pattern: 'none', fin: '#d84a2a', eye: '#c81c1c' },
  rudd:    { depth: 0.32, width: 0.1, dorsal: [0.36, 0.48, 0.12], tail: 0.45, back: '#5a5a30', side: '#d0b050', belly: '#f0e4b0', pattern: 'none', fin: '#e02a1c', eye: '#e8a020', upturned: true },
  bream:   { depth: 0.4, width: 0.08, dorsal: [0.46, 0.58, 0.14], tail: 0.5, back: '#4a4430', side: '#a8905a', belly: '#d8c8a0', pattern: 'none', fin: '#5a4a3a' },
  tench:   { depth: 0.27, width: 0.13, dorsal: [0.44, 0.58, 0.11], tail: 0.05, back: '#2e3a1e', side: '#5a6a30', belly: '#b0a868', pattern: 'none', fin: '#3a4424', eye: '#c82a1c', round: true },
  carp:    { depth: 0.32, width: 0.13, dorsal: [0.3, 0.7, 0.1], tail: 0.35, back: '#4a4020', side: '#a8843a', belly: '#e8d090', pattern: 'scales', fin: '#7a5a2a', barbels: 2 },
  eel:     { depth: 0.07, width: 0.06, eel: true, back: '#3a3a20', side: '#5a5a30', belly: '#d8cc80', pattern: 'none', fin: '#4a4a2a' },
  // sea
  mackerel:{ depth: 0.18, width: 0.11, dorsal: [0.4, 0.52, 0.07], dorsal2: [0.6, 0.7, 0.05], tail: 0.9, back: '#1e5a5a', side: '#7aa8a8', belly: '#f2f4f2', pattern: 'wavy', spotCol: ['#0e2426'], fin: '#5a7070' },
  sea_bass:{ depth: 0.24, width: 0.11, dorsal: [0.36, 0.5, 0.1], dorsal2: [0.55, 0.7, 0.07], spiny: true, tail: 0.35, back: '#3e4a52', side: '#b8c0c4', belly: '#f0f2f0', pattern: 'none', fin: '#6a7478' },
  cod:     { depth: 0.2, width: 0.13, dorsal: [0.36, 0.48, 0.07], dorsal2: [0.52, 0.66, 0.06], tail: 0.05, back: '#5a5a38', side: '#9a9468', belly: '#ecead8', pattern: 'mottle', spotCol: ['#5a4a2a'], fin: '#7a7454', barbels: 1 },
  flounder:{ depth: 0.46, width: 0.045, dorsal: [0.12, 0.86, 0.04], tail: 0.05, back: '#5a4a34', side: '#7a6a4a', belly: '#7a6a4a', pattern: 'mottle', spotCol: ['#e2c890', '#3a2a1a'], fin: '#6a5a3a', flat: true },
  pollock: { depth: 0.2, width: 0.11, dorsal: [0.3, 0.44, 0.07], dorsal2: [0.5, 0.66, 0.06], tail: 0.25, back: '#4a4a26', side: '#a89a5a', belly: '#e8e2c4', pattern: 'none', fin: '#6a5a3a', snout: 0.3 },
  // canyon rivers
  channel_catfish: { depth: 0.17, width: 0.13, dorsal: [0.62, 0.7, 0.09], adipose: true, tail: 0.7, back: '#4a5058', side: '#8a929a', belly: '#e8e8e2', pattern: 'fleck', spotCol: ['#20242a'], fin: '#5a6068', barbels: 3 },
  rainbow_trout: { depth: 0.22, width: 0.12, dorsal: [0.42, 0.58, 0.09], adipose: true, tail: 0.15, back: '#4a5a3a', side: '#c8c8b8', belly: '#f2efe6', pattern: 'rainbow', spotCol: ['#1a1a1a'], fin: '#8a8a7a' },
  pikeminnow: { depth: 0.16, width: 0.1, snout: 0.6, dorsal: [0.42, 0.54, 0.09], tail: 0.6, back: '#4a5a40', side: '#a8b098', belly: '#ecece2', pattern: 'none', fin: '#8a8a6a' },
  // tropical rivers
  peacock_bass: { depth: 0.28, width: 0.12, dorsal: [0.3, 0.72, 0.12], spiny: true, tail: 0.15, back: '#4a6a2a', side: '#c8b83a', belly: '#f0d8a0', pattern: 'peacock', spotCol: ['#1a2010'], fin: '#c8501c' },
  tilapia: { depth: 0.36, width: 0.1, dorsal: [0.26, 0.74, 0.12], spiny: true, tail: 0.05, back: '#4a5a52', side: '#8a9a90', belly: '#d8dcd0', pattern: 'bars', spotCol: ['#3a4440'], fin: '#7a6a6a' },
  redtail_catfish: { depth: 0.17, width: 0.15, dorsal: [0.6, 0.68, 0.1], adipose: true, tail: 0.4, back: '#2a2a2e', side: '#3a3a3e', belly: '#f2f0e8', pattern: 'band', spotCol: ['#f2efe2'], fin: '#3a3a3e', tailCol: '#d8401c', barbels: 3 },
  burbot:  { depth: 0.14, width: 0.11, dorsal: [0.3, 0.42, 0.06], dorsal2: [0.45, 0.95, 0.07], tail: 0, back: '#3a3020', side: '#7a6a40', belly: '#d8cc9a', pattern: 'mottle', spotCol: ['#2a2014'], fin: '#5a4a2a', barbels: 1 },
};

function paintTexture(sp) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // v: 0 belly → 0.5 back → 1 belly ; u: 0 tail → 1 head
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, sp.belly); grd.addColorStop(0.3, sp.side); grd.addColorStop(0.5, sp.back); grd.addColorStop(0.7, sp.side); grd.addColorStop(1, sp.belly);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const R = (a, b) => a + Math.random() * (b - a);
  const both = (fn) => { fn(false); fn(true); };
  const yy = (v, mirror) => (mirror ? (1 - v) : v) * H;
  switch (sp.pattern) {
    case 'spots': case 'xspots': case 'fleck': case 'palespots':
      both((m) => { for (let i = 0; i < (sp.pattern === 'fleck' ? 50 : 70); i++) {
        const u = R(0.1, 0.92), v = R(0.32, 0.5); const col = sp.spotCol[Math.random() < 0.25 && sp.spotCol[1] ? 1 : 0];
        const x = u * W, y = yy(v, m), r = sp.pattern === 'fleck' ? R(1.5, 3) : R(3, 6);
        if (sp.halo) { g.fillStyle = 'rgba(240,230,200,0.6)'; g.beginPath(); g.arc(x, y, r + 2.5, 0, 7); g.fill(); }
        g.fillStyle = col;
        if (sp.pattern === 'xspots') { g.font = `${r * 3}px sans-serif`; g.fillText('x', x, y); } else { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      } });
      break;
    case 'bars':
      both((m) => { for (let i = 0; i < 7; i++) { const u = 0.25 + i * 0.09; g.fillStyle = sp.spotCol[0]; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(u * W, yy(0.5, m)); g.lineTo((u + 0.04) * W, yy(0.5, m)); g.lineTo((u + 0.02) * W, yy(0.24, m)); g.lineTo((u - 0.01) * W, yy(0.24, m)); g.fill(); g.globalAlpha = 1; } });
      break;
    case 'saddles':
      both((m) => { for (let i = 0; i < 9; i++) { g.fillStyle = sp.spotCol[0]; g.globalAlpha = 0.45; g.fillRect((0.15 + i * 0.08) * W, yy(0.5, m) - (m ? 0 : 40), 18, 40); g.globalAlpha = 1; } });
      break;
    case 'beans':
      both((m) => { for (let i = 0; i < 80; i++) { g.fillStyle = sp.spotCol[0]; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(R(0.05, 0.9) * W, yy(R(0.28, 0.48), m), R(4, 8), R(2, 3.5), R(0, 3), 0, 7); g.fill(); g.globalAlpha = 1; } });
      break;
    case 'mottle':
      for (let i = 0; i < 160; i++) { g.fillStyle = sp.spotCol[0]; g.globalAlpha = 0.35; g.beginPath(); g.arc(R(0, W), R(H * 0.2, H * 0.8), R(4, 12), 0, 7); g.fill(); g.globalAlpha = 1; }
      break;
    case 'wavy':
      both((m) => { g.strokeStyle = sp.spotCol[0]; g.lineWidth = 5; for (let i = 0; i < 22; i++) { const u = 0.1 + i * 0.037; g.beginPath(); g.moveTo(u * W, yy(0.5, m)); for (let k = 1; k <= 6; k++) g.lineTo((u + Math.sin(k * 1.4 + i) * 0.012) * W, yy(0.5 - k * 0.028, m)); g.stroke(); } });
      break;
    case 'rainbow':
      both((m) => { g.fillStyle = 'rgba(214,80,110,0.55)'; g.fillRect(0.05 * W, yy(0.4, m) - 9, 0.85 * W, 18);
        for (let i = 0; i < 90; i++) { g.fillStyle = sp.spotCol[0]; g.beginPath(); g.arc(R(0.05, 0.92) * W, yy(R(0.35, 0.5), m), R(1.5, 3), 0, 7); g.fill(); } });
      break;
    case 'peacock':
      both((m) => { for (let i = 0; i < 3; i++) { g.fillStyle = sp.spotCol[0]; g.globalAlpha = 0.65; g.fillRect((0.35 + i * 0.16) * W, yy(0.5, m) - (m ? 0 : 70), 22, 70); g.globalAlpha = 1; }
        g.fillStyle = '#e8a020'; g.beginPath(); g.arc(0.06 * W, yy(0.42, m), 12, 0, 7); g.fill(); g.fillStyle = '#101010'; g.beginPath(); g.arc(0.06 * W, yy(0.42, m), 7, 0, 7); g.fill(); });
      break;
    case 'band':
      both((m) => { g.fillStyle = sp.spotCol[0]; g.fillRect(0.12 * W, yy(0.3, m) - (m ? 0 : 14), 0.82 * W, 14); });
      break;
    case 'scales':
      g.strokeStyle = 'rgba(60,40,10,0.35)'; g.lineWidth = 1.2;
      for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 ? 6 : 0; x < W; x += 12) { g.beginPath(); g.arc(x, y, 7, 0.2, Math.PI - 0.2); g.stroke(); }
      break;
  }
  // lateral line + sheen
  g.strokeStyle = 'rgba(30,30,30,0.25)'; g.lineWidth = 1.5;
  for (const v of [0.36, 0.64]) { g.beginPath(); g.moveTo(0.05 * W, v * H); g.quadraticCurveTo(0.6 * W, (v + (v < 0.5 ? -0.05 : 0.05)) * H, 0.88 * W, v * H); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const cache = new Map();
export function buildFish(id) {
  if (cache.has(id)) return cache.get(id).clone();
  const sp = SHAPES[id];
  const group = new THREE.Group();
  const N = 40, M = 18;
  const pos = [], uv = [], idx = [];
  const prof = (t) => { // t: 0 tail … 1 head → [half-height, half-width, yOffset]
    if (sp.eel) { const k = Math.min(1, t * 6) * (t > 0.92 ? Math.sqrt((1 - t) / 0.08) : 1); return [sp.depth / 2 * k, sp.width / 2 * k, 0]; }
    const peak = sp.round ? 0.55 : 0.6;
    let h = t < peak ? Math.pow(t / peak, 0.8) : Math.sqrt(Math.max(0, 1 - Math.pow((t - peak) / (1 - peak), 2)));
    h = 0.12 + 0.88 * h;
    if (t < 0.1) h *= 0.35 + t * 6.5;
    let hh = sp.depth / 2 * h, ww = sp.width / 2 * h;
    if (sp.snout && t > 0.82) { hh *= 1 - (t - 0.82) * 2.5 * sp.snout; ww *= 1 - (t - 0.82) * 1.2 * sp.snout; }
    return [hh, ww, (sp.upturned && t > 0.85 ? (t - 0.85) * 0.05 : 0)];
  };
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = t - 0.5, [hh, ww, yo] = prof(t);
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI * 2 - Math.PI / 2; // start at belly
      pos.push(x, Math.sin(a) * hh + yo - hh * 0.1 * Math.max(0, Math.sin(a) < 0 ? 1 : 0), Math.cos(a) * ww);
      uv.push(t, j / M);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); body.setIndex(idx); body.computeVertexNormals();
  const bodyMat = new THREE.MeshStandardMaterial({ map: paintTexture(sp), roughness: 0.35, metalness: 0.15 });
  const bm = new THREE.Mesh(body, bodyMat); group.add(bm);
  const finMat = new THREE.MeshStandardMaterial({ color: sp.fin, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const fin = (pts, mat = finMat) => { const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat); group.add(m); return m; };
  const topAt = (t) => prof(t)[0];
  if (sp.eel) {
    fin([[-0.5, 0], [-0.1, topAt(0.4) + 0.025], [0.15, topAt(0.65) + 0.012], [0.15, topAt(0.65) - 0.01], [-0.5, -0.01]]);
    fin([[-0.5, 0], [-0.05, -topAt(0.45) - 0.02], [0.05, -topAt(0.55)], [-0.5, 0.01]]);
  } else {
    // tail
    const f = sp.tail; fin([[-0.46, 0.02], [-0.56, 0.13 + f * 0.02], [-0.53 + f * 0.04, 0], [-0.56, -0.13 - f * 0.02], [-0.46, -0.02]], sp.tailCol ? new THREE.MeshStandardMaterial({ color: sp.tailCol, side: THREE.DoubleSide, roughness: 0.6 }) : finMat);
    if (sp.flat) fin([[0.36 - 0.5, -topAt(0.36) + 0.005], [0.5 - 0.5, -topAt(0.5) - 0.035], [0.86 - 0.5, -topAt(0.86) - 0.02], [0.86 - 0.5, -topAt(0.86) + 0.005]]); // long fringe below as well
    // dorsal
    const [d0, d1, dh] = sp.dorsal;
    const dm = fin([[d0 - 0.5, topAt(d0) - 0.005], [d0 - 0.5 + (d1 - d0) * 0.25, topAt(d0) + dh], [d1 - 0.5, topAt(d1) + dh * (sp.spiny ? 0.5 : 0.3)], [d1 - 0.5, topAt(d1) - 0.005]], sp.dorsalCol ? new THREE.MeshStandardMaterial({ color: sp.dorsalCol, side: THREE.DoubleSide, roughness: 0.6 }) : finMat);
    if (sp.dorsalBack) dm.position.x = 0; // pike: dorsal set far back (positions already reflect it)
    if (sp.dorsal2) { const [e0, e1, eh] = sp.dorsal2; fin([[e0 - 0.5, topAt(e0)], [e0 - 0.5 + 0.03, topAt(e0) + eh], [e1 - 0.5, topAt(e1) + eh * 0.5], [e1 - 0.5, topAt(e1)]]); }
    if (sp.adipose) fin([[-0.32, topAt(0.18)], [-0.3, topAt(0.18) + 0.025], [-0.27, topAt(0.2)]]);
    // anal fin, pelvic & pectoral fins
    fin([[-0.32, -topAt(0.18) + 0.005], [-0.27, -topAt(0.2) - 0.06], [-0.18, -topAt(0.3)]]);
    for (const s of [-1, 1]) {
      const pel = fin([[0.0, -topAt(0.5) * 0.8], [-0.05, -topAt(0.5) - 0.05], [0.04, -topAt(0.5) * 0.9]]); pel.position.z = s * sp.width * 0.3;
      const pec = fin([[0.28, -topAt(0.78) * 0.4], [0.18, -topAt(0.78) * 0.8], [0.26, -topAt(0.78) * 0.2]]); pec.position.z = s * sp.width * 0.48; pec.rotation.x = s * 0.5;
    }
  }
  // eyes
  const er = sp.bigEye ? 0.022 : 0.016;
  for (const s of [-1, 1]) {
    const eyeX = sp.eel ? 0.46 : 0.4 - (sp.snout ? 0.04 : 0);
    const [hh, ww] = prof(eyeX + 0.5);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(er, 14), new THREE.MeshStandardMaterial({ color: sp.eye || '#c8b070', roughness: 0.3, metalness: 0.3 }));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(er * 0.55, 12), new THREE.MeshStandardMaterial({ color: '#060606', roughness: 0.1 }));
    iris.position.set(eyeX, hh * 0.3, s * ww * 0.92); iris.rotation.y = s > 0 ? 0 : Math.PI;
    if (sp.flat) { iris.position.set(eyeX - (s > 0 ? 0 : 0.03), hh * (s > 0 ? 0.15 : 0.45), ww * 0.95); iris.rotation.y = 0; } // a flatfish: both eyes on the upper side
    pupil.position.copy(iris.position).add(new THREE.Vector3(0, 0, (sp.flat ? 1 : s) * 0.001)); pupil.rotation.copy(iris.rotation);
    group.add(iris, pupil);
  }
  if (sp.barbels) for (const s of [-1, 1]) for (let b = 0; b < sp.barbels; b++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.003, 0.04, 4), finMat); bar.position.set(0.49 - b * 0.02, -0.015, s * 0.012 * (sp.barbels > 1 ? 1 : 0)); bar.rotation.z = 0.9; group.add(bar);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  cache.set(id, group);
  return group.clone();
}
export const FISH_SHAPES = SHAPES;
