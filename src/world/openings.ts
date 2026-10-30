import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import data from '../data/openings.json';
import { DOOR_HEIGHT, WALL_HEIGHT } from '../config';
import { audio } from '../audio';
import type { Interactable } from '../interact';
import { markShadows } from '../quality';
import { boxBetween, pxToM, toWorld, yawFromDir, type Px } from '../plan';
import type { CollisionWorld, Segment } from '../collision';
import { floorHeight } from '../levels';

interface DoorDef {
  id: string;
  label: string;
  hinge: Px;
  tip: Px;
  open: Px;
  t?: number;
}
interface SliderDef {
  label: string;
  a: Px;
  b: Px;
  t?: number;
}
interface WindowDef {
  a: Px;
  b: Px;
  sill: number;
  head: number;
  t?: number;
  kind?: string;
}
interface RailingDef {
  a: Px;
  b: Px;
  h: number;
}

const lintelMat = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.92 });
const doorMat = new THREE.MeshStandardMaterial({ color: 0xf3eee4, roughness: 0.55 });
const frontDoorMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.45 });
const handleMat = new THREE.MeshStandardMaterial({ color: 0xc8a457, roughness: 0.25, metalness: 1 });
const casingMat = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.45 });
const frontCasingMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.4 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 });
const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xcfe6ef,
  roughness: 0.05,
  metalness: 0,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const segOf = (a: THREE.Vector2, b: THREE.Vector2): Segment => ({ ax: a.x, az: a.y, bx: b.x, bz: b.y });

/** Těleso, které vrhá i přijímá stín. */
function solid<T extends THREE.Mesh>(m: T): T {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Krabice se středem v (x, y, z) světa, natočená podél směru `dir` (rovina podlahy). */
function boxAlong(dir: THREE.Vector2, x: number, y: number, z: number, len: number, h: number, depth: number, mat: THREE.Material) {
  const m = solid(new THREE.Mesh(new THREE.BoxGeometry(len, h, depth), mat));
  m.position.set(x, y, z);
  m.rotation.y = yawFromDir(dir.x, dir.y);
  return m;
}

const CASING_W = 0.07;
const CASING_T = 0.015;

/** Zárubeň: obklad ostění + obložky na obou lících stěny. */
function addCasing(root: THREE.Object3D, H: THREE.Vector2, T: THREE.Vector2, wallT: number, mat: THREE.Material) {
  const len = H.distanceTo(T);
  const d = T.clone().sub(H).divideScalar(len);
  const n = new THREE.Vector2(-d.y, d.x);
  const mid = H.clone().add(T).multiplyScalar(0.5);
  const at = (p: THREE.Vector2, along: number, side: number) => p.clone().addScaledVector(d, along).addScaledVector(n, side);
  // ostění (uvnitř otvoru)
  for (const [p, s] of [[H, 1], [T, -1]] as const) {
    const c = at(p, s * 0.01, 0);
    root.add(boxAlong(d, c.x, DOOR_HEIGHT / 2, c.y, 0.02, DOOR_HEIGHT, wallT + 0.004, mat));
  }
  root.add(boxAlong(d, mid.x, DOOR_HEIGHT - 0.01, mid.y, len, 0.02, wallT + 0.004, mat));
  // obložky na obou stranách
  const hh = DOOR_HEIGHT + CASING_W;
  for (const side of [-1, 1]) {
    const off = side * (wallT / 2 + CASING_T / 2);
    for (const [p, s] of [[H, -1], [T, 1]] as const) {
      const c = at(p, (s * CASING_W) / 2, off);
      root.add(boxAlong(d, c.x, hh / 2, c.y, CASING_W, hh, CASING_T, mat));
    }
    const c = at(mid, 0, off);
    root.add(boxAlong(d, c.x, DOOR_HEIGHT + CASING_W / 2, c.y, len + 2 * CASING_W, CASING_W, CASING_T, mat));
  }
}

/** Části modelu vstupních dveří (3D Warehouse), které tvoří křídlo – bez zárubně a kusu zdi. */
const FRONT_DOOR_PARTS = ['Light_Door_Panel_Wood_frasier', 'Door_Panel_Wood_Frasier', 'Color_M04', 'Color_M08'];

class HingedDoor implements Interactable {
  label: string;
  targets: THREE.Object3D[] = [];
  isOpen = false;
  private pivot = new THREE.Group();
  private angle = 0;
  private openAngle: number;
  private hinge: THREE.Vector2;
  private dir: THREE.Vector2;
  private width: number;
  private baseYaw: number;
  private center: THREE.Vector3;

  constructor(d: DoorDef, root: THREE.Object3D, top: number, collision: CollisionWorld, gltf: GLTFLoader) {
    this.label = d.label;
    const H = toWorld(d.hinge);
    const T = toWorld(d.tip);
    const O = toWorld(d.open);
    this.hinge = H;
    this.dir = T.clone().sub(H).normalize();
    this.center = new THREE.Vector3((H.x + T.x) / 2, root.position.y + 1, (H.y + T.y) / 2);
    this.width = H.distanceTo(T);
    this.baseYaw = yawFromDir(T.x - H.x, T.y - H.y);

    // Výchozí strana otvírání: rotace (±90°), která dostane konec křídla blíž k bodu "open".
    // Při otevření hráčem se strana volí znovu – dveře se otevřou od něj (viz interact).
    const rot = (v: THREE.Vector2, a: number) =>
      new THREE.Vector2(v.x * Math.cos(a) + v.y * Math.sin(a), -v.x * Math.sin(a) + v.y * Math.cos(a));
    const dir = T.clone().sub(H);
    const want = O.clone().sub(H);
    const plus = rot(dir, Math.PI / 2).distanceTo(want);
    const minus = rot(dir, -Math.PI / 2).distanceTo(want);
    this.openAngle = (plus < minus ? 1 : -1) * THREE.MathUtils.degToRad(95);

    const thick = 0.045;
    const leafW = this.width - 0.02;
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(leafW, DOOR_HEIGHT - 0.01, thick),
      d.id === 'front' ? frontDoorMat : doorMat,
    );
    leaf.position.set(0.01 + leafW / 2, DOOR_HEIGHT / 2, 0);
    leaf.userData.interactable = this;
    solid(leaf);
    this.pivot.add(leaf);
    const handles = new THREE.Group();
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), handleMat);
      handle.position.set(leafW - 0.09, 1.0, side * (thick / 2 + 0.03));
      handles.add(handle);
    }
    this.pivot.add(handles);
    if (d.id === 'front') this.loadFrontDoor(gltf, leaf, leafW, handles);
    this.pivot.userData.interactable = this; // i pro meshe modelu vstupních dveří
    this.pivot.position.set(H.x, 0, H.y);
    this.pivot.rotation.y = this.baseYaw;
    root.add(this.pivot);
    this.targets.push(leaf);

    // nadpraží a zárubeň
    root.add(solid(boxBetween(d.hinge, d.tip, pxToM(d.t ?? 6), DOOR_HEIGHT, top, lintelMat)));
    addCasing(root, H, T, pxToM(d.t ?? 6), d.id === 'front' ? frontCasingMat : casingMat);

    collision.addDynamic(() => {
      const yaw = this.baseYaw + this.angle;
      const tip = new THREE.Vector2(this.hinge.x + Math.cos(yaw) * this.width, this.hinge.y - Math.sin(yaw) * this.width);
      return [segOf(this.hinge, tip)];
    });
  }

  /** Vzhled vstupních dveří z modelu (kosočtvercové výplně); krabice křídla zůstane jako neviditelný cíl a kolize. */
  private loadFrontDoor(gltf: GLTFLoader, leaf: THREE.Mesh, leafW: number, handles: THREE.Object3D) {
    gltf
      .loadAsync('/models/custom/front_door.glb')
      .then((g) => {
        const parts: THREE.Mesh[] = [];
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && FRONT_DOOR_PARTS.includes((m.material as THREE.Material).name)) parts.push(m);
        });
        if (!parts.length) return;
        const panel = new THREE.Group();
        for (const m of parts) {
          m.updateWorldMatrix(true, false);
          const c = new THREE.Mesh(m.geometry, m.material);
          c.applyMatrix4(m.matrixWorld);
          panel.add(c);
        }
        // výplně jsou jen na jedné straně – zrcadlená kopie je dá i na druhou
        const back = panel.clone();
        back.scale.z = -1;
        const both = new THREE.Group().add(panel, back);
        const box = new THREE.Box3().setFromObject(panel);
        const size = box.getSize(new THREE.Vector3());
        // zrcadlit v ose X: klika modelu je u x = max, u nás je volný konec křídla na +X
        const sx = leafW / size.x;
        const sy = (DOOR_HEIGHT - 0.01) / size.y;
        both.scale.set(-sx, sy, 1);
        both.position.set(0.01 + box.max.x * sx, -box.min.y * sy, 0);
        both.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
        });
        leaf.material = hiddenMat;
        leaf.castShadow = false;
        this.pivot.remove(handles); // model má vlastní kliku a kukátko
        this.pivot.add(both);
        markShadows(2);
      })
      .catch((e) => console.warn('Model vstupních dveří se nepodařilo načíst', e));
  }

  hint() {
    return `${this.isOpen ? 'zavřít' : 'otevřít'}: ${this.label}`;
  }

  interact(from: THREE.Vector2) {
    if (!this.isOpen && Math.abs(this.angle) < 0.05) {
      // otevřít od hráče: rotace o +90° posílá konec křídla směrem (dir.y, -dir.x)
      const towardPlayer = this.dir.y * (from.x - this.hinge.x) - this.dir.x * (from.y - this.hinge.y) > 0;
      this.openAngle = (towardPlayer ? -1 : 1) * Math.abs(this.openAngle);
    }
    this.isOpen = !this.isOpen;
    audio.door(this.center, this.isOpen);
  }

  update(dt: number) {
    const target = this.isOpen ? this.openAngle : 0;
    if (Math.abs(target - this.angle) > 1e-4) markShadows(); // křídlo vrhá stín
    this.angle += (target - this.angle) * Math.min(1, dt * 6);
    this.pivot.rotation.y = this.baseYaw + this.angle;
  }
}

class SlidingDoor implements Interactable {
  label: string;
  targets: THREE.Object3D[] = [];
  isOpen = false;
  private panel = new THREE.Group();
  private t = 0;
  private A: THREE.Vector2;
  private B: THREE.Vector2;
  private offset: THREE.Vector2;
  private center: THREE.Vector3;

  constructor(s: SliderDef, root: THREE.Object3D, top: number, collision: CollisionWorld) {
    this.label = s.label;
    this.A = toWorld(s.a);
    this.B = toWorld(s.b);
    this.center = new THREE.Vector3((this.A.x + this.B.x) / 2, root.position.y + 1, (this.A.y + this.B.y) / 2);
    const len = this.A.distanceTo(this.B);
    const head = 2.4;
    // panel se při otevření posune o svou šířku směrem k bodu a (za pevné sklo)
    this.offset = this.A.clone().sub(this.B).multiplyScalar(0.92);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(len - 0.06, head - 0.06, 0.012), glassMat);
    glass.position.y = head / 2;
    glass.userData.interactable = this;
    this.panel.add(glass);
    for (const [w, h, x, y] of [
      [len, 0.05, 0, 0.025],
      [len, 0.05, 0, head - 0.025],
      [0.05, head, -len / 2 + 0.025, head / 2],
      [0.05, head, len / 2 - 0.025, head / 2],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), frameMat);
      bar.position.set(x, y, 0);
      this.panel.add(bar);
    }
    const yaw = yawFromDir(this.B.x - this.A.x, this.B.y - this.A.y);
    this.panel.rotation.y = yaw;
    // posun kolejnice o pár cm dovnitř, aby panel projel vedle pevného skla
    const n = new THREE.Vector2(-(this.B.y - this.A.y), this.B.x - this.A.x).normalize().multiplyScalar(0.05);
    this.A.add(n);
    this.B.add(n);
    this.place();
    root.add(this.panel);
    this.targets.push(glass);

    root.add(solid(boxBetween(s.a, s.b, pxToM(s.t ?? 4) + 0.04, head, top, lintelMat)));

    collision.addDynamic(() => {
      const o = this.offset.clone().multiplyScalar(this.t);
      return [segOf(this.A.clone().add(o), this.B.clone().add(o))];
    });
  }

  private place() {
    const o = this.offset.clone().multiplyScalar(this.t);
    this.panel.position.set((this.A.x + this.B.x) / 2 + o.x, 0, (this.A.y + this.B.y) / 2 + o.y);
  }

  hint() {
    return `${this.isOpen ? 'zavřít' : 'otevřít'}: ${this.label}`;
  }

  interact() {
    this.isOpen = !this.isOpen;
    audio.slide(this.center);
  }

  update(dt: number) {
    const target = this.isOpen ? 1 : 0;
    if (Math.abs(target - this.t) > 1e-4) markShadows();
    this.t += (target - this.t) * Math.min(1, dt * 5);
    this.place();
  }
}

/** Okno: parapetní zeď, sklo s rámem a nadpraží; nebo jen skleněná příčka (kind: "glass"). */
function buildWindow(w: WindowDef, root: THREE.Object3D, top: number, collision: CollisionWorld) {
  const t = pxToM(w.t ?? 8);
  if (w.kind !== 'glass') {
    if (w.sill > 0) root.add(solid(boxBetween(w.a, w.b, t, 0, w.sill, lintelMat)));
    if (w.head < top) root.add(solid(boxBetween(w.a, w.b, t, w.head, top, lintelMat)));
    root.add(solid(boxBetween(w.a, w.b, 0.06, w.sill, w.sill + 0.05, frameMat)));
    root.add(solid(boxBetween(w.a, w.b, 0.06, w.head - 0.05, w.head, frameMat)));
    // svislé rámy na koncích + vnitřní parapet
    const A = toWorld(w.a);
    const B = toWorld(w.b);
    const len = A.distanceTo(B);
    const d = B.clone().sub(A).divideScalar(len);
    for (const s of [0.025, len - 0.025]) {
      const c = A.clone().addScaledVector(d, s);
      root.add(boxAlong(d, c.x, (w.sill + w.head) / 2, c.y, 0.05, w.head - w.sill, 0.06, frameMat));
    }
    if (w.sill > 0.3) {
      const n = new THREE.Vector2(-d.y, d.x);
      const mid = A.clone().add(B).multiplyScalar(0.5);
      for (const side of [-1, 1]) {
        const c = mid.clone().addScaledVector(n, side * (t / 2 + 0.03));
        root.add(boxAlong(d, c.x, w.sill - 0.015, c.y, len + 0.06, 0.03, 0.08, casingMat));
      }
    }
  }
  const glass = boxBetween(w.a, w.b, 0.012, w.sill, w.head, glassMat);
  glass.renderOrder = 1;
  root.add(glass);
  collision.addStatic(segOf(toWorld(w.a), toWorld(w.b)));
}

function buildRailing(r: RailingDef, root: THREE.Object3D, collision: CollisionWorld) {
  root.add(boxBetween(r.a, r.b, 0.012, 0.05, r.h - 0.04, glassMat));
  root.add(boxBetween(r.a, r.b, 0.06, r.h - 0.04, r.h, frameMat));
  root.add(boxBetween(r.a, r.b, 0.05, 0, 0.05, frameMat));
  collision.addStatic(segOf(toWorld(r.a), toWorld(r.b)));
}

/**
 * Otvor se staví ve skupině posunuté na výšku podlahy (nižší z obou stran stěny);
 * `top` = výška stropu měřená od této podlahy, ať nadpraží sahá až ke stropu.
 */
function atFloor(root: THREE.Object3D, a: Px, b: Px): [THREE.Group, number] {
  const A = toWorld(a);
  const B = toWorld(b);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const n = new THREE.Vector2(-(B.y - A.y), B.x - A.x).normalize().multiplyScalar(0.35);
  const y = Math.min(floorHeight(mid.x + n.x, mid.y + n.y), floorHeight(mid.x - n.x, mid.y - n.y));
  const g = new THREE.Group();
  g.position.y = y;
  root.add(g);
  return [g, WALL_HEIGHT - y];
}

export interface OpeningsResult {
  doors: Interactable[];
  /** Je otevřený aspoň jeden posuvný panel na balkon (šum města)? */
  balconyOpen(): boolean;
}

export function buildOpenings(root: THREE.Object3D, collision: CollisionWorld, manager: THREE.LoadingManager): OpeningsResult {
  const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  const hinged = (data.doors as unknown as DoorDef[]).map((d) => new HingedDoor(d, ...atFloor(root, d.hinge, d.tip), collision, gltf));
  const sliders = (data.sliders as unknown as SliderDef[]).map((s) => new SlidingDoor(s, ...atFloor(root, s.a, s.b), collision));
  for (const w of data.windows as unknown as WindowDef[]) buildWindow(w, ...atFloor(root, w.a, w.b), collision);
  for (const r of data.railings as unknown as RailingDef[]) buildRailing(r, root, collision);
  return { doors: [...hinged, ...sliders], balconyOpen: () => sliders.some((s) => s.isOpen) };
}
