# How the 3D assets were prepared

`public/models/` holds three files. Only the car comes from a downloaded model; the steering wheel on the
Driver Tags screen is not a file at all, it is built in code in `components/stage/wheel.ts`.

```bash
# once, in an empty folder next to the original car model
npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
pip install pillow
```

**Car** (`car.glb`): "2022 Ferrari F1-75" by asdasfwefsfwsef on Sketchfab, CC BY 4.0, credited in the site footer.
The original is not in the repo. To rebuild after changing the model or the livery:

1. Dump the textures of the original (any glTF tool; the scripts expect them numbered `00.png` … `44.png` in texture order).
2. `python car2tex.py <textures dir> <out dir> <this folder>` cleans the livery: every real brand mark comes off,
   `A10` goes on the engine cover, the tyre lettering is painted out and the lime details become the site's yellow.
3. `node build-car2.mjs <car.glb> <out dir from step 2> ../../public/models/car.glb` drops the sponsor decals
   (only the number on the nose is kept, as A10), splits the rear wing and the wing fittings off the big meshes so the
   exploded view can move them, simplifies, and compresses (meshopt + WebP). 270k → 183k triangles, 13.7 MB → 2.1 MB.

The node names this script writes are the ones `components/stage/car.ts` looks for.

**Asphalt** (`asphalt.webp`): `python asphalt.py ../../public/models/asphalt.webp` draws the tileable grain the track
shader (`components/stage/ground.ts`) samples: three scales of noise and a scatter of pale stones. No source picture.

**Shadow and still**: `car-shadow.png` is the car's footprint from above, blurred. `public/stills/car-apart.webp` is a
frame of the exploded view (1440×900, the page hidden, cropped to the car), shown where the 3D stage is not running.
