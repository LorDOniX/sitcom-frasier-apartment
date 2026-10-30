import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import data from '../data/furniture.json';
import info from '../data/info.json';
import { toWorld, type Px } from '../plan';
import type { CollisionWorld } from '../collision';
import type { Interactable } from '../interact';
import { markShadows } from '../quality';
import { floorHeight } from '../levels';
import { InfoItem, PianoPlayer, RadioSet } from './actions';
import { Circuit } from './lighting';
import { abstractPainting, PropFactory } from './props';
import { nearestWallFace } from './walls';

/**
 * Položka nábytku (src/data/furniture.json).
 * - `kind`  = procedurální model (viz props.ts), nebo
 * - `model` = název modelu z Poly Haven (public/models/<model>.glb), nebo přímá cesta k .glb/.gltf.
 *   Modely v public/ jsou optimalizované z assets/ (npm run assets): meshopt + WebP.
 * Modely jsou ve skutečném měřítku; `scale` je zvětší/zmenší, `fit: "box"` je natáhne
 * přesně na size × h. Kolize je obdélník size, pokud není `collide: false`.
 */
interface Item {
  name: string;
  kind?: string;
  model?: string;
  pos: Px;
  size: [number, number];
  rot: number;
  h?: number;
  y?: number;
  scale?: number;
  fit?: 'box';
  /** dodatečné natočení modelu (°), když vlastní model nemíří přední stranou na +Z */
  modelRot?: number;
  collide?: boolean;
  color?: string;
  seed?: number;
  sink?: boolean;
  /** barva pracovní desky (kuchyň) */
  top?: string;
  /** obrys v px půdorysu (koberec přes celou místnost); rot se u něj ignoruje */
  poly?: Px[];
  /** lampa: E ji rozsvítí / zhasne; on = rozsvícená na začátku, power = intenzita světla */
  light?: boolean;
  on?: boolean;
  power?: number;
  /** přichytit zády k nejbližší stěně (obrazy, krb); pos = bod v místnosti u stěny, y = výška spodku */
  wall?: boolean;
  /** visí ze stropu: y se měří od výšky 0, ne od podlahy pod ním (lustry nad sníženou částí bytu) */
  hang?: boolean;
}

interface Painting {
  /** vlastní obrázek (např. /paintings/abstrakt.jpg) místo procedurální malby */
  image?: string;
  pos: Px;
  w: number;
  h: number;
  y: number;
  seed: number;
  style?: string;
}

export interface FurnitureResult {
  /** Lampy (E je rozsvítí / zhasne). */
  lamps: Circuit[];
  /** Vše, s čím jde zacházet klávesou E: lampy, klavír, rádio, popisky. */
  interactables: Interactable[];
}

const infoItems = info.items as Record<string, { title: string; text: string }>;

export function buildFurniture(
  root: THREE.Object3D,
  collision: CollisionWorld,
  loader: THREE.TextureLoader,
  aniso: number,
): FurnitureResult {
  const props = new PropFactory(loader, aniso);
  const gltf = new GLTFLoader(loader.manager).setMeshoptDecoder(MeshoptDecoder);
  const models = new Map<string, Promise<THREE.Object3D>>();
  const lamps: Circuit[] = [];
  const interactables: Interactable[] = [];

  const loadModel = (name: string) => {
    let p = models.get(name);
    if (!p) {
      const url = /\.(glb|gltf)$/.test(name) ? name : `/models/${name}.glb`;
      p = gltf.loadAsync(url).then((g) => {
        g.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = mesh.receiveShadow = true;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) if (t) t.anisotropy = aniso;
        });
        return g.scene;
      });
      models.set(name, p);
    }
    return p;
  };

  for (const it of data.items as unknown as Item[]) {
    const p = toWorld(it.pos);
    const floorY = it.hang ? 0 : floorHeight(p.x, p.y);
    let yaw = -THREE.MathUtils.degToRad(it.rot); // rot v půdorysu je po směru hodinových ručiček
    if (it.wall) {
      const face = nearestWallFace(p);
      if (face) {
        p.copy(face.point).addScaledVector(face.normal, it.size[1] / 2 + 0.005);
        yaw = Math.atan2(face.normal.x, face.normal.y);
      }
    }
    const holder = new THREE.Group();
    holder.position.set(p.x, floorY + (it.y ?? 0), p.y);
    holder.rotation.y = yaw;
    holder.name = it.name;
    root.add(holder);

    if (it.model) {
      loadModel(it.model)
        .then((src) => {
          holder.add(fitModel(src.clone(), it));
          markShadows(2);
        })
        .catch((e) => console.warn(`Model ${it.model} (${it.name}) se nepodařilo načíst`, e));
    }
    let obj: THREE.Object3D | null = null;
    if (!it.model && it.kind) {
      const poly = it.poly?.map((q): [number, number] => {
        const v = toWorld(q);
        return [v.x - p.x, v.y - p.y];
      });
      if (poly) holder.rotation.y = 0;
      obj = props.build({ kind: it.kind, size: it.size, h: it.h ?? 0.8, color: it.color, seed: it.seed, sink: it.sink, top: it.top, poly });
      if (obj) {
        obj.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
        });
        holder.add(obj);
      }
    }

    const act = makeAction(it, holder, obj);
    if (act) {
      holder.userData.interactable = act;
      act.targets.push(holder);
      interactables.push(act);
      if (act instanceof Circuit) lamps.push(act);
    }

    if (it.collide !== false) {
      const [w, d] = it.size;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      collision.addPolygon(
        [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ].map(([x, z]) => new THREE.Vector2(p.x + x * c + z * s, p.y - x * s + z * c)),
      );
    }
  }

  for (const pt of data.paintings as unknown as Painting[]) root.add(buildPainting(pt, loader, aniso));
  return { lamps, interactables };
}

/** Co dělá E u předmětu: lampa (light), klavír, rádio, nebo popisek z info.json. */
function makeAction(it: Item, holder: THREE.Object3D, obj: THREE.Object3D | null): Interactable | null {
  holder.updateMatrixWorld(true);
  const center = holder.localToWorld(new THREE.Vector3(0, (it.h ?? 0.8) / 2, 0));
  if (it.light) {
    const l = new THREE.PointLight(0xffd9a0, 0, 6, 1.6);
    l.position.set(0, (it.h ?? 1.6) - 0.15, 0);
    holder.add(l);
    // záře stínidla (procedurální lampa má materiál „lampshade“); vlastní kopie, ať svítí jen tahle lampa
    const glow: THREE.MeshStandardMaterial[] = [];
    obj?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === 'lampshade') {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.emissive.set(0xffd9a0);
        m.material = mat;
        glow.push(mat);
      }
    });
    return new Circuit(it.name, [l], glow, !!it.on, it.power ?? 6, center);
  }
  if (it.kind === 'piano') return new PianoPlayer(center);
  if (it.kind === 'radio') {
    const dial = obj?.getObjectByName('dial') as THREE.Mesh | undefined;
    return new RadioSet(center, (on) => {
      if (dial) (dial.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 1 : 0;
    });
  }
  const text = infoItems[it.name];
  return text ? new InfoItem(text.title, text.text) : null;
}

/** Vycentruje model na podlahu a přizpůsobí velikost. */
function fitModel(obj: THREE.Object3D, it: Item): THREE.Object3D {
  if (it.modelRot) {
    obj.rotation.y = THREE.MathUtils.degToRad(it.modelRot);
    obj.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  obj.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  wrap.add(obj);
  if (it.fit === 'box') {
    wrap.scale.set(it.size[0] / size.x, (it.h ?? size.y) / size.y, it.size[1] / size.z);
  } else {
    wrap.scale.setScalar(it.scale ?? 1);
  }
  return wrap;
}

/** Obraz zavěšený na nejbližší stěně: plátno s procedurální malbou v tenkém rámu. */
function buildPainting(pt: Painting, loader: THREE.TextureLoader, aniso: number): THREE.Object3D {
  const g = new THREE.Group();
  const face = nearestWallFace(toWorld(pt.pos));
  if (!face) return g;
  const tex = pt.image
    ? loader.load(pt.image)
    : new THREE.CanvasTexture(abstractPainting(pt.seed, pt.w / pt.h, pt.style ?? 'abstract'));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  const edge = new THREE.MeshStandardMaterial({ color: 0xf2efe8 });
  const canvas = new THREE.Mesh(new THREE.BoxGeometry(pt.w, pt.h, 0.03), [
    edge,
    edge,
    edge,
    edge,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    edge,
  ]);
  canvas.castShadow = true;
  g.add(canvas);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.4 });
  const f = 0.025;
  for (const [w, h, x, y] of [
    [pt.w + 2 * f, f, 0, pt.h / 2 + f / 2],
    [pt.w + 2 * f, f, 0, -pt.h / 2 - f / 2],
    [f, pt.h, -pt.w / 2 - f / 2, 0],
    [f, pt.h, pt.w / 2 + f / 2, 0],
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.045), frameMat);
    m.position.set(x, y, 0);
    g.add(m);
  }
  // přední strana plátna (+Z) míří od stěny do místnosti
  const p = toWorld(pt.pos);
  g.position.set(face.point.x + face.normal.x * 0.03, floorHeight(p.x, p.y) + pt.y, face.point.y + face.normal.y * 0.03);
  g.rotation.y = Math.atan2(face.normal.x, face.normal.y);
  return g;
}
