import * as THREE from 'three';
import furniture from '../data/furniture.json';
import openings from '../data/openings.json';
import { WALL_HEIGHT } from '../config';
import { audio } from '../audio';
import type { Interactable } from '../interact';
import { floorHeight } from '../levels';
import { toWorld, type Px } from '../plan';
import { nearestWallFace } from './walls';

/**
 * Okruh světel: stropní světla na jednom vypínači, nebo jedna lampa.
 * Bodová světla jsou viditelná jen v noci (počet světel ve scéně se mění jen přepnutím den/noc,
 * jinak by se při každém cvaknutí překompilovaly shadery); vypínač mění jen jejich intenzitu a záři stínidel.
 */
export class Circuit implements Interactable {
  targets: THREE.Object3D[] = [];
  private night = false;

  constructor(
    private label: string,
    private lights: THREE.PointLight[],
    private glow: THREE.MeshStandardMaterial[],
    public on: boolean,
    private power: number,
    private pos: THREE.Vector3,
    private onChange?: (on: boolean) => void,
  ) {
    this.apply();
  }

  hint() {
    return `${this.on ? 'zhasnout' : 'rozsvítit'}: ${this.label}`;
  }

  interact() {
    this.on = !this.on;
    audio.click(this.pos);
    this.apply();
  }

  setNight(night: boolean) {
    this.night = night;
    this.apply();
  }

  private apply() {
    for (const l of this.lights) {
      l.visible = this.night;
      l.intensity = this.on ? this.power : 0;
    }
    for (const m of this.glow) m.emissiveIntensity = this.on ? 1 : 0.04;
    this.onChange?.(this.on);
  }
}

interface SwitchDef {
  label: string;
  /** indexy do furniture.json → lights */
  lights: number[];
  /** bod u stěny v px půdorysu, nebo id dveří (vypínač se dá vedle dveří na straně kliky, dovnitř místnosti) */
  pos?: Px;
  door?: string;
  on?: boolean;
}

interface DoorDef {
  id: string;
  hinge: Px;
  tip: Px;
  open: Px;
}

const plateMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35 });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

/** Kde má vypínač být: zadaný bod, nebo kousek za klikou dveří na straně, kam se dveře otvírají. */
function switchSpot(sw: SwitchDef): THREE.Vector2 {
  const door = sw.door && (openings.doors as unknown as DoorDef[]).find((d) => d.id === sw.door);
  if (!door) return toWorld(sw.pos ?? [0, 0]);
  const H = toWorld(door.hinge);
  const T = toWorld(door.tip);
  const O = toWorld(door.open);
  const dir = T.clone().sub(H).normalize();
  const n = new THREE.Vector2(-dir.y, dir.x);
  if (n.dot(O.clone().sub(H)) < 0) n.negate();
  return T.addScaledVector(dir, 0.2).addScaledVector(n, 0.15);
}

/**
 * Stropní svítidla (bodové světlo pod stropem + kruhové stínidlo) a vypínače u dveří.
 * Data: furniture.json → lights (polohy v px) a switches (které světlo patří ke kterému vypínači).
 */
export function buildLighting(root: THREE.Object3D): Circuit[] {
  const discGeo = new THREE.CircleGeometry(0.18, 24).rotateX(Math.PI / 2);
  const lamps = (furniture.lights as unknown as Px[]).map((px) => {
    const p = toWorld(px);
    const light = new THREE.PointLight(0xffe2b8, 0, 10, 1.5);
    light.position.set(p.x, 2.1, p.y);
    root.add(light);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2eee6, emissive: 0xfff1dc, roughness: 0.6 });
    const disc = new THREE.Mesh(discGeo, mat);
    disc.position.set(p.x, WALL_HEIGHT - 0.01, p.y);
    root.add(disc);
    return { light, mat };
  });

  const circuits: Circuit[] = [];
  for (const sw of furniture.switches as unknown as SwitchDef[]) {
    const spot = switchSpot(sw);
    const face = nearestWallFace(spot);
    if (!face) continue;
    const g = new THREE.Group();
    g.position.set(face.point.x + face.normal.x * 0.008, floorHeight(spot.x, spot.y) + 1.15, face.point.y + face.normal.y * 0.008);
    g.rotation.y = Math.atan2(face.normal.x, face.normal.y);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.012), plateMat));
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.012), plateMat);
    rocker.position.z = 0.009;
    g.add(rocker);
    // větší neviditelná plocha, ať se na malý vypínač dá snadno zamířit
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.05), hitMat);
    g.add(hit);
    root.add(g);
    const parts = sw.lights.map((i) => lamps[i]).filter(Boolean);
    const c = new Circuit(
      sw.label,
      parts.map((l) => l.light),
      parts.map((l) => l.mat),
      sw.on ?? false,
      9,
      g.position.clone(),
      (on) => (rocker.rotation.x = on ? -0.18 : 0.18),
    );
    g.userData.interactable = c;
    c.targets.push(g);
    circuits.push(c);
  }
  return circuits;
}
