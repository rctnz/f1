import type * as T from "three";
import { contactShadow } from "./carModel";

type Three = typeof import("three");

const WHEELS = ["WHEEL_LF", "WHEEL_RF", "WHEEL_LR", "WHEEL_RR"];

/**
 * Loads public/models/car.glb (meshopt-compressed, logos removed, A10 number) and returns the same
 * shape as buildCar: the car points along +x, sits on y = 0, centred on x = 0; wheels spin about z.
 */
export async function loadCar(THREE: Three, url: string) {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/libs/meshopt_decoder.module.js"),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);

  const root = new THREE.Group(); // moves (drive in / out)
  const spinner = new THREE.Group(); // turns (scroll spin)
  const turn = new THREE.Group(); // the file's nose points +z; turn it to +x
  root.add(spinner);
  spinner.add(turn);
  turn.add(gltf.scene);
  turn.rotation.y = Math.PI / 2;

  // centre on x/z and stand it on the ground
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn);
  const c = box.getCenter(new THREE.Vector3());
  turn.position.set(-c.x, -box.min.y, -c.z);
  root.updateMatrixWorld(true);

  // the body paint gets a lacquer coat; everything else keeps the file's materials
  gltf.scene.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as T.MeshStandardMaterial;
    if (m?.name === "sf25_paints") {
      const paint = new THREE.MeshPhysicalMaterial({ map: m.map, metalness: 0.25, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
      paint.name = m.name;
      mesh.material = paint;
      m.dispose();
    }
  });

  // each wheel spins about its own centre: hang it from a pivot placed there
  const wheels: T.Object3D[] = [];
  for (const name of WHEELS) {
    const wheel = gltf.scene.getObjectByName(name);
    if (!wheel) continue;
    const center = new THREE.Box3().setFromObject(wheel).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(spinner.worldToLocal(center));
    spinner.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(wheel);
    wheels.push(pivot);
  }

  spinner.add(contactShadow(THREE, 6.8, 2.6));
  return { root, spinner, wheels };
}
