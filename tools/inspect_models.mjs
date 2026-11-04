// Prints bounds / triangle counts of the optimised models (dev helper).
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { readdirSync } from 'fs';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of readdirSync('../assets/models')) {
  const d = await io.read('../assets/models/' + f); const b = getBounds(d.getRoot().listScenes()[0]);
  let tris = 0; for (const m of d.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
  const mats = d.getRoot().listMaterials().map(m => m.getName() + ':' + m.getAlphaMode()).join(',');
  console.log(f.padEnd(28), 'min', b.min.map(v => v.toFixed(2)).join(','), ' max', b.max.map(v => v.toFixed(2)).join(','), ' tris', tris | 0, ' meshes', d.getRoot().listMeshes().length, mats);
}
