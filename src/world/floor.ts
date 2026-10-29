import * as THREE from 'three';
import { METERS_PER_PX, PLAN_H, PLAN_ORIGIN, PLAN_W, WALL_HEIGHT } from '../config';

export interface FloorSet {
  floor: THREE.Mesh;
  ceiling: THREE.Mesh;
  /** Přepne podlahu mezi barevným půdorysem a parketami. */
  togglePlan(): boolean;
}

/**
 * Podlaha i strop jsou jedna rovina o velikosti celého půdorysu; tvar bytu
 * vyřezává alphaMap (public/floor_mask.png z tools/trace_walls.py).
 */
export function buildFloor(loader: THREE.TextureLoader, maxAniso: number): FloorSet {
  const w = PLAN_W * METERS_PER_PX;
  const h = PLAN_H * METERS_PER_PX;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI / 2);
  // střed obrázku vůči počátku světa
  const cx = (PLAN_W / 2 - PLAN_ORIGIN[0]) * METERS_PER_PX;
  const cz = (PLAN_H / 2 - PLAN_ORIGIN[1]) * METERS_PER_PX;

  const planTex = loader.load('/pudorys.jpg');
  planTex.colorSpace = THREE.SRGBColorSpace;
  planTex.anisotropy = maxAniso;

  const mask = loader.load('/floor_mask.png');
  mask.generateMipmaps = false;
  mask.minFilter = THREE.LinearFilter;

  const parquet = makeParquetTexture();
  parquet.anisotropy = maxAniso;
  parquet.repeat.set(w / 1.6, h / 1.6);

  const floorMat = new THREE.MeshStandardMaterial({
    map: planTex,
    alphaMap: mask,
    alphaTest: 0.5,
    roughness: 0.75,
  });
  const floor = new THREE.Mesh(geo, floorMat);
  floor.position.set(cx, 0, cz);
  floor.name = 'floor';

  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xf4f0e8,
    alphaMap: mask,
    alphaTest: 0.5,
    roughness: 0.95,
    side: THREE.BackSide,
  });
  const ceiling = new THREE.Mesh(geo, ceilMat);
  ceiling.position.set(cx, WALL_HEIGHT, cz);
  ceiling.name = 'ceiling';

  let showPlan = true;
  return {
    floor,
    ceiling,
    togglePlan() {
      showPlan = !showPlan;
      floorMat.map = showPlan ? planTex : parquet;
      floorMat.roughness = showPlan ? 0.75 : 0.45;
      floorMat.needsUpdate = true;
      return showPlan;
    },
  };
}

/** Procedurální prkenná podlaha (dlaždicovatelná) – zástupce, než se doplní PBR textura z Poly Haven. */
function makeParquetTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rows = 8;
  const plankW = size / rows;
  const plankL = size / 2;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < rows; row++) {
    const y = row * plankW;
    const shift = (row * 0.37 % 1) * plankL;
    for (let k = -1; k < 3; k++) {
      const x = shift + k * plankL;
      g.fillStyle = `hsl(${28 + rnd() * 6}, ${30 + rnd() * 10}%, ${36 + rnd() * 10}%)`;
      for (const dx of [0, -size, size]) {
        g.fillRect(x + dx, y, plankL - 2, plankW - 2);
      }
      g.strokeStyle = 'rgba(40,20,5,0.16)';
      for (let n = 0; n < 6; n++) {
        const yy = y + 2 + rnd() * (plankW - 4);
        for (const dx of [0, -size, size]) {
          g.beginPath();
          g.moveTo(x + dx, yy);
          g.lineTo(x + dx + plankL - 2, yy + (rnd() - 0.5) * 3);
          g.stroke();
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
