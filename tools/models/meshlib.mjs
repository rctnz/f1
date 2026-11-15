// helpers shared by the model build scripts: connected components and triangle subsets of a primitive

/** connected components of a primitive, welded by position; biggest first */
export function components(prim) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices() ? prim.getIndices().getArray() : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  const nv = pos.length / 3;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { const v = pos[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  const ext = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const q = 1 / (ext * 2e-5);
  const map = new Map(); const rep = new Uint32Array(nv);
  for (let i = 0; i < nv; i++) {
    const key = Math.round((pos[i * 3] - min[0]) * q) + '_' + Math.round((pos[i * 3 + 1] - min[1]) * q) + '_' + Math.round((pos[i * 3 + 2] - min[2]) * q);
    let r = map.get(key); if (r === undefined) { r = i; map.set(key, r); } rep[i] = r;
  }
  const parent = new Uint32Array(nv); for (let i = 0; i < nv; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (let t = 0; t < idx.length; t += 3) { const a = rep[idx[t]], b = rep[idx[t + 1]], c = rep[idx[t + 2]]; uni(a, b); uni(a, c); }
  const comps = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(rep[idx[t]]);
    let c = comps.get(r); if (!c) { c = { tris: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; comps.set(r, c); }
    c.tris.push(t);
    for (let j = 0; j < 3; j++) { const v = idx[t + j]; for (let k = 0; k < 3; k++) { const p = pos[v * 3 + k]; if (p < c.min[k]) c.min[k] = p; if (p > c.max[k]) c.max[k] = p; } }
  }
  return { list: [...comps.values()].sort((a, b) => b.tris.length - a.tris.length), idx };
}

/** a new, compact primitive holding only the given triangles (offsets into idx) of prim */
export function subPrim(doc, prim, tris, idx) {
  const buffer = doc.getRoot().listBuffers()[0];
  const used = new Map(); const newIdx = new Uint32Array(tris.length * 3);
  let n = 0;
  tris.forEach((t, i) => { for (let j = 0; j < 3; j++) { const v = idx[t + j]; let m = used.get(v); if (m === undefined) { m = n++; used.set(v, m); } newIdx[i * 3 + j] = m; } });
  const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem); const size = acc.getElementSize(); const arr = acc.getArray();
    const outArr = new arr.constructor(n * size);
    for (const [v, m] of used) for (let k = 0; k < size; k++) outArr[m * size + k] = arr[v * size + k];
    p.setAttribute(sem, doc.createAccessor().setType(acc.getType()).setArray(outArr).setNormalized(acc.getNormalized()).setBuffer(buffer));
  }
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(newIdx).setBuffer(buffer));
  return p;
}

/** triangle offsets of prim whose three UVs all fall inside one of the rects [u0, v0, u1, v1] */
export function trisInUV(prim, rects) {
  const uv = prim.getAttribute('TEXCOORD_0')?.getArray();
  const idx = prim.getIndices() ? prim.getIndices().getArray() : Uint32Array.from({ length: prim.getAttribute('POSITION').getCount() }, (_, i) => i);
  const keep = [];
  if (!uv) return { keep, idx };
  const fr = (v) => v - Math.floor(v);
  for (let t = 0; t < idx.length; t += 3) {
    const ok = rects.some(([u0, v0, u1, v1]) => [0, 1, 2].every((j) => { const u = fr(uv[idx[t + j] * 2]), v = fr(uv[idx[t + j] * 2 + 1]); return u >= u0 && u <= u1 && v >= v0 && v <= v1; }));
    if (ok) keep.push(t);
  }
  return { keep, idx };
}

export const triCount = (root) => { let t = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; return Math.round(t); };
