import * as THREE from 'three';

/**
 * Výhled z bytu: fotografie Seattlu z Kerry Parku na výseči válce za balkonem
 * + procedurální pozadí dokola, jehož obloha je navzorkovaná z okrajů fotky,
 * aby na sebe obě vrstvy plynule navazovaly. Balkon v půdorysu míří nahoru (-Z).
 *
 * Fotografie (Wikimedia Commons):
 *  - den: „Seattle skyline panorama from Kerry Park, June 2022“, SounderBruce, CC BY-SA 4.0
 *  - noc: „Seattle skyline from Kerry Park, evening of 2014-10-19 no. 09“, ragesoss, CC BY-SA 2.0
 */

interface PhotoDef {
  url: string;
  /** horizontální záběr fotky ve stupních */
  arc: number;
  /** střed fotky ve stupních od směru -Z (kladně = doprava při pohledu z balkonu) */
  center: number;
  /** výška horizontu ve fotce (0 = horní okraj, 1 = spodní) */
  horizon: number;
  /** o kolik (podíl výšky) fotku dole prodloužit zrcadlením */
  extend: number;
}

// Denní panorama (6 : 1) pokrývá 140° se Space Needle mírně vlevo od balkonu.
// Noční fotka je užší záběr se Space Needle u pravého okraje; den a noc nejsou vidět
// současně, takže je zvětšená tak, aby sama vyplnila celý výhled z balkonu.
const PHOTOS: Record<'day' | 'night', PhotoDef> = {
  day: { url: '/skybox_day.webp', arc: 140, center: 0, horizon: 0.6, extend: 0.6 },
  night: { url: '/skybox_night.webp', arc: 110, center: -15, horizon: 0.572, extend: 0.08 },
};

const PHOTO_RADIUS = 85; // m
const HORIZON_Y = -4; // horizont mírně pod úrovní očí (19. patro)
const FEATHER_X = 0.07; // prolnutí levého/pravého okraje fotky
const FEATHER_TOP = 0.04;

const BG_RADIUS = 95;
const BG_HEIGHT = 170; // y od -85 do 85
const BG_W = 4096;
const BG_H = 1024;
const GROUND_Y = -58;

type RGB = [number, number, number];
type Mode = 'day' | 'night';

interface Built {
  bg: THREE.Texture;
  photo: THREE.Mesh;
  ground: THREE.Color;
}

export class Skyline {
  readonly group = new THREE.Group();
  private bgMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false, fog: false });
  private groundMat = new THREE.MeshBasicMaterial({ color: 0x2d3528, toneMapped: false, fog: false });
  private built: Partial<Record<Mode, Built>> = {};
  private mode: Mode = 'day';

  /** maxPhotoWidth = strop šířky fotky výhledu (podle nastavení kvality) */
  constructor(
    manager: THREE.LoadingManager,
    private renderer: THREE.WebGLRenderer,
    private maxPhotoWidth = 8192,
  ) {
    const bg = new THREE.Mesh(new THREE.CylinderGeometry(BG_RADIUS, BG_RADIUS, BG_HEIGHT, 64, 1, true), this.bgMat);
    // zrcadlit, aby panorama nebylo zevnitř převrácené
    bg.scale.x = -1;
    this.group.add(bg);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(BG_RADIUS, 64).rotateX(-Math.PI / 2), this.groundMat);
    ground.position.y = GROUND_Y;
    this.group.add(ground);

    // denní fotka se čeká v úvodním načítání, noční se stáhne až při prvním přepnutí na noc
    this.load('day', manager);
  }

  private loading = new Set<Mode>();

  private load(mode: Mode, manager?: THREE.LoadingManager) {
    if (this.loading.has(mode)) return;
    this.loading.add(mode);
    new THREE.ImageLoader(manager).load(PHOTOS[mode].url, (img) => {
      this.built[mode] = this.build(img, PHOTOS[mode]);
      this.apply();
    });
  }

  setNight(night: boolean) {
    this.mode = night ? 'night' : 'day';
    this.load(this.mode);
    this.apply();
  }

  private apply() {
    for (const [mode, b] of Object.entries(this.built) as [Mode, Built][]) b.photo.visible = mode === this.mode;
    const cur = this.built[this.mode];
    if (!cur) return;
    this.bgMat.map = cur.bg;
    this.bgMat.needsUpdate = true;
    this.groundMat.color.copy(cur.ground);
  }

  private build(img: HTMLImageElement, def: PhotoDef): Built {
    // větší fotky zmenšit na limit GPU a nastavení kvality
    const maxW = Math.min(this.maxPhotoWidth, this.renderer.capabilities.maxTextureSize);
    const k = Math.min(1, maxW / img.naturalWidth);
    const W = Math.round(img.naturalWidth * k);
    const H = Math.round(img.naturalHeight * k);
    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const sg = src.getContext('2d', { willReadFrequently: true })!;
    sg.drawImage(img, 0, 0, W, H);
    const pixels = sg.getImageData(0, 0, W, H);

    const arc = THREE.MathUtils.degToRad(def.arc);
    const ext = Math.round(H * def.extend);
    const H2 = H + ext;
    const photoH = PHOTO_RADIUS * arc * (H2 / W); // zachovat poměr stran
    const photoTop = HORIZON_Y + ((def.horizon * H) / H2) * photoH;

    // fotka na výseči válce; theta = π je směr -Z, po zrcadlení osy x roste theta doprava
    const center = Math.PI + THREE.MathUtils.degToRad(def.center);
    const geo = new THREE.CylinderGeometry(PHOTO_RADIUS, PHOTO_RADIUS, photoH, 64, 1, true, center - arc / 2, arc);
    const ground = new THREE.Color();
    const tex = new THREE.CanvasTexture(feather(extendDown(pixels, ext, ground)));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const photo = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, depthWrite: false, toneMapped: false, fog: false }),
    );
    photo.scale.x = -1;
    photo.position.y = photoTop - photoH / 2;
    photo.renderOrder = 1;
    photo.visible = false;
    this.group.add(photo);

    const map: SkyMap = {
      sky: sampleSky(pixels),
      photoTop,
      photoRowAt: (y: number) => ((photoTop - y) / photoH) * H2,
    };
    const bgTex = new THREE.CanvasTexture(drawBackground(map, toRGB(ground)));
    bgTex.colorSpace = THREE.SRGBColorSpace;
    return { bg: bgTex, photo, ground };
  }
}

interface SkyMap {
  /** barva oblohy pro řádek fotky (platí pro řádky nad koncem oblohy na okrajích) */
  sky: { colors: RGB[]; end: number };
  photoTop: number;
  photoRowAt(y: number): number;
}

const toRGB = (c: THREE.Color): RGB => {
  const s = c.clone().convertLinearToSRGB();
  return [s.r * 255, s.g * 255, s.b * 255];
};

/** Průměrná barva levého a pravého okraje fotky po řádcích, dokud je to obloha (modrá převažuje). */
function sampleSky(img: ImageData): SkyMap['sky'] {
  const { width: W, height: H, data } = img;
  const band = Math.max(4, Math.round(W * 0.03));
  const colors: RGB[] = [];
  let end = H;
  for (let y = 0; y < H; y++) {
    const acc = [0, 0, 0];
    let n = 0;
    for (const x0 of [0, W - band]) {
      for (let x = x0; x < x0 + band; x += 2) {
        const i = (y * W + x) * 4;
        acc[0] += data[i];
        acc[1] += data[i + 1];
        acc[2] += data[i + 2];
        n++;
      }
    }
    const c: RGB = [acc[0] / n, acc[1] / n, acc[2] / n];
    if (end === H && (c[2] - c[0] < 12 || c[2] < 30)) end = Math.max(1, y);
    colors.push(c);
  }
  return { colors, end };
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Obloha podle světové výšky: z fotky, nad ní ztmavení k zenitu, pod ní poslední barva oblohy. */
function skyAt(y: number, m: SkyMap): RGB {
  const { colors, end } = m.sky;
  const top = colors[0];
  if (y >= m.photoTop) {
    const t = THREE.MathUtils.clamp((y - m.photoTop) / 40, 0, 1);
    return mix(top, [top[0] * 0.55, top[1] * 0.75, top[2] * 0.95], t);
  }
  const row = Math.max(0, Math.min(end - 1, Math.floor(m.photoRowAt(y))));
  return colors[row];
}

/** Procedurální pozadí dokola: obloha navázaná na fotku, hory a vzdálené město v oparu. */
function drawBackground(m: SkyMap, ground: RGB): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BG_W;
  c.height = BG_H;
  const g = c.getContext('2d')!;
  const yAt = (row: number) => BG_HEIGHT / 2 - (row / BG_H) * BG_HEIGHT;
  const rowAt = (y: number) => ((BG_HEIGHT / 2 - y) / BG_HEIGHT) * BG_H;

  for (let r = 0; r < BG_H; r++) {
    g.fillStyle = css(skyAt(yAt(r), m));
    g.fillRect(0, r, BG_W, 1);
  }

  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hRow = rowAt(HORIZON_Y);
  const haze = skyAt(HORIZON_Y + 1, m);
  const dark = (haze[0] + haze[1] + haze[2]) / 3 < 90; // večerní fotka

  // vzdálené hory v oparu (večer splývají s oblohou, nekreslí se)
  if (!dark) {
    g.fillStyle = css(mix(haze, [90, 105, 120], 0.35));
    g.beginPath();
    g.moveTo(0, hRow);
    for (let x = 0; x <= BG_W; x += 32) {
      g.lineTo(x, hRow - 10 - Math.abs(Math.sin(x * 0.0031) * 26 + Math.sin(x * 0.011) * 10));
    }
    g.lineTo(BG_W, hRow);
    g.fill();
  }

  // pod horizontem stejný tón jako spodek fotky (plynulý přechod na jejích okrajích)
  const low = g.createLinearGradient(0, hRow, 0, BG_H);
  low.addColorStop(0, css(mix(haze, ground, 0.6)));
  low.addColorStop(0.25, css(ground));
  low.addColorStop(1, css(mix(ground, [0, 0, 0], 0.3)));
  g.fillStyle = low;
  g.fillRect(0, hRow, BG_W, BG_H - hRow);

  // nízké vzdálené město; večer jen tmavé siluety s drobnými světly
  for (let i = 0; i < (dark ? 500 : 700); i++) {
    const x = rnd() * BG_W;
    const bw = 6 + rnd() * 22;
    const bh = 4 + rnd() * 22 + (rnd() < 0.08 ? rnd() * 40 : 0);
    const top = hRow - bh + 8;
    const shade = dark ? 4 + rnd() * 8 : 95 + rnd() * 60;
    g.fillStyle = css(dark ? mix([shade, shade, shade + 6], ground, 0.5) : mix([shade, shade + 6, shade + 14], haze, 0.35));
    g.fillRect(x, top, bw, hRow + 20 - top);
    if (dark) {
      for (let wy = top + 3; wy < hRow + 18; wy += 5) {
        for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
          if (rnd() < 0.12) {
            g.fillStyle = rnd() < 0.8 ? 'rgba(255,212,140,0.75)' : 'rgba(190,220,255,0.75)';
            g.fillRect(wx, wy, 1.5, 1.5);
          }
        }
      }
    }
  }
  return c;
}

/** Prodloužení fotky dolů: zrcadlený a rozmazaný spodní pruh, který přejde do průměrné barvy. */
function extendDown(img: ImageData, ext: number, groundOut: THREE.Color): HTMLCanvasElement {
  const { width: W, height: H } = img;
  const src = document.createElement('canvas');
  src.width = W;
  src.height = H;
  src.getContext('2d')!.putImageData(img, 0, 0);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H + ext;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);

  // průměrná barva spodního řádku fotky
  const acc = [0, 0, 0];
  for (let x = 0; x < W; x++) {
    const i = ((H - 1) * W + x) * 4;
    acc[0] += img.data[i];
    acc[1] += img.data[i + 1];
    acc[2] += img.data[i + 2];
  }
  const avg: RGB = [(acc[0] / W) * 0.8, (acc[1] / W) * 0.8, (acc[2] / W) * 0.8];
  groundOut.setRGB(avg[0] / 255, avg[1] / 255, avg[2] / 255, THREE.SRGBColorSpace);
  if (ext <= 0) return c;

  g.save();
  g.filter = 'blur(14px) brightness(0.75) saturate(0.85)';
  g.translate(0, 2 * H);
  g.scale(1, -1);
  g.drawImage(src, 0, H - ext, W, ext, 0, H - ext, W, ext);
  g.restore();

  const col = avg.map((v) => v | 0).join(',');
  const fade = g.createLinearGradient(0, H, 0, H + ext);
  fade.addColorStop(0, `rgba(${col},0)`);
  fade.addColorStop(0.6, `rgba(${col},0.85)`);
  fade.addColorStop(1, `rgba(${col},1)`);
  g.fillStyle = fade;
  g.fillRect(0, H, W, ext);
  return c;
}

/** Průhledné okraje fotky, aby se prolnula s procedurálním pozadím. */
function feather(c: HTMLCanvasElement): HTMLCanvasElement {
  const W = c.width;
  const H = c.height;
  const g = c.getContext('2d')!;
  g.globalCompositeOperation = 'destination-out';
  const fx = W * FEATHER_X;
  const l = g.createLinearGradient(0, 0, fx, 0);
  l.addColorStop(0, 'rgba(0,0,0,1)');
  l.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = l;
  g.fillRect(0, 0, fx, H);
  const r = g.createLinearGradient(W - fx, 0, W, 0);
  r.addColorStop(0, 'rgba(0,0,0,0)');
  r.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = r;
  g.fillRect(W - fx, 0, fx, H);
  const fy = H * FEATHER_TOP;
  const t = g.createLinearGradient(0, 0, 0, fy);
  t.addColorStop(0, 'rgba(0,0,0,1)');
  t.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = t;
  g.fillRect(0, 0, W, fy);
  g.globalCompositeOperation = 'source-over';
  return c;
}
