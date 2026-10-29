import * as THREE from 'three';
import { METERS_PER_PX, PLAN_H, PLAN_ORIGIN, PLAN_W, WALL_HEIGHT } from '../config';
import { LEVELS } from '../levels';
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
 * alphaMap z public/floors/<materiál>[_<úroveň>].png (generuje tools/trace_walls.py z mapy místností
 * a výškových úrovní). Každá výšková úroveň má vlastní sadu rovin ve své výšce (src/data/levels.json).
 * Masky se nepřekrývají, pod nimi leží neutrální podklad (public/floors/base*.png),
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

  const pbrCache = new Map<string, ReturnType<typeof loadPbr>>();
  const pbrFor = (key: string) => {
    const def = FLOOR_MATERIALS[key];
    let pbr = pbrCache.get(key);
    if (!pbr) {
      const maps = def.roughness === undefined ? undefined : (['map', 'normalMap'] as const);
      pbr = loadPbr(loader, def.dir, new THREE.Vector2(w / def.size, h / def.size), maxAniso, maps && [...maps]);
      pbrCache.set(key, pbr);
    }
    return pbr;
  };

  const planTex = loader.load('/pudorys.jpg');
  planTex.colorSpace = THREE.SRGBColorSpace;
  planTex.anisotropy = maxAniso;

  const materialPlanes: THREE.Mesh[] = [];
  const planPlanes: THREE.Mesh[] = [];
  for (const level of LEVELS) {
    const baseMask = loadMask(level.base);
    // podklad
    plane(new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.8, alphaMap: baseMask, alphaTest: 0.5 }), level.y - 0.004);
    for (const [key, url] of Object.entries(level.floors)) {
      const def = FLOOR_MATERIALS[key];
      if (!def) continue;
      const mat = new THREE.MeshStandardMaterial({
        ...pbrFor(key),
        color: def.color ?? 0xffffff,
        roughness: def.roughness ?? 1,
        envMapIntensity: def.env ?? 1,
        alphaMap: loadMask(url),
        alphaTest: 0.5,
      });
      materialPlanes.push(plane(mat, level.y));
    }
    const planFloor = plane(new THREE.MeshStandardMaterial({ map: planTex, alphaMap: baseMask, alphaTest: 0.5, roughness: 0.75 }), level.y + 0.001);
    planFloor.visible = false;
    planPlanes.push(planFloor);
  }

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
      const plan = !planPlanes[0].visible;
      for (const m of planPlanes) m.visible = plan;
      for (const m of materialPlanes) m.visible = !plan;
      return plan;
    },
  };
}
