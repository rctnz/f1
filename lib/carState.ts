/**
 * Shared between the hero's scroll timeline (writes) and the 3D scene (reads every frame).
 * drive: 0 → 1 the car launches off to the right at lights out
 * side:  0 → 1 the camera swings round to a side view and the car rolls back in
 * spin:  0 → 1 one full turn of the car while the page keeps scrolling
 */
export const carState = { drive: 0, side: 0, spin: 0 };
