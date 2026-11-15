// Steering wheel for the driver roll call: node build-wheel.mjs <in.glb> <out.glb> [--report]
// Source: "McLaren Formula 1 Steering Wheel" by dhimasdc9 (Sketchfab, CC BY 4.0).
// The file carries no team marks. This script only makes it light and gives the site what it needs to find:
//   - purple parts and purple-blue print become the site's own colours (the site uses no purple)
//   - the parts the page drives get plain names: SCREEN (replaced by the live dash), LEDS_TOP (the shift lights),
//     KNOB_MID (turns one click per driver), BUTTONS (the caps the page puts a ring round)
//   - geometry is welded and simplified, textures go to WebP, everything is meshopt-compressed
// --report prints where the round caps of BUTTONS sit, for choosing which ones the roll call lights.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();

// colours
const RED = [0.535, 0.006, 0.013, 1]; // #c1121f in linear
const YELLOW = [1, 0.672, 0.003, 1]; // #ffd60a
for (const m of root.listMaterials()) {
  if (m.getName() === 'toggle2') m.setBaseColorFactor(RED);
  if (m.getName() === 'knob_purple') m.setBaseColorFactor(YELLOW);
}
// print: anything between blue-violet and magenta is turned to a clean blue
for (const t of root.listTextures()) {
  const img = sharp(t.getImage()).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.12) continue;
    let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    if (hue < 222 || hue > 320) continue;
    // same lightness and saturation, hue 205
    const l = (mx + mn) / 2, s = d / (1 - Math.abs(2 * l - 1)), c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((205 / 60) % 2) - 1)), m0 = l - c / 2;
    data[i] = Math.round((0 + m0) * 255);
    data[i + 1] = Math.round((x + m0) * 255);
    data[i + 2] = Math.round((c + m0) * 255);
    changed++;
  }
  if (changed) t.setImage(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
}

// names the page looks for
const NAMES = { 'Plane.014_screen_0': 'SCREEN', 'Circle.003_led_indicator_top_0': 'LEDS_TOP', 'Circle.006_knob_0': 'KNOB_MID', 'Plane.011_buttons_0': 'BUTTONS', 'Plane.013_glass_0': 'GLASS' };
for (const n of root.listNodes()) if (NAMES[n.getName()]) n.setName(NAMES[n.getName()]);

await doc.transform(dedup(), weld());

if (process.argv.includes('--report')) {
  // the caps of BUTTONS: groups of triangles that share vertices, with their centre and size in the model's own frame
  const node = root.listNodes().find((n) => n.getName() === 'BUTTONS');
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
  const world = node.getWorldMatrix();
  const at = (i) => { const p = pos.getElement(i, []); return [world[0] * p[0] + world[4] * p[1] + world[8] * p[2] + world[12], world[1] * p[0] + world[5] * p[1] + world[9] * p[2] + world[13], world[2] * p[0] + world[6] * p[1] + world[10] * p[2] + world[14]]; };
  // vertices at the same place count as one, whatever their normals
  const key = new Map(), parent = [];
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const ids = [];
  for (let i = 0; i < pos.getCount(); i++) { const p = at(i); const k = p.map((v) => Math.round(v * 400)).join(','); if (!key.has(k)) { key.set(k, parent.length); parent.push(parent.length); } ids[i] = key.get(k); }
  for (let i = 0; i < idx.getCount(); i += 3) { const a = find(ids[idx.getScalar(i)]), b = find(ids[idx.getScalar(i + 1)]), c = find(ids[idx.getScalar(i + 2)]); parent[b] = a; parent[c] = a; }
  const boxes = new Map();
  for (let i = 0; i < pos.getCount(); i++) { const r = find(ids[i]), p = at(i); const b = boxes.get(r) ?? { min: [9, 9, 9], max: [-9, -9, -9], n: 0 }; for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], p[k]); b.max[k] = Math.max(b.max[k], p[k]); } b.n++; boxes.set(r, b); }
  const all = getBounds(root.listScenes()[0]);
  console.log('model box', all.min.map((v) => v.toFixed(2)).join(','), '..', all.max.map((v) => v.toFixed(2)).join(','));
  [...boxes.values()].map((b) => ({ x: (b.min[0] + b.max[0]) / 2, y: (b.min[1] + b.max[1]) / 2, w: b.max[0] - b.min[0], h: b.max[1] - b.min[1], n: b.n })).sort((a, b) => b.y - a.y || a.x - b.x).forEach((b) => console.log(`cap at x ${b.x.toFixed(3)} y ${b.y.toFixed(3)}  size ${b.w.toFixed(2)} x ${b.h.toFixed(2)}  (${b.n} vertices)`));
}

await doc.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.0015 }),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 86 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
await io.write(out, doc);
console.log('wrote', out, Math.round(tris / 1000) + 'k triangles');
