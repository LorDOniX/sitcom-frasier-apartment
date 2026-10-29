import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import wallsData from '../data/walls.json';
import { WALL_HEIGHT } from '../config';
import { toWorld, yawFromDir, type Px } from '../plan';
import type { CollisionWorld } from '../collision';
import { loadPbr } from './materials';

interface WallPolygon {
  outer: Px[];
  holes: Px[][];
}

const BASEBOARD_H = 0.09;
const BASEBOARD_T = 0.014;
const BASEBOARD_MIN_LEN = 0.3; // kratší hrany (ostění dveří, čela příček) lištu nedostanou

/** Stěny = polygony vytažené z půdorysu (tools/trace_walls.py), vysunuté do výšky stropu. */
export function buildWalls(collision: CollisionWorld, loader: THREE.TextureLoader, maxAniso: number): THREE.Group {
  const geos: THREE.BufferGeometry[] = [];
  const boards: THREE.BufferGeometry[] = [];
  for (const poly of wallsData.polygons as unknown as WallPolygon[]) {
    const outer = poly.outer.map(toWorld);
    const holes = poly.holes.map((h) => h.map(toWorld));
    // Shape leží v rovině XY; po otočení o -90° kolem X se (x, y) mapuje na (x, -z).
    const shape = new THREE.Shape(outer.map((v) => new THREE.Vector2(v.x, -v.y)));
    collision.addPolygon(outer);
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map((v) => new THREE.Vector2(v.x, -v.y))));
      collision.addPolygon(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL_HEIGHT, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geos.push(geo);

    const inSolid = (p: THREE.Vector2) => pointInRing(p, outer) && !holes.some((h) => pointInRing(p, h));
    for (const ring of [outer, ...holes]) boards.push(...baseboards(ring, inSolid));
  }

  // malovaná omítka: z textury jen reliéf (normal + roughness), barva je čistá –
  // barevná mapa má skvrny, které na celé stěně působí špinavě. UV stěn jsou v metrech, textura ~2 m.
  const plaster = loadPbr(loader, 'painted_plaster_wall', new THREE.Vector2(0.5, 0.5), maxAniso, ['normalMap', 'roughnessMap']);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xeee6d8,
    normalMap: plaster.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: plaster.roughnessMap,
    roughness: 1,
  });
  const walls = new THREE.Mesh(mergeGeometries(geos), wallMat);
  walls.name = 'walls';
  walls.castShadow = true;
  walls.receiveShadow = true;

  const boardMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.45 });
  const trim = new THREE.Mesh(mergeGeometries(boards), boardMat);
  trim.name = 'baseboards';
  trim.receiveShadow = true;

  const group = new THREE.Group();
  group.add(walls, trim);
  return group;
}

/** Soklové lišty podél hran jednoho obrysu, vždy na straně odvrácené od zdiva. */
function baseboards(ring: THREE.Vector2[], inSolid: (p: THREE.Vector2) => boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const len = a.distanceTo(b);
    if (len < BASEBOARD_MIN_LEN) continue;
    const dir = b.clone().sub(a).divideScalar(len);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    let n = new THREE.Vector2(-dir.y, dir.x);
    if (inSolid(mid.clone().addScaledVector(n, 0.03))) n = n.negate();
    const geo = new THREE.BoxGeometry(len, BASEBOARD_H, BASEBOARD_T);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(mid.x + n.x * BASEBOARD_T * 0.5, BASEBOARD_H / 2, mid.y + n.y * BASEBOARD_T * 0.5),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFromDir(dir.x, dir.y)),
      new THREE.Vector3(1, 1, 1),
    );
    geo.applyMatrix4(m);
    out.push(geo);
  }
  return out;
}

function pointInRing(p: THREE.Vector2, ring: THREE.Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
