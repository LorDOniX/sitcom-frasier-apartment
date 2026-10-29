import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loadPbr } from './materials';

/**
 * Procedurální modely nábytku (fáze 3) pro kusy, které nejsou volně k dispozici jako glTF:
 * Frasierova pohovka, Martinovo křeslo, klavír, kuchyň, postele, koupelny, obrazy, koberec.
 *
 * Konvence: lokální osa X = šířka (size[0]), Z = hloubka (size[1]), Y nahoru, počátek uprostřed
 * na podlaze. Přední strana míří na +Z (opěradlo, čelo postele, klaviatura a nádrž WC jsou na -Z).
 */
export interface PropDef {
  kind: string;
  size: [number, number];
  h: number;
  color?: string;
  seed?: number;
  sink?: boolean;
}

export class PropFactory {
  private loader: THREE.TextureLoader;
  private aniso: number;
  private cache = new Map<string, THREE.Material>();

  constructor(loader: THREE.TextureLoader, aniso: number) {
    this.loader = loader;
    this.aniso = aniso;
  }

  build(def: PropDef): THREE.Group | null {
    const g = new THREE.Group();
    const [w, d] = def.size;
    const h = def.h;
    switch (def.kind) {
      case 'sofa':
        this.sofa(g, w, d, h, 3, this.fabric('Fabric028', 0xffffff, 1.2));
        break;
      case 'loveseat':
        this.sofa(g, w, d, h, 2, this.fabric('Fabric061', def.color ?? '#c98a2e', 1.2));
        break;
      case 'recliner':
        this.recliner(g, w, d, h);
        break;
      case 'armchair':
        this.armchair(g, w, d, h, this.fabric('Fabric061', def.color ?? '#888888', 1));
        break;
      case 'bed':
        this.bed(g, w, d, def.color ?? '#2f5f9e');
        break;
      case 'piano':
        this.piano(g, w, d, h);
        break;
      case 'bench':
        g.add(rbox(w, 0.08, d, this.leather(), 0, h - 0.08, 0, 0.02));
        for (const [x, z] of corners(w - 0.08, d - 0.08)) g.add(box(0.04, h - 0.08, 0.04, this.lacquer(), x, 0, z));
        break;
      case 'counter':
        this.counter(g, w, d, h, def.color ?? '#9c4a32', !!def.sink);
        break;
      case 'island':
        this.island(g, w, d, h, def.color ?? '#9c4a32');
        break;
      case 'cabinet':
        g.add(box(w, h, d, this.paint(def.color ?? '#c58a4a', 0.55)));
        g.add(box(w + 0.02, 0.03, d + 0.02, this.paint(def.color ?? '#c58a4a', 0.4), 0, h, 0));
        break;
      case 'stool':
        this.stool(g, h, def.color ?? '#d9822b');
        break;
      case 'table':
        this.diningTable(g, w, h);
        break;
      case 'pedestal': {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 + 0.03, h, 40), this.paint(def.color ?? '#b9732e', 0.45));
        c.position.y = h / 2;
        g.add(c);
        break;
      }
      case 'floorlamp':
        this.floorLamp(g, h);
        break;
      case 'tub':
        this.tub(g, w, d, h, '#f4f2ee');
        break;
      case 'clawtub':
        this.tub(g, w, d, h, def.color ?? '#1e1e1e', true);
        break;
      case 'toilet':
        this.toilet(g);
        break;
      case 'vanity':
        this.vanity(g, w, d, h);
        break;
      case 'rug':
        this.rug(g, w, d, def.color ?? '#8e3b2e', def.seed ?? 1);
        break;
      default:
        return null;
    }
    return g;
  }

  // --- materiály -------------------------------------------------------------

  private mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.cache.get(key);
    if (!m) this.cache.set(key, (m = make()));
    return m;
  }

  /** Látka z public/textures (ambientCG), tónovaná barvou; repeat = opakování na metr. */
  fabric(dir: string, color: THREE.ColorRepresentation, repeat: number): THREE.Material {
    return this.mat(`fabric:${dir}:${color}:${repeat}`, () => {
      const pbr = loadPbr(this.loader, dir, new THREE.Vector2(repeat, repeat), this.aniso);
      return new THREE.MeshStandardMaterial({ ...pbr, color, roughness: 1 });
    });
  }

  paint(color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0): THREE.Material {
    return this.mat(`paint:${color}:${roughness}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }

  private leather() {
    return this.paint('#1b1714', 0.45);
  }
  private lacquer() {
    return this.mat('lacquer', () => new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }));
  }
  private chrome() {
    return this.paint('#d8dade', 0.15, 1);
  }
  private brass() {
    return this.paint('#c9a14a', 0.28, 1);
  }
  private ceramic() {
    return this.mat('ceramic', () => new THREE.MeshPhysicalMaterial({ color: 0xf7f6f2, roughness: 0.12, clearcoat: 0.6 }));
  }
  private wood() {
    return this.paint('#3b2618', 0.55);
  }

  // --- sedací nábytek --------------------------------------------------------

  private sofa(g: THREE.Group, w: number, d: number, h: number, seats: number, fab: THREE.Material) {
    const armW = 0.2;
    const baseH = 0.26;
    const seatH = 0.17;
    const inner = w - 2 * armW;
    g.add(rbox(w - 0.04, baseH, d - 0.04, fab, 0, 0.08, 0, 0.03));
    for (const [x, z] of corners(w - 0.12, d - 0.12)) g.add(box(0.05, 0.08, 0.05, this.wood(), x, 0, z));
    const sw = inner / seats;
    for (let i = 0; i < seats; i++) {
      const x = -inner / 2 + sw * (i + 0.5);
      g.add(rbox(sw - 0.015, seatH, d - 0.28, fab, x, 0.08 + baseH, 0.1, 0.06));
      const back = rbox(sw - 0.02, h - 0.08 - baseH - 0.02, 0.22, fab, x, 0.08 + baseH, -d / 2 + 0.13, 0.08);
      back.rotation.x = -0.12;
      g.add(back);
    }
    // zadní rám a válcové područky
    g.add(rbox(w, h - 0.3, 0.12, fab, 0, 0.3, -d / 2 + 0.06, 0.04));
    for (const s of [-1, 1]) {
      g.add(rbox(armW, h * 0.72 - 0.08, d, fab, s * (w / 2 - armW / 2), 0.08, 0, 0.08));
    }
  }

  /** Martinovo legendární křeslo: pruhovaná látka, vysunutá podnožka a izolepa na područce. */
  private recliner(g: THREE.Group, w: number, d: number, h: number) {
    const fab = this.mat('recliner', () => {
      const pbr = loadPbr(this.loader, 'Fabric061', new THREE.Vector2(1, 1), this.aniso, ['normalMap', 'roughnessMap']);
      const t = new THREE.CanvasTexture(stripes());
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1.5, 1.5);
      t.anisotropy = this.aniso;
      return new THREE.MeshStandardMaterial({ ...pbr, map: t, roughness: 1 });
    });
    const chairD = Math.min(0.95, d);
    const z0 = -d / 2 + chairD / 2; // křeslo vzadu, podnožka vpředu
    const armW = 0.18;
    g.add(rbox(w - 0.04, 0.3, chairD - 0.05, fab, 0, 0.06, z0, 0.04));
    g.add(rbox(w - 2 * armW, 0.18, chairD - 0.3, fab, 0, 0.36, z0 + 0.1, 0.07));
    const back = rbox(w - 0.1, h - 0.38, 0.26, fab, 0, 0.36, z0 - chairD / 2 + 0.16, 0.1);
    back.rotation.x = -0.22;
    g.add(back);
    for (const s of [-1, 1]) g.add(rbox(armW, 0.32, chairD - 0.1, fab, s * (w / 2 - armW / 2), 0.32, z0 + 0.02, 0.08));
    // vysunutá podnožka
    const legLen = d - chairD;
    if (legLen > 0.15) {
      g.add(rbox(w - 2 * armW - 0.04, 0.12, legLen, fab, 0, 0.3, z0 + chairD / 2 + legLen / 2 - 0.02, 0.05));
      g.add(box(0.03, 0.26, 0.03, this.paint('#2a2a2a', 0.5, 0.6), 0, 0.04, z0 + chairD / 2 + legLen / 2));
    }
    // izolepa
    const tape = this.paint('#a7abaf', 0.35, 0.4);
    const patch = box(0.13, 0.012, 0.22, tape, w / 2 - armW / 2, 0.64, z0 + 0.12);
    patch.rotation.y = 0.3;
    g.add(patch);
    g.add(box(armW + 0.01, 0.1, 0.06, tape, -(w / 2 - armW / 2), 0.55, z0 + chairD / 2 - 0.08));
  }

  private armchair(g: THREE.Group, w: number, d: number, h: number, fab: THREE.Material) {
    g.add(rbox(w, 0.42, d, fab, 0, 0.06, 0, 0.05));
    g.add(rbox(w, h - 0.42, 0.18, fab, 0, 0.42, -d / 2 + 0.09, 0.06));
    for (const s of [-1, 1]) g.add(rbox(0.12, 0.22, d - 0.1, fab, s * (w / 2 - 0.06), 0.42, 0.05, 0.05));
    for (const [x, z] of corners(w - 0.1, d - 0.1)) g.add(box(0.04, 0.06, 0.04, this.wood(), x, 0, z));
  }

  private bed(g: THREE.Group, w: number, d: number, color: string) {
    const frame = this.wood();
    const linen = this.fabric('Fabric061', '#f3efe6', 1.5);
    const duvet = this.fabric('Fabric061', color, 1.2);
    g.add(box(w, 0.3, d, frame, 0, 0.05, 0));
    for (const [x, z] of corners(w - 0.08, d - 0.08)) g.add(box(0.06, 0.05, 0.06, frame, x, 0, z));
    g.add(rbox(w - 0.06, 0.22, d - 0.08, linen, 0, 0.35, 0.02, 0.05));
    g.add(rbox(w - 0.02, 0.1, d * 0.66, duvet, 0, 0.52, d * 0.15, 0.05));
    g.add(rbox(w - 0.02, 0.06, 0.32, duvet, 0, 0.53, -d * 0.12, 0.03));
    const pillows = w > 1.2 ? 2 : 1;
    for (let i = 0; i < pillows; i++) {
      const x = pillows === 1 ? 0 : (i - 0.5) * (w / 2);
      const p = rbox(w / pillows - 0.12, 0.14, 0.42, linen, x, 0.57, -d / 2 + 0.3, 0.06);
      p.rotation.x = -0.25;
      g.add(p);
    }
    g.add(rbox(w + 0.06, 1.1, 0.1, this.fabric('Fabric061', '#8a7b68', 1), 0, 0, -d / 2 - 0.05, 0.03));
  }

  // --- klavír ----------------------------------------------------------------

  private piano(g: THREE.Group, w: number, d: number, h: number) {
    const lac = this.lacquer();
    const top = h; // horní hrana korpusu
    const bodyH = 0.32;
    // obrys křídla (pohled shora): klaviatura na -Z, rovná basová strana na +X, zakřivená výšková na -X
    const s = new THREE.Shape();
    const z0 = -d / 2 + 0.12;
    s.moveTo(w / 2, z0);
    s.lineTo(w / 2, d / 2 - 0.25);
    s.quadraticCurveTo(w / 2, d / 2, w / 2 - 0.3, d / 2);
    s.bezierCurveTo(w * 0.05, d / 2, -w * 0.05, d * 0.12, -w / 2 + 0.05, -d * 0.12);
    s.lineTo(-w / 2, z0);
    s.lineTo(w / 2, z0);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: bodyH, bevelEnabled: false, curveSegments: 24 }), lac);
    body.rotation.x = Math.PI / 2;
    body.position.y = top;
    g.add(body);
    // víko podepřené tyčkou (pant na basové straně)
    const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: 24 }), lac);
    lid.rotation.x = Math.PI / 2;
    const hinge = new THREE.Group();
    hinge.position.set(w / 2, top + 0.02, 0);
    lid.position.set(-w / 2, 0, 0);
    hinge.add(lid);
    hinge.rotation.z = -0.55;
    g.add(hinge);
    const stickLen = Math.sin(0.55) * (w - 0.3);
    const stick = box(0.02, stickLen, 0.02, lac, -w / 2 + 0.35, top, 0.1);
    g.add(stick);
    // klaviatura
    const keyZ = -d / 2 + 0.07;
    g.add(box(w, 0.1, 0.18, lac, 0, top - bodyH - 0.02, keyZ));
    const white = 52;
    const kw = (w - 0.12) / white;
    const whiteKeys = new THREE.InstancedMesh(new THREE.BoxGeometry(kw * 0.92, 0.022, 0.15), this.ceramic(), white);
    const m = new THREE.Matrix4();
    for (let i = 0; i < white; i++) {
      whiteKeys.setMatrixAt(i, m.makeTranslation(-w / 2 + 0.06 + kw * (i + 0.5), top - bodyH + 0.09, keyZ - 0.01));
    }
    g.add(whiteKeys);
    const pattern = [1, 1, 0, 1, 1, 1, 0]; // černé klávesy za bílými (C D _ F G A _)
    const blacks: number[] = [];
    for (let i = 0; i < white - 1; i++) if (pattern[(i + 5) % 7]) blacks.push(i);
    const blackKeys = new THREE.InstancedMesh(new THREE.BoxGeometry(kw * 0.55, 0.03, 0.09), lac, blacks.length);
    blacks.forEach((i, n) => {
      blackKeys.setMatrixAt(n, m.makeTranslation(-w / 2 + 0.06 + kw * (i + 1), top - bodyH + 0.105, keyZ + 0.02));
    });
    g.add(blackKeys);
    // pultík na noty
    const desk = box(w * 0.5, 0.26, 0.015, lac, 0, top + 0.02, z0 + 0.12);
    desk.rotation.x = -0.25;
    g.add(desk);
    // nohy a lyra s pedály
    const legH = top - bodyH;
    for (const [x, z] of [[w / 2 - 0.12, z0 + 0.12], [-w / 2 + 0.12, z0 + 0.12], [w * 0.15, d / 2 - 0.25]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, legH, 12), lac);
      leg.position.set(x, legH / 2, z);
      g.add(leg);
    }
    g.add(box(0.16, legH * 0.85, 0.04, lac, 0, 0, z0 + 0.15));
    for (const x of [-0.04, 0, 0.04]) g.add(box(0.022, 0.012, 0.09, this.brass(), x, 0.06, z0 + 0.1));
  }

  // --- kuchyň ----------------------------------------------------------------

  private counter(g: THREE.Group, w: number, d: number, h: number, color: string, sink: boolean) {
    const body = this.paint(color, 0.5);
    const top = this.paint('#2b2826', 0.25);
    const handle = this.chrome();
    g.add(box(w, 0.1, d - 0.06, this.paint('#1a1a1a', 0.8), 0, 0, -0.03));
    g.add(box(w, h - 0.14, d - 0.04, body, 0, 0.1, -0.02));
    const doors = Math.max(1, Math.round(w / 0.6));
    const dw = w / doors;
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + dw * (i + 0.5);
      g.add(box(dw - 0.008, h - 0.18, 0.02, body, x, 0.12, d / 2 - 0.03));
      g.add(box(0.012, 0.012, 0.14, handle, x + dw / 2 - 0.06, h - 0.2, d / 2 - 0.005).rotateX(Math.PI / 2));
    }
    g.add(box(w + 0.02, 0.04, d + 0.02, top, 0, h - 0.04, 0));
    if (sink) {
      g.add(box(0.7, 0.012, 0.42, this.paint('#8d9196', 0.25, 1), 0, h + 0.001, 0.02));
      g.add(box(0.03, 0.3, 0.03, handle, 0, h, -d / 2 + 0.1));
      g.add(box(0.03, 0.03, 0.2, handle, 0, h + 0.28, -d / 2 + 0.18));
    }
  }

  private island(g: THREE.Group, w: number, d: number, h: number, color: string) {
    this.counter(g, w - 0.25, d - 0.25, h, color, false);
    g.add(box(w, 0.04, d, this.paint('#2b2826', 0.25), 0, h - 0.04, 0));
    // varná deska (v půdorysu 4 plotýnky)
    g.add(box(0.6, 0.008, 0.52, this.paint('#0a0a0a', 0.1), 0, h, 0));
    const ring = this.paint('#3a3a3a', 0.4);
    for (const [x, z, r] of [[-0.15, -0.13, 0.09], [0.15, -0.13, 0.07], [-0.15, 0.13, 0.07], [0.15, 0.13, 0.09]]) {
      const c = new THREE.Mesh(new THREE.RingGeometry(r - 0.012, r, 32).rotateX(-Math.PI / 2), ring);
      c.position.set(x, h + 0.009, z);
      g.add(c);
    }
  }

  private stool(g: THREE.Group, h: number, color: string) {
    const c = this.chrome();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.07, 32), this.fabric('Fabric061', color, 2));
    seat.position.y = h - 0.035;
    g.add(seat);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h - 0.07, 12), c);
    post.position.y = (h - 0.07) / 2;
    g.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 32), c);
    base.position.y = 0.01;
    g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 8, 32).rotateX(Math.PI / 2), c);
    ring.position.y = h * 0.38;
    g.add(ring);
  }

  private diningTable(g: THREE.Group, w: number, h: number) {
    const glass = this.mat('tableGlass', () => new THREE.MeshPhysicalMaterial({
      color: 0xbfe3e6, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1,
    }));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.02, 64), glass);
    top.position.y = h;
    g.add(top);
    const c = this.chrome();
    // podnož do X (je vidět i v půdorysu přes sklo)
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = box(w * 0.7, 0.04, 0.06, c, 0, 0, 0);
      bar.rotation.y = a;
      g.add(bar);
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h - 0.06, 16), c);
    post.position.y = (h - 0.06) / 2 + 0.04;
    g.add(post);
  }

  private floorLamp(g: THREE.Group, h: number) {
    const b = this.brass();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.03, 32), b);
    base.position.y = 0.015;
    g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.2, 12), b);
    pole.position.y = (h - 0.2) / 2;
    g.add(pole);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.24, 0.26, 40, 1, true),
      this.mat('shade', () => new THREE.MeshStandardMaterial({ color: 0xf1e6cf, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a2010 })),
    );
    shade.position.y = h - 0.13;
    g.add(shade);
  }

  // --- koupelny --------------------------------------------------------------

  private tub(g: THREE.Group, w: number, d: number, h: number, color: string, claw = false) {
    const outer = claw ? this.paint(color, 0.25) : this.ceramic();
    const inner = this.ceramic();
    const t = 0.07;
    const y0 = claw ? 0.12 : 0;
    const hh = h - y0;
    g.add(rbox(w, 0.08, d, outer, 0, y0, 0, 0.03));
    for (const s of [-1, 1]) {
      g.add(rbox(t, hh, d, outer, s * (w / 2 - t / 2), y0, 0, 0.03));
      g.add(rbox(w, hh, t, outer, 0, y0, s * (d / 2 - t / 2), 0.03));
    }
    g.add(box(w - 2 * t, 0.01, d - 2 * t, inner, 0, y0 + 0.08, 0));
    if (claw) for (const [x, z] of corners(w - 0.14, d - 0.2)) g.add(box(0.06, 0.13, 0.06, this.brass(), x, 0, z));
    // baterie
    g.add(box(0.03, 0.18, 0.03, this.chrome(), 0, h, -d / 2 + 0.05));
  }

  private toilet(g: THREE.Group) {
    const c = this.ceramic();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.4, 24), c);
    bowl.scale.z = 1.3;
    bowl.position.set(0, 0.2, 0.06);
    g.add(bowl);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 24), c);
    seat.scale.z = 1.3;
    seat.position.set(0, 0.41, 0.06);
    g.add(seat);
    g.add(rbox(0.42, 0.38, 0.18, c, 0, 0.4, -0.22, 0.03));
  }

  private vanity(g: THREE.Group, w: number, d: number, h: number) {
    g.add(box(w, h - 0.06, d, this.paint('#e9e3d8', 0.4), 0, 0, 0));
    g.add(box(w + 0.02, 0.05, d + 0.02, this.paint('#dcd6cc', 0.15), 0, h - 0.06, 0));
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.12, 32), this.ceramic());
    basin.scale.z = Math.min(1, (d - 0.12) / 0.4);
    basin.position.set(0, h + 0.04, 0.03);
    g.add(basin);
    g.add(box(0.025, 0.2, 0.025, this.chrome(), 0, h, -d / 2 + 0.06));
    g.add(box(0.025, 0.025, 0.12, this.chrome(), 0, h + 0.19, -d / 2 + 0.11));
  }

  // --- textilie ----------------------------------------------------------------

  private rug(g: THREE.Group, w: number, d: number, color: string, seed: number) {
    const tex = new THREE.CanvasTexture(rugPattern(color, seed));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.aniso;
    const nor = loadPbr(this.loader, 'Carpet016', new THREE.Vector2(w * 1.5, d * 1.5), this.aniso, ['normalMap']);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: tex, ...nor, roughness: 1 }),
    );
    m.position.y = 0.006;
    m.receiveShadow = true;
    g.add(m);
  }
}

// --- pomocné funkce -----------------------------------------------------------

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

function rbox(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r = 0.04): THREE.Mesh {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, rr)), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

function corners(w: number, d: number): [number, number][] {
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
}

function seeded(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Pruhovaná látka Martinova křesla (olivová, hnědá, hořčicová, rezavá). */
function stripes(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const cols = ['#6f6a3a', '#4e3b26', '#b08a3c', '#8a4a2a', '#7c7a4e', '#5b4630'];
  let x = 0;
  const rnd = seeded(5);
  let i = 0;
  while (x < 256) {
    const sw = 6 + Math.floor(rnd() * 18);
    g.fillStyle = cols[i++ % cols.length];
    g.fillRect(x, 0, sw, 256);
    x += sw;
  }
  // jemná osnova
  g.globalAlpha = 0.12;
  g.fillStyle = '#000';
  for (let y = 0; y < 256; y += 3) g.fillRect(0, y, 256, 1);
  return c;
}

/** Koberec s bordurou a jemným vzorem. */
function rugPattern(color: string, seed: number): HTMLCanvasElement {
  const W = 1024;
  const H = 768;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rnd = seeded(seed);
  g.fillStyle = '#e8dcc4';
  g.fillRect(0, 0, W, H);
  const band = (inset: number, width: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset);
  };
  band(30, 40, color);
  band(70, 8, '#2d3550');
  band(92, 4, color);
  g.globalAlpha = 0.18;
  g.fillStyle = color;
  for (let y = 130; y < H - 130; y += 48) {
    for (let x = 130 + ((y / 48) % 2) * 24; x < W - 130; x += 48) {
      g.beginPath();
      g.moveTo(x, y - 12);
      g.lineTo(x + 12, y);
      g.lineTo(x, y + 12);
      g.lineTo(x - 12, y);
      g.fill();
    }
  }
  g.globalAlpha = 0.06;
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
    g.fillRect(rnd() * W, rnd() * H, 2, 2);
  }
  return c;
}

/** Abstraktní obraz v duchu moderního umění z Frasierova bytu. */
export function abstractPainting(seed: number, aspect: number, style: string): HTMLCanvasElement {
  const W = 512;
  const H = Math.round(512 / aspect);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rnd = seeded(seed);
  const palettes = [
    ['#f1ece1', '#c0392b', '#1f3a68', '#e3b23c', '#222222'],
    ['#efe6d2', '#8c2f39', '#2e5e4e', '#d9a441', '#3a3a3a'],
    ['#e9e4da', '#2b4c7e', '#c4512f', '#f2c14e', '#111111'],
  ];
  const pal = palettes[Math.floor(rnd() * palettes.length)];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, W, H);
  if (style === 'vase') {
    // zátiší s červenomodrou vázou
    g.fillStyle = '#d8cdb8';
    g.fillRect(0, H * 0.7, W, H * 0.3);
    g.fillStyle = '#b8322a';
    g.beginPath();
    g.ellipse(W / 2, H * 0.55, W * 0.18, H * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#23407a';
    g.fillRect(W / 2 - W * 0.07, H * 0.22, W * 0.14, H * 0.18);
    g.beginPath();
    g.ellipse(W / 2, H * 0.62, W * 0.18, H * 0.06, 0, 0, Math.PI);
    g.fill();
    return c;
  }
  for (let i = 0; i < 9; i++) {
    g.globalAlpha = 0.75 + rnd() * 0.25;
    g.fillStyle = pal[1 + Math.floor(rnd() * (pal.length - 1))];
    const x = rnd() * W * 0.8;
    const y = rnd() * H * 0.8;
    const bw = W * (0.15 + rnd() * 0.45);
    const bh = H * (0.08 + rnd() * 0.4);
    g.beginPath();
    g.moveTo(x, y + rnd() * 10);
    g.lineTo(x + bw, y + rnd() * 14);
    g.lineTo(x + bw - rnd() * 16, y + bh);
    g.lineTo(x + rnd() * 12, y + bh - rnd() * 10);
    g.fill();
  }
  g.globalAlpha = 0.9;
  g.strokeStyle = pal[4];
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    g.lineWidth = 3 + rnd() * 10;
    g.beginPath();
    g.moveTo(rnd() * W, rnd() * H);
    g.bezierCurveTo(rnd() * W, rnd() * H, rnd() * W, rnd() * H, rnd() * W, rnd() * H);
    g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}
