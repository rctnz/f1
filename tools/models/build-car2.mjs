// second car model (Sketchfab GLB) -> public/models/car.glb
//   node build-car2.mjs <car.glb> <cleaned textures dir> <out.glb> [detail 0..1]
// Brand decals removed (only A10 kept where the race number was), cleaned textures swapped in, the rear wing
// split off the floor mesh so the exploded view can move it, then simplified and compressed.
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplifyPrimitive, textureCompress, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { components, subPrim, trisInUV, triCount } from './meshlib.mjs';

const [src, tex, out, detailArg = '1'] = process.argv.slice(2);
const DETAIL = Number(detailArg);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const before = triCount(root);

// 1. decals: drop every brand mark; keep only the triangles that carried the race number
// (the second, smaller number sat half behind the rear tyre and read as a broken word, so only the nose keeps one;
//  the engine cover carries A10 in its paint)
const NUMBER_UV = [[40 / 2048, 280 / 2048, 452 / 2048, 536 / 2048]];
let kept = 0, gone = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const m = p.getMaterial()?.getName();
  if (m === 'DECALS_2') { mesh.removePrimitive(p); gone++; continue; }
  if (m !== 'DECALS_1') continue;
  const { keep, idx } = trisInUV(p, NUMBER_UV);
  mesh.removePrimitive(p); gone++;
  if (keep.length) { mesh.addPrimitive(subPrim(doc, p, keep, idx)); kept += keep.length; }
}
console.log('decal prims removed', gone, 'number triangles kept', kept);

// 2. cleaned textures
const swap = (matName, file) => {
  const m = root.listMaterials().find((x) => x.getName() === matName);
  if (!m) { console.log('no material', matName); return; }
  m.getBaseColorTexture().setImage(fs.readFileSync(`${tex}/${file}`)).setMimeType('image/png').setURI('').setName(file.replace('.png', ''));
};
swap('CAR_CHASSIS', 'chassis.png');
swap('TIRE_SIDES', 'tyre.png');       // TIRE_TREAD shares this texture
swap('RIM_COVER', 'rim.png');
swap('WHEEL_NUTS', 'nut.png');
swap('SEATBELT_DECAL', 'belt.png');
swap('SW_DECALS', 'swdecals.png');    // SW_LEDS shares it
swap('COCKPIT_DECALS', 'cockpitdecals.png');
swap('DECALS_1', 'decals_a10.png');
root.listTextures().forEach((t, i) => { if (!t.getName()) t.setName('t' + i); });

// 3. rear wing: the pieces of the big carbon mesh that sit wholly in the last 0.6 m become their own node
for (const node of root.listNodes()) {
  if (node.getName() !== 'CAR_CARBON_76') continue;
  const holder = node.listChildren().find((c) => c.getMesh()) || node;
  const mesh = holder.getMesh();
  for (const prim of mesh.listPrimitives()) {
    const { list, idx } = components(prim);
    const rear = [], rest = [];
    for (const c of list) (c.max[1] < -3.7 ? rear : rest).push(...c.tris);
    if (!rear.length) continue;
    mesh.removePrimitive(prim);
    mesh.addPrimitive(subPrim(doc, prim, rest, idx));
    holder.addChild(doc.createNode('RWING').setMesh(doc.createMesh('RWING').addPrimitive(subPrim(doc, prim, rear, idx))));
    console.log('rear wing split:', rear.length, 'triangles, floor keeps', rest.length);
  }
}

// 3b. metal fittings are one mesh spread over the whole car: file each piece with the wing it sits on,
//     so nothing is left hanging in the air when the car comes apart (world z: the nose is at +2.8, the tail at -2.75)
for (const node of root.listNodes()) {
  if (node.getName() !== 'METAL_80') continue;
  const holder = node.listChildren().find((c) => c.getMesh()) || node;
  const mesh = holder.getMesh();
  const m = holder.getWorldMatrix();
  const worldZ = (c) => { const x = (c.min[0] + c.max[0]) / 2, y = (c.min[1] + c.max[1]) / 2, z = (c.min[2] + c.max[2]) / 2; return m[2] * x + m[6] * y + m[10] * z + m[14]; };
  for (const prim of mesh.listPrimitives()) {
    const { list, idx } = components(prim);
    const F = [], R = [], M = [];
    for (const c of list) { const z = worldZ(c); (z > 1.9 ? F : z < -2.1 ? R : M).push(...c.tris); }
    mesh.removePrimitive(prim);
    if (M.length) mesh.addPrimitive(subPrim(doc, prim, M, idx));
    if (F.length) holder.addChild(doc.createNode('METAL_F').setMesh(doc.createMesh('METAL_F').addPrimitive(subPrim(doc, prim, F, idx))));
    if (R.length) holder.addChild(doc.createNode('METAL_R').setMesh(doc.createMesh('METAL_R').addPrimitive(subPrim(doc, prim, R, idx))));
    console.log('metal fittings: front', F.length, 'rear', R.length, 'middle', M.length);
  }
}

// 4. names three.js will not have to sanitise
for (const n of root.listNodes()) n.setName(n.getName().replace(/[^A-Za-z0-9_]/g, '_'));

// 5. weld, then simplify by how close the camera ever gets to each part
await doc.transform(dedup(), prune(), weld());
const ratioFor = (path) => {
  if (/STEER_HR/.test(path)) return 0.22;
  if (/COCKPIT_HR|CINTURE/.test(path)) return 0.4;
  if (/HUB_|SUSP_LR|SUSP_RR|WHEEL_/.test(path)) return 0.5;
  if (/CAR_CHASSIS_229|HALO|FRONT_186|FWING/.test(path)) return 0.85;
  return 0.65;
};
const pathOf = (node) => { const names = []; let n = node; while (n && n.propertyType === 'Node') { names.push(n.getName()); n = n.getParentNode(); } return names.join('/'); };
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const ratio = Math.min(1, ratioFor(pathOf(node)) * DETAIL);
  for (const p of mesh.listPrimitives()) {
    const n = (p.getIndices()?.getCount() ?? 0) / 3;
    if (n < 400 || ratio >= 1) continue;
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.0008, lockBorder: false });
  }
}

// 6. textures and geometry compression (geometry last)
await doc.transform(
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /chassis/, resize: [2048, 2048], quality: 84 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /tyre|decals_a10/, resize: [1024, 1024], quality: 82 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(out, doc);
console.log('tris', before, '->', triCount(root), 'size', (fs.statSync(out).size / 1048576).toFixed(2), 'MB', 'bounds', JSON.stringify(getBounds(root.listScenes()[0])));
