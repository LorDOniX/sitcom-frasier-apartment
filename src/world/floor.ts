import * as THREE from 'three';
import data from '../data/openings.json';
import { METERS_PER_PX, PLAN_H, PLAN_ORIGIN, PLAN_W, WALL_HEIGHT } from '../config';
import { loadPbr } from './materials';

export interface FloorSet {
  group: THREE.Group;
  ceiling: THREE.Mesh;
  /** Přepne podlahu mezi materiály a barevným půdorysem. Vrací true, když je vidět půdorys. */
  togglePlan(): boolean;
}

/** Materiály podlah (klíč = rooms[].floor v openings.json). size = skutečná velikost textury v m. */
// roughness bez mapy = pevná hodnota (roughness mapa parket z Poly Haven je na byt moc lesklá)
const FLOOR_MATERIALS: Record<string, { dir: string; size: number; roughness?: number; color?: number; env?: number }> = {
  wood: { dir: 'herringbone_parquet', size: 2.0, roughness: 0.62, env: 0.5 },
  carpet: { dir: 'Carpet016', size: 1.0 },
  tile: { dir: 'marble_tiles', size: 1.8, env: 0.6 },
  stone: { dir: 'granite_tile', size: 2.4 },
  corridor: { dir: 'Carpet012', size: 1.0 },
};

/**
 * Podlahy jsou roviny o velikosti celého půdorysu; tvar každého materiálu vyřezává
 * alphaMap z public/floors/<materiál>.png (generuje tools/trace_walls.py z mapy místností).
 * Masky se nepřekrývají, pod nimi leží neutrální podklad (public/floor_mask.png),
 * který zakryje případné škvíry na hranicích.
 */
export function buildFloor(loader: THREE.TextureLoader, maxAniso: number): FloorSet {
  const w = PLAN_W * METERS_PER_PX;
  const h = PLAN_H * METERS_PER_PX;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI / 2);
  // střed obrázku vůči počátku světa
  const cx = (PLAN_W / 2 - PLAN_ORIGIN[0]) * METERS_PER_PX;
  const cz = (PLAN_H / 2 - PLAN_ORIGIN[1]) * METERS_PER_PX;

  const loadMask = (url: string) => {
    const t = loader.load(url);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  };
  const mask = loadMask('/floor_mask.png');
  const group = new THREE.Group();

  const plane = (mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx, y, cz);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // podklad
  plane(new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.8, alphaMap: mask, alphaTest: 0.5 }), -0.004);

  const materialPlanes: THREE.Mesh[] = [];
  const used = new Set(data.rooms.map((r) => r.floor));
  for (const key of used) {
    const def = FLOOR_MATERIALS[key];
    if (!def) continue;
    const maps = def.roughness === undefined ? undefined : (['map', 'normalMap'] as const);
    const pbr = loadPbr(loader, def.dir, new THREE.Vector2(w / def.size, h / def.size), maxAniso, maps && [...maps]);
    const mat = new THREE.MeshStandardMaterial({
      ...pbr,
      color: def.color ?? 0xffffff,
      roughness: def.roughness ?? 1,
      envMapIntensity: def.env ?? 1,
      alphaMap: loadMask(`/floors/${key}.png`),
      alphaTest: 0.5,
    });
    materialPlanes.push(plane(mat, 0));
  }

  const planTex = loader.load('/pudorys.jpg');
  planTex.colorSpace = THREE.SRGBColorSpace;
  planTex.anisotropy = maxAniso;
  const planFloor = plane(new THREE.MeshStandardMaterial({ map: planTex, alphaMap: mask, alphaTest: 0.5, roughness: 0.75 }), 0.001);
  planFloor.visible = false;

  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xf6f2ea,
    alphaMap: mask,
    alphaTest: 0.5,
    roughness: 0.95,
    side: THREE.BackSide,
    shadowSide: THREE.DoubleSide,
  });
  const ceiling = new THREE.Mesh(geo, ceilMat);
  ceiling.position.set(cx, WALL_HEIGHT, cz);
  ceiling.castShadow = true;
  ceiling.name = 'ceiling';

  return {
    group,
    ceiling,
    togglePlan() {
      planFloor.visible = !planFloor.visible;
      for (const m of materialPlanes) m.visible = !planFloor.visible;
      return planFloor.visible;
    },
  };
}
