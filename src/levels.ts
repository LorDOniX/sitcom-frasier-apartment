import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import levelsData from './data/levels.json';
import openings from './data/openings.json';
import { toPlan, toWorld, type Px } from './plan';

/**
 * Výškové úrovně podlahy (src/data/levels.json, generuje tools/trace_walls.py z `levels` v openings.json).
 * Úroveň 0 = základní výška, další mají obrys v px půdorysu; pozdější přepisuje dřívější.
 */
export interface Level {
  name: string;
  y: number;
  floors: Record<string, string>;
  base: string;
  polygons?: Px[][];
}

export const LEVELS = levelsData.levels as unknown as Level[];
export const MIN_FLOOR_Y = Math.min(...LEVELS.map((l) => l.y));

/** Výška podlahy (m) v bodě světa (x, z). */
export function floorHeight(x: number, z: number): number {
  const p = toPlan(x, z);
  for (let i = LEVELS.length - 1; i > 0; i--) {
    if (LEVELS[i].polygons?.some((poly) => inPoly(p, poly))) return LEVELS[i].y;
  }
  return LEVELS[0].y;
}

function inPoly([x, y]: Px, poly: Px[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

interface LevelDef {
  poly?: Px[];
  boundary?: Px[];
}

/** Pásy čela a hrany schodu: odsazení od hrany úrovně směrem k nižší podlaze (m). */
const RISER = [-0.005, 0.025] as const;
const NOSING = [-0.04, 0.05] as const;
const NOSING_H = 0.03;

interface Edge {
  a: THREE.Vector2;
  b: THREE.Vector2;
  /** jednotková normála mířící k nižší podlaze */
  low: THREE.Vector2;
  lo: number;
  hi: number;
}

/**
 * Čela schodů na hranách úrovní z openings.json (obrys schodu `poly` a dělicí čára `boundary`).
 * Na každé hraně se porovná výška podlahy po obou stranách; čelo sahá od nižší k vyšší
 * a nahoře má hranu (nosing), která zakryje schodovitý okraj masky podlahy.
 * Navazující hrany stejného schodu se v rozích potkávají na pokos (žádné přesahy ani mezery).
 */
export function buildSteps(): THREE.Mesh {
  const segs: [Px, Px][] = [];
  const same = (a: Px, b: Px) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 2;
  const add = (a: Px, b: Px) => {
    if (!segs.some(([c, d]) => (same(a, c) && same(b, d)) || (same(a, d) && same(b, c)))) segs.push([a, b]);
  };
  for (const l of (openings.levels ?? []) as unknown as LevelDef[]) {
    if (l.poly) l.poly.forEach((p, i) => add(p, l.poly![(i + 1) % l.poly!.length]));
    if (l.boundary) l.boundary.slice(1).forEach((p, i) => add(l.boundary![i], p));
  }

  const edges: Edge[] = [];
  for (const [pa, pb] of segs) {
    const a = toWorld(pa);
    const b = toWorld(pb);
    const d = b.clone().sub(a).normalize();
    const n = new THREE.Vector2(-d.y, d.x);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const h1 = floorHeight(mid.x + n.x * 0.08, mid.y + n.y * 0.08);
    const h2 = floorHeight(mid.x - n.x * 0.08, mid.y - n.y * 0.08);
    if (Math.abs(h1 - h2) < 0.01) continue;
    edges.push({ a, b, low: h1 < h2 ? n : n.negate(), lo: Math.min(h1, h2), hi: Math.max(h1, h2) });
  }

  // roh pásu v odsazení `off`: průsečík odsazených přímek s navazující hranou stejného schodu
  const corner = (e: Edge, end: 'a' | 'b', off: number): THREE.Vector2 => {
    const p = e[end];
    const own = p.clone().addScaledVector(e.low, off);
    const next = edges.find(
      (f) => f !== e && Math.abs(f.lo - e.lo) < 0.01 && Math.abs(f.hi - e.hi) < 0.01 && (f.a.distanceTo(p) < 0.03 || f.b.distanceTo(p) < 0.03),
    );
    if (!next) return own;
    const d1 = e.b.clone().sub(e.a).normalize();
    const d2 = next.b.clone().sub(next.a).normalize();
    const den = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(den) < 0.05) return own;
    const q = p.clone().addScaledVector(next.low, off);
    const t = ((q.x - own.x) * d2.y - (q.y - own.y) * d2.x) / den;
    return own.addScaledVector(d1, t);
  };

  const geos: THREE.BufferGeometry[] = [];
  const strip = (e: Edge, [o1, o2]: readonly [number, number], y0: number, y1: number) => {
    const pts = [corner(e, 'a', o1), corner(e, 'b', o1), corner(e, 'b', o2), corner(e, 'a', o2)];
    // Shape v rovině XY; po otočení o -90° kolem X se (x, y) mapuje na (x, -z)
    const shape = new THREE.Shape(pts.map((v) => new THREE.Vector2(v.x, -v.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0, 0);
    geos.push(geo);
  };
  for (const e of edges) {
    strip(e, RISER, e.lo, e.hi - 0.001);
    strip(e, NOSING, e.hi + 0.004 - NOSING_H, e.hi + 0.004);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xa2703e, roughness: 0.5 }));
  mesh.name = 'steps';
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
