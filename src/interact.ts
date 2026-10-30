import * as THREE from 'three';

/** Cokoli, s čím jde zacházet klávesou E (dveře, vypínače, lampy, klavír, rádio, popisky). */
export interface Interactable {
  /** Objekty, na které se míří (raycast jde i do potomků – modely se načítají později). */
  targets: THREE.Object3D[];
  /** Text nápovědy za „E – “. */
  hint(): string;
  /** from = poloha hráče v půdorysu světa (x, z). */
  interact(from: THREE.Vector2): void;
  update?(dt: number): void;
}

/** Interaktivní objekt podle zasaženého meshe: userData.interactable na něm nebo na některém předkovi. */
export function interactableOf(o: THREE.Object3D | null): Interactable | null {
  for (; o; o = o.parent) if (o.userData.interactable) return o.userData.interactable as Interactable;
  return null;
}
