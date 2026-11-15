# How the 3D models were prepared

The files in `public/models/` are built from the two GLB files the team supplied (`car.glb`, `sterring wheel.glb`).
The originals are not in the repo. To rebuild after changing a model or the livery:

```bash
# once, in an empty folder next to the originals
npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
pip install pillow
```

**Car**

1. Dump the textures of the original (any glTF tool; the scripts expect them numbered `00.png` … `44.png` in texture order).
2. `python car2tex.py <textures dir> <out dir> <this folder>` cleans the livery: every real brand mark comes off,
   `A10` goes on the engine cover, the tyre lettering is painted out and the lime details become the site's yellow.
3. `node build-car2.mjs <car.glb> <out dir from step 2> ../../public/models/car.glb` drops the sponsor decals
   (only the number on the nose is kept, as A10), splits the rear wing and the wing fittings off the big meshes so the
   exploded view can move them, simplifies, and compresses (meshopt + WebP). 270k → 183k triangles, 13.7 MB → 2.1 MB.

**Steering wheel**

`node build-wheel.mjs <wheel.glb> ../../public/models/wheel.glb` splits the single baked mesh into its shells and files
each under a layer (screen, dials, controls, body, grips, paddles, hub). 90k → 49k triangles, 10.3 MB → 1.2 MB.

The node and layer names these scripts write are the ones `components/stage/car.ts` and `wheel.ts` look for.
`car-shadow.png` is the car's footprint from above, blurred; `public/stills/*.webp` are frames of the two exploded
views, shown where the 3D stage is not running.
