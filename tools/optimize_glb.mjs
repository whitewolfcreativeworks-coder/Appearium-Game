// Usage: node tools/optimize_glb.mjs in.gltf out.glb <simplifyRatio> <textureSize>
// Welds, simplifies (meshoptimizer), resizes textures (sharp), converts opaque
// textures to JPEG, and writes a meshopt-compressed GLB.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, dedup, join, quantize, reorder, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , src, out, ratioArg = "0.5", sizeArg = "512", errArg = "0.02"] = process.argv;
const ratio = parseFloat(ratioArg), size = parseInt(sizeArg, 10);

await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);

// Which textures need alpha?
const alphaTex = new Set();
for (const m of doc.getRoot().listMaterials()) {
  if (m.getAlphaMode() !== 'OPAQUE' && m.getBaseColorTexture()) alphaTex.add(m.getBaseColorTexture());
}
const hasAnim = doc.getRoot().listAnimations().length > 0;

await doc.transform(
  dedup(), prune(),
  ...(hasAnim ? [resample()] : [weld(), ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: parseFloat(errArg), lockBorder: false })] : []), join()]),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [size, size], quality: 84,
    pattern: undefined, slots: /^(?!baseColor).*$/ }),
);
// base colour: jpeg unless it needs alpha
for (const t of doc.getRoot().listTextures()) {
  if (t.getMimeType() !== 'image/png') continue;
  const keepPng = alphaTex.has(t);
  let img = sharp(Buffer.from(t.getImage())).resize(size, size, { fit: 'inside' });
  if (keepPng) { t.setImage(new Uint8Array(await img.png({ compressionLevel: 9, palette: false }).toBuffer())); }
  else { t.setImage(new Uint8Array(await img.jpeg({ quality: 84 }).toBuffer())); t.setMimeType('image/jpeg'); t.setURI(''); }
}
await doc.transform(prune(), reorder({ encoder: MeshoptEncoder }), quantize());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out, doc);
