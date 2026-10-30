import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import data from '../data/furniture.json';
import { WALL_HEIGHT } from '../config';
import { toWorld, type Px } from '../plan';
import type { CollisionWorld } from '../collision';
import { floorHeight } from '../levels';
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
  light?: boolean;
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
  /** Světla, která svítí jen v noci (stojací lampa apod.). */
  nightLights: THREE.PointLight[];
}

export function buildFurniture(
  root: THREE.Object3D,
  collision: CollisionWorld,
  loader: THREE.TextureLoader,
  aniso: number,
): FurnitureResult {
  const props = new PropFactory(loader, aniso);
  const gltf = new GLTFLoader(loader.manager).setMeshoptDecoder(MeshoptDecoder);
  const models = new Map<string, Promise<THREE.Object3D>>();
  const nightLights: THREE.PointLight[] = [];

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
        .then((src) => holder.add(fitModel(src.clone(), it)))
        .catch((e) => console.warn(`Model ${it.model} (${it.name}) se nepodařilo načíst`, e));
    } else if (it.kind) {
      const poly = it.poly?.map((q): [number, number] => {
        const v = toWorld(q);
        return [v.x - p.x, v.y - p.y];
      });
      if (poly) holder.rotation.y = 0;
      const obj = props.build({ kind: it.kind, size: it.size, h: it.h ?? 0.8, color: it.color, seed: it.seed, sink: it.sink, top: it.top, poly });
      if (obj) {
        obj.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
        });
        holder.add(obj);
      }
    }

    if (it.light) {
      const l = new THREE.PointLight(0xffd9a0, 0, 6, 1.6);
      l.position.set(0, (it.h ?? 1.6) - 0.15, 0);
      l.visible = false;
      holder.add(l);
      nightLights.push(l);
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
  return { nightLights };
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
