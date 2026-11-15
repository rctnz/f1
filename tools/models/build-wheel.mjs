// steering wheel (one baked mesh) -> public/models/wheel.glb with one node per layer of the exploded view
//   node build-wheel.mjs <wheel.glb> <out.glb> [detail 0..1]
// The mesh is split into its connected shells, and each shell is filed under a layer by where it sits:
//   screen, body, controls (buttons, toggles, thumb wheels), dials (the three big rotaries), grips, paddles, hub.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplifyPrimitive, joinPrimitives, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { components, subPrim, triCount } from './meshlib.mjs';

const [src, out, detailArg = '1'] = process.argv.slice(2);
const DETAIL = Number(detailArg);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const before = triCount(root);

const holder = root.listNodes().find((n) => n.getMesh());
const mesh = holder.getMesh();
const prim = mesh.listPrimitives()[0];
const { list, idx } = components(prim);

// mesh space: x across the wheel, +y out of the face towards the driver, -z towards the top of the wheel
const layerOf = (c, i) => {
  const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2;
  const ex = c.max[0] - c.min[0], ey = c.max[1] - c.min[1], ez = c.max[2] - c.min[2];
  if (ey < 0.002 && ex > 0.8) return 'screen';
  if (i === 0) return 'body';
  if (c.max[1] < 0.26) return ex > 0.9 || Math.abs(cx) > 0.3 ? 'paddles' : 'hub';
  if (Math.abs(cx) > 1.0 && (ez > 0.9 || (c.max[2] < -0.1 && ey > 0.3))) return 'grips';
  if (cz > 0.3 && Math.abs(cx) < 0.6 && c.max[1] > 0.5 && ex < 0.3) return 'dials';
  return 'controls';
};
const layers = {};
list.forEach((c, i) => { const k = layerOf(c, i); (layers[k] ||= { tris: [], n: 0, min: [9, 9, 9], max: [-9, -9, -9] }); const L = layers[k]; L.tris.push(...c.tris); L.n++; for (let a = 0; a < 3; a++) { L.min[a] = Math.min(L.min[a], c.min[a]); L.max[a] = Math.max(L.max[a], c.max[a]); } });
mesh.removePrimitive(prim);
holder.setMesh(null);
const RATIO = { screen: 1, body: 0.75, controls: 0.5, dials: 0.6, grips: 0.6, paddles: 0.5, hub: 0.3 };
for (const [name, L] of Object.entries(layers)) {
  const p = subPrim(doc, prim, L.tris, idx);
  holder.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)));
  console.log(name.padEnd(9), String(L.n).padStart(3), 'shells', String(L.tris.length).padStart(6), 'tris  x', L.min[0].toFixed(2), L.max[0].toFixed(2), 'y', L.min[1].toFixed(2), L.max[1].toFixed(2), 'z', L.min[2].toFixed(2), L.max[2].toFixed(2));
}
root.listTextures().forEach((t, i) => t.setName(['base', 'mr', 'normal'][i] || 't' + i));

await doc.transform(dedup(), prune(), weld());
for (const node of root.listNodes()) {
  const m = node.getMesh(); if (!m) continue;
  const ratio = Math.min(1, (RATIO[node.getName()] ?? 0.6) * DETAIL);
  for (const p of m.listPrimitives()) if (ratio < 1 && (p.getIndices()?.getCount() ?? 0) / 3 > 200) simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.0006, lockBorder: false });
}
await doc.transform(
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(out, doc);
console.log('tris', before, '->', triCount(root), 'size', (fs.statSync(out).size / 1048576).toFixed(2), 'MB', 'bounds', JSON.stringify(getBounds(root.listScenes()[0])));
