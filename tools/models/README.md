# How the 3D assets were prepared

`public/models/` holds four files. The car and the steering wheel come from downloaded models, both CC BY 4.0 and
both credited in the site footer; the originals are not in the repo.

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

**Steering wheel** (`wheel.glb`): "McLaren Formula 1 Steering Wheel" by dhimasdc9 on Sketchfab, CC BY 4.0.
`node build-wheel.mjs <original.glb> ../../public/models/wheel.glb` recolours the purple parts and print (the site
uses no purple), names the parts the page drives (SCREEN, LEDS_TOP, KNOB_MID, BUTTONS, GLASS), simplifies and
compresses. 332k → 104k triangles, 10.9 MB → 1.0 MB. Add `--report` to list where the button caps sit.
`components/stage/wheel.ts` lays the page's own dash over SCREEN and lights LEDS_TOP.

**Asphalt** (`asphalt.webp`): `python asphalt.py ../../public/models/asphalt.webp` draws the tileable grain the track
shader (`components/stage/ground.ts`) samples: three scales of noise and a scatter of pale stones. No source picture.

**Shadow and stills**: `car-shadow.png` is the car's footprint from above, blurred. `public/stills/car-apart.webp` is a
frame of the exploded view (the page hidden, cropped to the car), shown where the 3D stage is not running.
`public/stills/grid.webp` (the track) and `grid-car.webp` (the car and its shadow, clear background) are the hero's
overhead shot at 1920×945 with the page hidden; `components/Hero.tsx` lays them where the live scene will be until the
stage is up, keeps them where it cannot run, and holds the numbers that go with them (re-shoot all together).
