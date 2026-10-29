import * as THREE from 'three';
import data from './data/openings.json';
import { PLAN_H, PLAN_W } from './config';
import { toPlan } from './plan';

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

  at(x: number, z: number): string | null {
    if (!this.pixels) return null;
    const [px, py] = toPlan(x, z).map(Math.round);
    if (px < 0 || py < 0 || px >= PLAN_W || py >= PLAN_H) return null;
    const v = this.pixels[(py * PLAN_W + px) * 4];
    return v > 0 ? (data.rooms[v - 1]?.name ?? null) : null;
  }
}
