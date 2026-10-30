import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  /** barva pracovní desky (kuchyňská linka, ostrůvek) */
  top?: string;
  /** obrys koberce v lokálních souřadnicích [x, z] v m (místo obdélníku size) */
  poly?: [number, number][];
  /** kuchyňská linka: horní prosklené skříňky (true), nebo otevřená police průchodu do jídelny ("open") */
  upper?: boolean | 'open';
  /** výška stropu nad spodkem předmětu (doplní furniture.ts) */
  ceil?: number;
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
        this.counter(g, w, d, h, def.color ?? '#9c4a32', def.top ?? '#2b2826', !!def.sink);
        if (def.upper === 'open') this.passShelf(g, w, def.ceil ?? 2.75);
        else if (def.upper) this.upperCabinets(g, w, d);
        break;
      case 'island':
        this.island(g, w, d, h, def.color ?? '#9c4a32', def.top ?? '#2b2826');
        break;
      case 'column':
        this.column(g, w, h);
        break;
      case 'roundcase':
        this.roundCase(g, w, d, h);
        break;
      case 'pantry':
        this.pantry(g, w, d, h);
        break;
      case 'cladding':
        g.add(box(w, h, d, this.grain('#c98f5a', 1)));
        break;
      case 'hood':
        this.hood(g, w, d, h);
        break;
      case 'radio':
        this.radio(g, w, d, h);
        break;
      case 'coffeetable':
        this.coffeeTable(g, w, d, h);
        break;
      case 'cabinet':
        g.add(box(w, h, d, this.paint(def.color ?? '#c58a4a', 0.55)));
        g.add(box(w + 0.02, 0.03, d + 0.02, this.paint(def.color ?? '#c58a4a', 0.4), 0, h, 0));
        break;
      case 'wardrobe':
        this.wardrobe(g, w, d, h, def.color ?? '#d6b46a');
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
        if (def.poly) this.carpet(g, def.poly, def.color ?? '#cbc5b8');
        else this.rug(g, w, d, def.color ?? '#8e3b2e', def.seed ?? 1);
        break;
      default:
        return null;
    }
    mergeByMaterial(g);
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
  /** Světlé dřevo se svislou kresbou (procedurální textura); repeat = opakování textury přes UV. */
  private grain(color: string, repeat = 1): THREE.Material {
    return this.mat(`grain:${color}:${repeat}`, () => {
      const tex = new THREE.CanvasTexture(woodGrain(color));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat, 1);
      tex.anisotropy = this.aniso;
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    });
  }
  private cabGlass() {
    return this.mat('cabglass', () =>
      new THREE.MeshPhysicalMaterial({ color: 0xe6f2f2, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    );
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

  private counter(g: THREE.Group, w: number, d: number, h: number, color: string, topColor: string, sink: boolean) {
    const body = this.paint(color, 0.5);
    const top = this.paint(topColor, 0.25);
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

  private island(g: THREE.Group, w: number, d: number, h: number, color: string, topColor: string) {
    this.counter(g, w - 0.25, d - 0.25, h, color, topColor, false);
    g.add(box(w, 0.04, d, this.paint(topColor, 0.25), 0, h - 0.04, 0));
    // varná deska (v půdorysu 4 plotýnky)
    g.add(box(0.6, 0.008, 0.52, this.paint('#0a0a0a', 0.1), 0, h, 0));
    const ring = this.paint('#3a3a3a', 0.4);
    for (const [x, z, r] of [[-0.15, -0.13, 0.09], [0.15, -0.13, 0.07], [-0.15, 0.13, 0.07], [0.15, 0.13, 0.09]]) {
      const c = new THREE.Mesh(new THREE.RingGeometry(r - 0.012, r, 32).rotateX(-Math.PI / 2), ring);
      c.position.set(x, h + 0.009, z);
      g.add(c);
    }
  }

  // --- stolky -----------------------------------------------------------------

  /** Frasierův konferenční stolek: deska z ptačího javoru s černými intarziemi, čtyři žebrované černé koule, spodní deska. */
  private coffeeTable(g: THREE.Group, w: number, d: number, h: number) {
    const maple = this.paint('#d8b886', 0.45);
    const inlay = this.paint('#111111', 0.35);
    const topH = h * 0.32;
    const baseH = 0.05;
    const disc = 0.012;
    const ballH = h - topH - baseH - 2 * disc;
    g.add(box(w * 0.97, baseH, d * 0.94, maple));
    g.add(box(w, topH, d, maple, 0, h - topH, 0));
    const ball = ribbedBall(ballH * 0.46, ballH / 2);
    const inset = ballH * 0.55;
    for (const [x, z] of corners(w - 2 * inset, d - 2 * inset)) {
      for (const y of [baseH, h - topH - disc]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(ballH * 0.3, ballH * 0.3, disc, 24), maple);
        c.position.set(x, y + disc / 2, z);
        g.add(c);
      }
      const b = new THREE.Mesh(ball, this.lacquer());
      b.position.set(x, baseH + disc + ballH / 2, z);
      g.add(b);
    }
    // intarzie na čele a zadní straně: krajní díly vodorovně od rohu a dolů, prostřední shora dolů, přes a nahoru
    const lw = 0.01;
    const y0 = h - topH;
    const yMid = y0 + topH * 0.38;
    const xo = w * 0.24;
    const xi = xo - 0.035;
    const line = (x1: number, y1: number, x2: number, y2: number, z: number) =>
      g.add(box(Math.abs(x2 - x1) + lw, Math.abs(y2 - y1) + lw, 0.004, inlay, (x1 + x2) / 2, Math.min(y1, y2) - lw / 2, z));
    for (const z of [d / 2 + 0.002, -d / 2 - 0.002]) {
      for (const m of [-1, 1]) {
        line(m * w / 2, yMid, m * xo, yMid, z);
        line(m * xo, yMid, m * xo, y0 + lw / 2, z);
        line(m * xi, h - lw / 2, m * xi, yMid + 0.02, z);
      }
      line(-xi, yMid + 0.02, xi, yMid + 0.02, z);
    }
    for (const m of [-1, 1]) g.add(box(lw, 0.004, d, inlay, m * xi, h, 0)); // spáry na desce
  }

  /** Stolní rádio v ořechové skříňce: látkový reproduktor, stupnice (v noci po zapnutí svítí) a dva knoflíky. */
  private radio(g: THREE.Group, w: number, d: number, h: number) {
    g.add(rbox(w, h, d, this.paint('#4a2e1c', 0.4), 0, 0, 0, 0.015));
    g.add(box(w * 0.42, h * 0.7, 0.006, this.fabric('Fabric061', '#3a332b', 6), -w * 0.24, h * 0.15, d / 2));
    const dial = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, h * 0.22, 0.006),
      new THREE.MeshStandardMaterial({ color: 0xe8dcb8, roughness: 0.3, emissive: 0xffb860, emissiveIntensity: 0 }),
    );
    dial.name = 'dial';
    dial.position.set(w * 0.22, h * 0.62, d / 2);
    g.add(dial);
    for (const x of [w * 0.12, w * 0.32]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 20).rotateX(Math.PI / 2), this.brass());
      k.position.set(x, h * 0.25, d / 2 + 0.007);
      g.add(k);
    }
  }

  // --- sloup s knihovnou, kuchyňské skříňky, digestoř -------------------------------

  /** Masivní dřevěný sloup od podlahy ke stropu s profilovanou patkou a hlavicí (roh vyvýšené části u balkonu). */
  private column(g: THREE.Group, w: number, h: number) {
    const wood = this.grain('#c68c52', 3);
    const r = (w / 2) * 0.88;
    const cyl = (rt: number, rb: number, height: number, y: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, height, 48), wood);
      m.position.y = y + height / 2;
      g.add(m);
    };
    cyl(r * 1.45, r * 1.45, 0.1, 0); // plinta
    cyl(r * 1.3, r * 1.38, 0.07, 0.1);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r * 1.16, 0.045, 12, 48).rotateX(Math.PI / 2), wood);
    torus.position.y = 0.21;
    g.add(torus);
    cyl(r * 1.08, r * 1.12, 0.05, 0.25);
    cyl(r, r, h - 0.42, 0.3); // dřík
    cyl(r * 1.12, r * 1.02, 0.06, h - 0.12); // hlavice
    cyl(r * 1.25, r * 1.25, 0.06, h - 0.06);
  }

  /**
   * Půlkruhová knihovna u paty sloupu (v rohu schodu): rovná záda na -Z, oblouk do obýváku (+Z),
   * dvě police, svislé přepážky a knihy (jeden InstancedMesh s barvou na knihu).
   */
  private roundCase(g: THREE.Group, w: number, d: number, h: number) {
    const R = w / 2;
    const z0 = -d / 2;
    const maple = this.grain('#d8b886', 2);
    const t = 0.025;
    const base = 0.06;
    const halfDisc = (r: number, y: number, thick: number, mat: THREE.Material) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI;
        pts.push(new THREE.Vector2(r * Math.cos(a), -(z0 + r * Math.sin(a))));
      }
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: thick, bevelEnabled: false, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      g.add(m);
    };
    halfDisc(R - 0.03, 0, base, this.paint('#8a6a45', 0.6)); // sokl
    halfDisc(R, base, t, maple);
    const mid = base + (h - base) / 2;
    halfDisc(R, mid, t, maple);
    halfDisc(R + 0.01, h - t, t, maple);
    const depth = 0.22;
    halfDisc(R - depth, base, h - base - t, maple); // plné jádro za knihami
    g.add(box(w, h, 0.02, maple, 0, 0, z0 + 0.01)); // záda
    // svislé přepážky (radiálně), krajní uzavírají půlkruh u zad
    for (const a of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI]) {
      const p = box(depth, h - base - t, t, maple);
      p.position.set((R - depth / 2) * Math.cos(a), base, z0 + (R - depth / 2) * Math.sin(a));
      p.rotation.y = -a;
      g.add(p);
    }
    // knihy po obvodu v každé přihrádce
    const rnd = seeded(7);
    const colors = ['#7a2e24', '#2e3f5c', '#1f4a3a', '#8c6a2f', '#d9cfb8', '#5b3a29', '#283028', '#a8452f', '#3c3550'];
    const books: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const rb = R - 0.12;
    for (const [y0, y1] of [[base + t, mid], [mid + t, h - t]]) {
      for (let k = 0; k < 4; k++) {
        let a = (k * Math.PI) / 4 + 0.04;
        const end = ((k + 1) * Math.PI) / 4 - 0.04;
        while (a < end) {
          const thick = 0.022 + rnd() * 0.022;
          const da = thick / rb;
          if (a + da > end) break;
          if (rnd() < 0.08) {
            a += da * 2; // mezera
            continue;
          }
          const bh = Math.min(y1 - y0 - 0.02, 0.17 + rnd() * 0.12);
          const am = a + da / 2;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(rb * Math.cos(am), y0 + bh / 2, z0 + rb * Math.sin(am)),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - am),
            new THREE.Vector3(thick - 0.002, bh, 0.17 + rnd() * 0.03),
          );
          books.push({ m, c: new THREE.Color(colors[Math.floor(rnd() * colors.length)]) });
          a += da;
        }
      }
    }
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.paint('#ffffff', 0.8), books.length);
    books.forEach((b, i) => {
      inst.setMatrixAt(i, b.m);
      inst.setColorAt(i, b.c);
    });
    g.add(inst);
  }

  /** Horní bílé skříňky s prosklenými dvířky (mřížka tabulek) a sklenicemi a hrnky uvnitř – nad kuchyňskou linkou. */
  private upperCabinets(g: THREE.Group, w: number, d: number) {
    const white = this.paint('#f2efe8', 0.45);
    const inner = this.paint('#e4dfd4', 0.7);
    const u = 0.34;
    const y0 = 1.42;
    const y1 = 2.2;
    const H = y1 - y0;
    const zb = -d / 2; // zadní hrana linky = stěna
    const zc = zb + u / 2;
    g.add(box(w, 0.02, u, white, 0, y0, zc));
    g.add(box(w, 0.02, u, white, 0, y1 - 0.02, zc));
    g.add(box(w, H * 0.02, u - 0.02, white, 0, y0 + H * 0.5, zc - 0.01)); // police
    g.add(box(w, H, 0.012, inner, 0, y0, zb + 0.006)); // záda
    for (const s of [-1, 1]) g.add(box(0.02, H, u, white, (s * (w - 0.02)) / 2, y0, zc));
    const doors = Math.max(1, Math.round(w / 0.5));
    const dw = w / doors;
    const zf = zb + u - 0.01;
    const bar = 0.045;
    const mun = 0.014;
    const tumblers: THREE.Matrix4[] = [];
    const mugs: THREE.Matrix4[] = [];
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + dw * (i + 0.5);
      // rám dvířek
      g.add(box(dw - 0.006, bar, 0.02, white, x, y0 + 0.02, zf));
      g.add(box(dw - 0.006, bar, 0.02, white, x, y1 - 0.02 - bar, zf));
      for (const s of [-1, 1]) g.add(box(bar, H - 0.04, 0.02, white, x + (s * (dw - 0.006 - bar)) / 2, y0 + 0.02, zf));
      // sklo a příčky (2 sloupce × 3 řady tabulek)
      g.add(box(dw - 2 * bar, H - 0.04 - 2 * bar, 0.004, this.cabGlass(), x, y0 + 0.02 + bar, zf));
      g.add(box(mun, H - 0.04 - 2 * bar, 0.012, white, x, y0 + 0.02 + bar, zf + 0.004));
      for (const f of [1 / 3, 2 / 3]) g.add(box(dw - 2 * bar, mun, 0.012, white, x, y0 + 0.02 + bar + (H - 0.04 - 2 * bar) * f, zf + 0.004));
      g.add(box(0.012, 0.06, 0.02, this.chrome(), x + (i % 2 ? -1 : 1) * (dw / 2 - 0.07), y0 + 0.06, zf + 0.02));
      // obsah: na každé polici sklenice a hrnky
      for (const sy of [y0 + 0.02, y0 + H * 0.52]) {
        for (let k = 0; k < 3; k++) {
          const px = x - dw * 0.3 + k * dw * 0.3;
          const m = new THREE.Matrix4().makeTranslation(px, sy + 0.06, zc - 0.03);
          (k === 1 ? mugs : tumblers).push(m);
        }
      }
    }
    const addInst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[]) => {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((m, i) => inst.setMatrixAt(i, m));
      g.add(inst);
    };
    addInst(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 16, 1, true), this.cabGlass(), tumblers);
    addInst(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16), this.ceramic(), mugs);
  }

  /**
   * Průchod z kuchyně do jídelny: nad linkou (poloostrovem) visí bílá otevřená police – vlevo dlouhé police,
   * vpravo mřížka přihrádek, bez zad i dvířek (je přes ni vidět ke klavíru); nad ní překlad až ke stropu.
   */
  private passShelf(g: THREE.Group, w: number, ceil: number) {
    const white = this.paint('#f2efe8', 0.5);
    const u = 0.32;
    const y0 = 1.45;
    const y1 = 2.25;
    const H = y1 - y0;
    const t = 0.03;
    g.add(box(w, t, u, white, 0, y0, 0));
    g.add(box(w, t, u, white, 0, y1 - t, 0));
    for (const s of [-1, 1]) g.add(box(t, H, u, white, (s * (w - t)) / 2, y0, 0));
    // levá část: dvě dlouhé police; pravá třetina: mřížka 2 × 3 přihrádky
    const split = w / 2 - w * 0.36;
    g.add(box(t, H, u, white, split, y0, 0));
    for (const f of [1 / 3, 2 / 3]) {
      g.add(box(split + w / 2, t, u, white, (-w / 2 + split) / 2, y0 + H * f, 0));
      g.add(box(w / 2 - split, t, u, white, (split + w / 2) / 2, y0 + H * f, 0));
    }
    g.add(box(t, H, u, white, (split + w / 2) / 2, y0, 0));
    // překlad nad průchodem (omítka) až ke stropu
    if (ceil > y1 + 0.05) g.add(box(w, ceil - y1, u, this.paint('#eee6d8', 0.9), 0, y1, 0));
    // sklenice na polici
    const glasses: THREE.Matrix4[] = [];
    for (let i = 0; i < 6; i++) glasses.push(new THREE.Matrix4().makeTranslation(-w / 2 + 0.25 + i * 0.13, y0 + t + 0.07, 0));
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.025, 0.14, 16, 1, true), this.cabGlass(), glasses.length);
    glasses.forEach((m, i) => inst.setMatrixAt(i, m));
    g.add(inst);
  }

  /** Vysoká bílá spíž od podlahy ke stropu: dvoje dvířka s mřížkou vystouplých kazet a mosaznými úchytkami. */
  private pantry(g: THREE.Group, w: number, d: number, h: number) {
    const white = this.paint('#ece8de', 0.55);
    g.add(box(w, h, d - 0.02, white, 0, 0, -0.01));
    const cols = 2;
    const rows = 8;
    const dw = w / 2;
    const zf = d / 2;
    for (let k = 0; k < 2; k++) {
      const x0 = -w / 2 + k * dw;
      g.add(box(0.006, h - 0.06, 0.01, this.paint('#cfc9bc', 0.6), x0 + dw, 0.03, zf)); // spára mezi dvířky
      const pw = (dw - 0.08) / cols;
      const ph = (h - 0.1) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          g.add(box(pw - 0.045, ph - 0.045, 0.014, white, x0 + 0.04 + pw * (c + 0.5), 0.05 + ph * r + 0.0225, zf + 0.007));
        }
      }
    }
    for (const s of [-1, 1]) g.add(box(0.012, 0.09, 0.02, this.brass(), s * 0.04, h * 0.48, zf + 0.02));
  }

  /** Digestoř nad ostrůvkem: černý kryt dole, dřevěný pás a komín ke stropu, světlo zespodu. */
  private hood(g: THREE.Group, w: number, d: number, h: number) {
    const wood = this.grain('#d8b886', 2);
    g.add(box(w, 0.2, d, this.paint('#141414', 0.35, 0.3)));
    g.add(box(w + 0.06, 0.14, d + 0.06, wood, 0, 0.2, 0));
    g.add(box(w * 0.82, h - 0.34, d * 0.82, wood, 0, 0.34, 0));
    const lamp = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.5, d * 0.25).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xfff1dc, emissiveIntensity: 0.6 }),
    );
    lamp.position.y = -0.001;
    g.add(lamp);
  }

  // --- úložné prostory ---------------------------------------------------------

  /** Vestavěná skříň až ke stropu (Daphnin pokoj): javorový rám, dvoje dveře s mřížkovou výplní, nadpraží. */
  private wardrobe(g: THREE.Group, w: number, d: number, h: number, color: string) {
    const maple = this.paint(color, 0.5);
    const lattice = this.mat(`lattice:${color}`, () => {
      const tex = new THREE.CanvasTexture(latticePattern(color));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.aniso;
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    });
    const knob = this.brass();
    const f = 0.06; // šířka rámu
    const doorH = 2.1;
    const z = d / 2;
    g.add(box(w, h, d - 0.04, this.paint('#3a2c22', 0.9), 0, 0, -0.02)); // korpus (tmavé nitro)
    g.add(box(f, h, 0.04, maple, -w / 2 + f / 2, 0, z - 0.02));
    g.add(box(f, h, 0.04, maple, w / 2 - f / 2, 0, z - 0.02));
    g.add(box(w, h - doorH, 0.04, maple, 0, doorH, z - 0.02));
    g.add(box(w, 0.08, 0.04, maple, 0, 0, z - 0.02)); // sokl
    const dw = (w - 2 * f) / 2;
    const rail = 0.09;
    for (const s of [-1, 1]) {
      const x = (s * dw) / 2;
      const y0 = 0.08;
      const dh = doorH - y0;
      // rám dveří, spodní plná výplň a mřížka v horních dvou třetinách
      g.add(box(dw - 0.006, dh, 0.025, maple, x, y0, z - 0.03));
      const lh = dh * 0.62;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(dw - 2 * rail, lh), lattice);
      panel.position.set(x, doorH - rail - lh / 2, z - 0.004);
      g.add(panel);
      g.add(box(dw - 2 * rail, 0.012, 0.008, maple, x, doorH - rail - lh - 0.006, z - 0.004));
      g.add(box(dw - 2 * rail, dh - lh - 3 * rail, 0.01, this.paint(color, 0.42), x, y0 + rail, z - 0.008));
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), knob);
      k.position.set(x - s * (dw / 2 - 0.07), 1.0, z + 0.015);
      g.add(k);
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
      this.mat('shade', () => new THREE.MeshStandardMaterial({ name: 'lampshade', color: 0xf1e6cf, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2a2010 })),
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

  /** Jednobarevný koberec podle obrysu (obývák: světle šedobéžový koberec skoro přes celou místnost). */
  private carpet(g: THREE.Group, poly: [number, number][], color: string) {
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    // UV ShapeGeometry jsou v metrech => textura ~0,67 m jako u obdélníkového koberce
    const nor = loadPbr(this.loader, 'Carpet016', new THREE.Vector2(1.5, 1.5), this.aniso, ['normalMap']);
    const m = new THREE.Mesh(
      new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color, ...nor, roughness: 1 }),
    );
    m.position.y = 0.006;
    m.receiveShadow = true;
    g.add(m);
  }
}

// --- pomocné funkce -----------------------------------------------------------

/**
 * Sloučí meshe skupiny se stejným materiálem do jednoho (procedurální nábytek má desítky krabic – méně draw calls).
 * Pojmenované meshe (např. stupnice rádia), InstancedMesh a vícemateriálové meshe zůstanou samostatně.
 */
function mergeByMaterial(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || m.name || Array.isArray(m.material)) return;
    const list = byMat.get(m.material) ?? [];
    list.push(m);
    byMat.set(m.material, list);
  });
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      let geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (geo.index) geo = geo.toNonIndexed();
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      return geo;
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    for (const m of meshes) m.parent?.remove(m);
    g.add(new THREE.Mesh(merged, mat));
  }
}

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

/** Svislá kresba světlého dřeva: podélná vlákna různého odstínu s jemným vlněním. */
function woodGrain(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  const rnd = seeded(11);
  for (let i = 0; i < 140; i++) {
    const x0 = rnd() * c.width;
    const dark = rnd() < 0.6;
    g.strokeStyle = dark ? `rgba(70, 40, 15, ${0.05 + rnd() * 0.12})` : `rgba(255, 240, 210, ${0.05 + rnd() * 0.1})`;
    g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    const amp = 1 + rnd() * 4;
    const f = 0.004 + rnd() * 0.01;
    for (let y = 0; y <= c.height; y += 16) {
      const x = x0 + Math.sin(y * f + i) * amp;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

/** Koule (elipsoid) se 16 svislými žebry jako nohy konferenčního stolku. */
function ribbedBall(r: number, ry: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 64, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const k = 0.94 + 0.06 * Math.abs(Math.sin(8 * Math.atan2(z, x)));
    pos.setXYZ(i, x * k, (pos.getY(i) * ry) / r, z * k);
  }
  geo.computeVertexNormals();
  return geo;
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

/** Dřevěná mřížka ve dveřích skříně: čtvercové otvory s tmavým nitrem za nimi. */
function latticePattern(color: string): HTMLCanvasElement {
  const cols = 9;
  const rows = 22;
  const cell = 32;
  const c = document.createElement('canvas');
  c.width = cols * cell;
  c.height = rows * cell;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = '#2a1d14';
      g.fillRect(x * cell + 8, y * cell + 8, cell - 16, cell - 16);
      g.fillStyle = 'rgba(0,0,0,0.25)'; // stín horní hrany otvoru
      g.fillRect(x * cell + 8, y * cell + 8, cell - 16, 3);
    }
  }
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
