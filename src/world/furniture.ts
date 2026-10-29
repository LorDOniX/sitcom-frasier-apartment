import * as THREE from 'three';
import data from '../data/furniture.json';
import { WALL_HEIGHT } from '../config';
import { toWorld, type Px } from '../plan';
import type { CollisionWorld } from '../collision';

interface Item {
  name: string;
  kind: string;
  pos: Px;
  size: [number, number];
  rot: number;
  h: number;
  color: string;
}

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
};

/**
 * Zástupný nábytek z jednoduchých těles (fáze 1). Lokální osa X = šířka (size[0]),
 * Z = hloubka (size[1]); u postelí je čelo na -Z, u pohovek opěradlo na -Z.
 */
function buildItem(it: Item): THREE.Object3D {
  const g = new THREE.Group();
  const [w, d] = it.size;
  const h = it.h;
  const mat = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 });
  switch (it.kind) {
    case 'sofa':
      g.add(box(w, h * 0.5, d, mat));
      g.add(box(w, h * 0.5, d * 0.25, mat, 0, h * 0.5, -d * 0.375));
      g.add(box(0.18, h * 0.25, d, mat, -w / 2 + 0.09, h * 0.5, 0));
      g.add(box(0.18, h * 0.25, d, mat, w / 2 - 0.09, h * 0.5, 0));
      break;
    case 'armchair':
      g.add(box(w, h * 0.45, d, mat));
      g.add(box(w, h * 0.55, d * 0.22, mat, 0, h * 0.45, -d * 0.39));
      break;
    case 'bed':
      g.add(box(w, h * 0.55, d, dark));
      g.add(box(w - 0.04, h * 0.3, d - 0.08, white, 0, h * 0.55, 0.02));
      g.add(box(w - 0.04, 0.06, d * 0.62, mat, 0, h * 0.85, d * 0.17));
      g.add(box(w + 0.04, 1.05, 0.08, dark, 0, 0, -d / 2 - 0.04));
      break;
    case 'table': {
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2, 0.03, 40),
        new THREE.MeshPhysicalMaterial({ color: it.color, roughness: 0.05, transparent: true, opacity: 0.45 }),
      );
      top.position.y = h;
      g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 12), dark);
      leg.position.y = h / 2;
      g.add(leg);
      break;
    }
    case 'chair':
      g.add(box(w, 0.45, d, mat));
      g.add(box(w, h - 0.45, 0.05, mat, 0, 0.45, -d / 2 + 0.025));
      break;
    case 'cylinder': {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 32), mat);
      c.position.y = h / 2;
      g.add(c);
      break;
    }
    case 'piano': {
      // křídlo: tvar s oblým koncem, klaviatura na -Z
      const s = new THREE.Shape();
      s.moveTo(-w / 2, -d / 2);
      s.lineTo(w / 2, -d / 2);
      s.lineTo(w / 2, d * 0.1);
      s.quadraticCurveTo(w / 2, d / 2, 0, d / 2);
      s.quadraticCurveTo(-w / 2, d / 2, -w / 2, 0);
      s.lineTo(-w / 2, -d / 2);
      const body = new THREE.Mesh(
        new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false, curveSegments: 12 }),
        new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.15, metalness: 0.1 }),
      );
      body.rotation.x = Math.PI / 2;
      body.position.y = h;
      g.add(body);
      g.add(box(w, 0.04, 0.16, white, 0, 0.72, -d / 2 - 0.06));
      for (const [x, z] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [0, d / 2 - 0.15]]) {
        g.add(box(0.07, h - 0.35, 0.07, dark, x, 0, z));
      }
      break;
    }
    case 'counter':
      g.add(box(w, h - 0.04, d, mat));
      g.add(box(w + 0.02, 0.04, d + 0.02, new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.3 }), 0, h - 0.04, 0));
      break;
    default:
      g.add(box(w, h, d, mat));
  }
  return g;
}

export function buildFurniture(root: THREE.Object3D, collision: CollisionWorld) {
  for (const it of data.items as unknown as Item[]) {
    const obj = buildItem(it);
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    const p = toWorld(it.pos);
    obj.position.set(p.x, 0, p.y);
    // rot v půdorysu je po směru hodinových ručiček (osa y dolů) => ve three.js záporný úhel
    const yaw = -THREE.MathUtils.degToRad(it.rot);
    obj.rotation.y = yaw;
    root.add(obj);

    // kolizní obdélník
    const [w, d] = it.size;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const corners = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([x, z]) => new THREE.Vector2(p.x + x * c + z * s, p.y - x * s + z * c));
    collision.addPolygon(corners);
  }
}

/** Stropní svítidla: bodové světlo kousek pod stropem + svítící disk na stropě. */
export function buildLights(root: THREE.Object3D): THREE.PointLight[] {
  const lights: THREE.PointLight[] = [];
  const discGeo = new THREE.CircleGeometry(0.18, 24).rotateX(Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false });
  for (const px of data.lights as unknown as Px[]) {
    const p = toWorld(px);
    const l = new THREE.PointLight(0xffe2b8, 3, 10, 1.5);
    l.position.set(p.x, 2.1, p.y);
    root.add(l);
    lights.push(l);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(p.x, WALL_HEIGHT - 0.01, p.y);
    root.add(disc);
  }
  return lights;
}
