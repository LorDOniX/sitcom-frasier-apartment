import * as THREE from 'three';
import data from './data/openings.json';
import furniture from './data/furniture.json';
import { PLAN_H, PLAN_W } from './config';
import type { Surface } from './audio';
import { toPlan, type Px } from './plan';

/** Obrysy koberců přes celou místnost (rug s poly ve furniture.json) – kroky po nich znějí jako po koberci. */
const RUGS = (furniture.items as { kind?: string; poly?: Px[] }[]).filter((i) => i.kind === 'rug' && i.poly).map((i) => i.poly!);

function inPoly([x, y]: Px, poly: Px[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Název místnosti podle polohy – čte mapu public/rooms.png (hodnota = index místnosti + 1). */
export class Rooms {
  private pixels: Uint8ClampedArray | null = null;

  constructor(loader: THREE.TextureLoader) {
    loader.load('/rooms.png', (tex) => {
      const img = tex.image as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = PLAN_W;
      c.height = PLAN_H;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      this.pixels = g.getImageData(0, 0, PLAN_W, PLAN_H).data;
      tex.dispose();
    });
  }

  private room(x: number, z: number): { name: string; floor?: string } | null {
    if (!this.pixels) return null;
    const [px, py] = toPlan(x, z).map(Math.round);
    if (px < 0 || py < 0 || px >= PLAN_W || py >= PLAN_H) return null;
    const v = this.pixels[(py * PLAN_W + px) * 4];
    return v > 0 ? (data.rooms[v - 1] ?? null) : null;
  }

  at(x: number, z: number): string | null {
    return this.room(x, z)?.name ?? null;
  }

  /** Povrch pod hráčem (rooms[].floor, koberec v obýváku má přednost). */
  surfaceAt(x: number, z: number): Surface {
    const p = toPlan(x, z);
    if (RUGS.some((r) => inPoly(p, r))) return 'carpet';
    return (this.room(x, z)?.floor as Surface | undefined) ?? 'wood';
  }
}
