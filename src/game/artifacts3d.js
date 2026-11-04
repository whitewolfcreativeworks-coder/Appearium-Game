// Builds a small 3D object for an artifact so discoveries can be displayed in the village Hall.
import * as THREE from 'three';
import { prop } from '../world/structures.js';
import { buildCrystals } from '../world/vegetation.js';
import { tex } from '../core/assets.js';

const stoneMat = () => new THREE.MeshStandardMaterial({ map: tex('terrain/rock_face_diff.jpg'), normalMap: tex('terrain/rock_face_nor.jpg', { srgb: false }), roughness: 0.9 });
const woodMat = () => new THREE.MeshStandardMaterial({ map: tex('build/weathered_planks_diff.jpg'), roughness: 0.8, color: 0xc9a27a });
const brass = new THREE.MeshStandardMaterial({ color: 0xb08d4a, metalness: 0.9, roughness: 0.35 });
const bone = new THREE.MeshStandardMaterial({ color: 0xe0d6c2, roughness: 0.6 });

export function buildArtifactMesh(a) {
  const g = new THREE.Group();
  const s = a.scale || 1;
  switch (a.type) {
    case 'vessel': g.add(prop('ceramic_vase_01', { tint: a.tint })); g.scale.setScalar(1.1 * s); break;
    case 'amphora': g.add(prop('antique_ceramic_vase_01', { tint: a.tint })); g.scale.setScalar(0.95 * s); break;
    case 'brass': g.add(prop('brass_vase_01', { tint: a.tint })); g.scale.setScalar(0.7 * s); break;
    case 'tool': { const p = prop('wooden_axe'); p.rotation.z = Math.PI / 2.3; p.position.y = 0.08; g.add(p); g.scale.setScalar(0.85); break; }
    case 'rune': {
      const geo = new THREE.DodecahedronGeometry(0.16, 1); geo.scale(0.8, 1.5, 0.45);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 1.7) * 0.06), p.getY(i), p.getZ(i));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, stoneMat()); m.position.y = 0.22; g.add(m);
      const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 20, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x6fb6ff, emissiveIntensity: 0.6 }));
      glyph.position.set(0, 0.25, 0.075); g.add(glyph);
      break;
    }
    case 'figurine': {
      const mat = woodMat();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 4, 10), mat); body.rotation.z = Math.PI / 2; body.position.y = 0.09;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 8), mat); head.rotation.z = -Math.PI / 2; head.position.set(0.12, 0.12, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 16), mat); base.position.y = 0.015;
      for (const x of [-0.05, 0.05]) for (const z of [-0.025, 0.025]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.06, 6), mat); l.position.set(x, 0.045, z); g.add(l); }
      g.add(body, head, base);
      break;
    }
    case 'geode': {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), stoneMat()); rock.scale.set(1, 0.7, 1); rock.position.y = 0.08;
      const col = { Quartz: 0xe8eef2, Amethyst: 0x7a48b0, 'Smoky quartz': 0x6a5a50, Citrine: 0xe0a83a, Agate: 0xb46a5a }[a.mineral] || 0xcccccc;
      const c = new THREE.Mesh(buildCrystals(7, col), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, emissive: 0x111111 }));
      c.scale.setScalar(0.5); c.position.y = 0.1; g.add(rock, c);
      break;
    }
    case 'amulet': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24), brass); ring.position.y = 0.1;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(a.hue, 0.6, 0.4), roughness: 0.1, emissive: new THREE.Color().setHSL(a.hue, 0.6, 0.15) }));
      gem.position.y = 0.1; const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.03, 0.05, 8), woodMat()); stand.position.y = 0.025;
      g.add(ring, gem, stand);
      break;
    }
    case 'flute': {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.26, 10), bone); f.rotation.z = Math.PI / 2; f.position.y = 0.03;
      for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 6), new THREE.MeshBasicMaterial({ color: 0x221a10 })); h.position.set(-0.07 + i * 0.03, 0.045, 0); g.add(h); }
      g.add(f); break;
    }
    case 'compass': {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), brass); d.position.y = 0.03;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.058, 24), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 })); face.rotation.x = -Math.PI / 2; face.position.y = 0.041;
      const needle = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.09, 4), new THREE.MeshStandardMaterial({ color: 0x8a1c1c })); needle.rotation.x = Math.PI / 2; needle.position.y = 0.045;
      g.add(d, face, needle); break;
    }
    default: g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), brass));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
