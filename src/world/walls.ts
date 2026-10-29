import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import wallsData from '../data/walls.json';
import { WALL_HEIGHT } from '../config';
import { toWorld, type Px } from '../plan';
import type { CollisionWorld } from '../collision';

interface WallPolygon {
  outer: Px[];
  holes: Px[][];
}

/** Stěny = polygony vytažené z půdorysu (tools/trace_walls.py), vysunuté do výšky stropu. */
export function buildWalls(collision: CollisionWorld): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  for (const poly of wallsData.polygons as unknown as WallPolygon[]) {
    const outer = poly.outer.map(toWorld);
    // Shape leží v rovině XY; po otočení o -90° kolem X se (x, y) mapuje na (x, -z).
    const shape = new THREE.Shape(outer.map((v) => new THREE.Vector2(v.x, -v.y)));
    collision.addPolygon(outer);
    for (const h of poly.holes) {
      const hole = h.map(toWorld);
      shape.holes.push(new THREE.Path(hole.map((v) => new THREE.Vector2(v.x, -v.y))));
      collision.addPolygon(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL_HEIGHT, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geos.push(geo);
  }
  const merged = mergeGeometries(geos);
  const mat = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'walls';
  return mesh;
}
