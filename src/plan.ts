import * as THREE from 'three';
import { METERS_PER_PX, PLAN_ORIGIN } from './config';

export type Px = [number, number];

/** Pixel půdorysu -> světové souřadnice (x, z) v metrech. Osa y půdorysu míří dolů = +z. */
export function toWorld(p: Px): THREE.Vector2 {
  return new THREE.Vector2((p[0] - PLAN_ORIGIN[0]) * METERS_PER_PX, (p[1] - PLAN_ORIGIN[1]) * METERS_PER_PX);
}

/** Světové (x, z) -> pixel půdorysu. */
export function toPlan(x: number, z: number): Px {
  return [x / METERS_PER_PX + PLAN_ORIGIN[0], z / METERS_PER_PX + PLAN_ORIGIN[1]];
}

export const pxToM = (px: number) => px * METERS_PER_PX;

/**
 * Natočení objektu kolem osy Y tak, aby jeho lokální osa +X mířila ve směru (dx, dz).
 * (three.js: rotace o úhel θ posílá +X na (cos θ, -sin θ)).
 */
export function yawFromDir(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/** Krabice natažená mezi dvěma body půdorysu (střed na spojnici), od výšky y0 do y1. */
export function boxBetween(a: Px, b: Px, thicknessM: number, y0: number, y1: number, material: THREE.Material): THREE.Mesh {
  const A = toWorld(a);
  const B = toWorld(b);
  const len = A.distanceTo(B);
  const geo = new THREE.BoxGeometry(len, y1 - y0, thicknessM);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((A.x + B.x) / 2, (y0 + y1) / 2, (A.y + B.y) / 2);
  mesh.rotation.y = yawFromDir(B.x - A.x, B.y - A.y);
  return mesh;
}
