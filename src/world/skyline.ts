import * as THREE from 'three';

/**
 * Výhled z bytu: fotografie panoramatu Seattlu (public/skybox.jpg, pohled z Kerry Parku)
 * na výseči válce za balkonem + procedurální pozadí dokola, jehož obloha je
 * navzorkovaná z okrajů fotky, aby na sebe obě vrstvy plynule navazovaly.
 * Balkon v půdorysu míří nahoru (-Z), tam je střed fotky.
 */

const PHOTO_URL = '/skybox.jpg';
const PHOTO_RADIUS = 85; // m
const PHOTO_ARC = THREE.MathUtils.degToRad(110); // horizontální záběr fotky
const PHOTO_HORIZON = 0.6; // výška horizontu ve fotce (0 = horní okraj)
const HORIZON_Y = -4; // horizont mírně pod úrovní očí (19. patro)
const FEATHER_X = 0.07; // prolnutí levého/pravého okraje fotky
const FEATHER_TOP = 0.04;
const EXTEND_DOWN = 0.6; // o kolik (podíl výšky) fotku dole prodloužit

// Orientační body ve fotce (podíl šířky/výšky) pro noční osvětlení
const NEEDLE_SAUCER = { x: 0.335, y: 0.212, w: 0.06 };
const NEEDLE_BEACON = { x: 0.335, y: 0.115 };

const BG_RADIUS = 95;
const BG_HEIGHT = 170; // y od -85 do 85
const BG_W = 4096;
const BG_H = 1024;
const GROUND_Y = -58;

type RGB = [number, number, number];

export class Skyline {
  readonly group = new THREE.Group();
  private bgMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false, fog: false });
  private photoMat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  private groundMat = new THREE.MeshBasicMaterial({ color: 0x4d5a52, toneMapped: false, fog: false });
  private textures: Record<'day' | 'night', { bg: THREE.Texture; photo: THREE.Texture }> | null = null;
  private night = false;
  /** barva země pod městem – převezme se ze spodku fotky */
  private ground = { day: new THREE.Color(0x4d5a52), night: new THREE.Color(0x07090e) };

  constructor(manager: THREE.LoadingManager, private maxAniso: number) {
    const bg = new THREE.Mesh(new THREE.CylinderGeometry(BG_RADIUS, BG_RADIUS, BG_HEIGHT, 64, 1, true), this.bgMat);
    // zrcadlit, aby panorama nebylo zevnitř převrácené
    bg.scale.x = -1;
    this.group.add(bg);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(BG_RADIUS, 64).rotateX(-Math.PI / 2), this.groundMat);
    ground.position.y = GROUND_Y;
    this.group.add(ground);

    new THREE.ImageLoader(manager).load(PHOTO_URL, (img) => this.build(img));
  }

  setNight(night: boolean) {
    this.night = night;
    this.groundMat.color.copy(night ? this.ground.night : this.ground.day);
    if (!this.textures) return;
    const t = this.textures[night ? 'night' : 'day'];
    this.bgMat.map = t.bg;
    this.photoMat.map = t.photo;
    this.bgMat.needsUpdate = this.photoMat.needsUpdate = true;
  }

  private build(img: HTMLImageElement) {
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    // fotka se dole prodlouží (zrcadlení + rozmazání), aby při pohledu z balkonu dolů nebyl vidět její konec
    const ext = Math.round(H * EXTEND_DOWN);
    const H2 = H + ext;
    const photoH = PHOTO_RADIUS * PHOTO_ARC * (H2 / W); // zachovat poměr stran
    const photoTop = HORIZON_Y + ((PHOTO_HORIZON * H) / H2) * photoH;

    // fotka na výseči válce se středem v -Z (theta = π)
    const geo = new THREE.CylinderGeometry(
      PHOTO_RADIUS,
      PHOTO_RADIUS,
      photoH,
      48,
      1,
      true,
      Math.PI - PHOTO_ARC / 2,
      PHOTO_ARC,
    );
    const photo = new THREE.Mesh(geo, this.photoMat);
    photo.scale.x = -1;
    photo.position.y = photoTop - photoH / 2;
    photo.renderOrder = 1;
    this.group.add(photo);

    const src = document.createElement('canvas');
    src.width = W;
    src.height = H;
    const sg = src.getContext('2d', { willReadFrequently: true })!;
    sg.drawImage(img, 0, 0);
    const pixels = sg.getImageData(0, 0, W, H);

    const sky = sampleSky(pixels);
    // převody: řádek fotky <-> světová výška
    const photoRowAt = (y: number) => ((photoTop - y) / photoH) * H2;
    const worldAtRow = (row: number) => photoTop - (row / H2) * photoH;
    const map: SkyMap = { sky, photoTop, photoRowAt, worldAtRow };

    const make = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.maxAniso;
      return t;
    };
    const nightPixels = nightify(pixels, map);
    const dayPhoto = feather(extendDown(pixels, ext, this.ground.day));
    const nightPhoto = feather(extendDown(nightPixels, ext, this.ground.night));
    const rgb = (c: THREE.Color): RGB => {
      const s = c.clone().convertLinearToSRGB();
      return [s.r * 255, s.g * 255, s.b * 255];
    };
    this.textures = {
      day: { bg: make(drawBackground(map, false, rgb(this.ground.day))), photo: make(dayPhoto) },
      night: { bg: make(drawBackground(map, true, rgb(this.ground.night))), photo: make(nightPhoto) },
    };
    this.setNight(this.night);
  }
}

interface SkyMap {
  /** barva oblohy pro řádek fotky (jen pro řádky nad koncem oblohy na okrajích) */
  sky: { colors: RGB[]; end: number };
  photoTop: number;
  photoRowAt(y: number): number;
  worldAtRow(row: number): number;
}

/** Průměrná barva levého a pravého okraje fotky po řádcích, dokud je to obloha. */
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
    // obloha = modrá převažuje a je dost světlá (opar u horizontu ještě projde)
    if (end === H && (c[2] < 150 || c[2] - c[0] < 18)) end = y;
    colors.push(c);
  }
  return { colors, end };
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Noční obloha podle světové výšky. */
function nightSky(y: number): RGB {
  const t = THREE.MathUtils.clamp((y - HORIZON_Y) / 45, 0, 1);
  return mix([42, 46, 72], [5, 8, 20], Math.pow(t, 0.6));
}

/** Denní obloha podle světové výšky: z fotky, nad ní ztmavení k zenitu, pod ní opar. */
function daySky(y: number, m: SkyMap): RGB {
  const { colors, end } = m.sky;
  const top = colors[0];
  if (y >= m.photoTop) {
    const t = THREE.MathUtils.clamp((y - m.photoTop) / 40, 0, 1);
    return mix(top, [top[0] * 0.55, top[1] * 0.75, top[2] * 0.95], t);
  }
  const row = Math.max(0, Math.min(end - 1, Math.floor(m.photoRowAt(y))));
  return colors[row];
}

/** Procedurální pozadí dokola: obloha navázaná na fotku, hory, vzdálené město, voda. */
function drawBackground(m: SkyMap, night: boolean, ground: RGB): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BG_W;
  c.height = BG_H;
  const g = c.getContext('2d')!;
  const yAt = (row: number) => BG_HEIGHT / 2 - (row / BG_H) * BG_HEIGHT;
  const rowAt = (y: number) => ((BG_HEIGHT / 2 - y) / BG_HEIGHT) * BG_H;

  for (let r = 0; r < BG_H; r++) {
    const y = yAt(r);
    g.fillStyle = css(night ? nightSky(y) : daySky(y, m));
    g.fillRect(0, r, BG_W, 1);
  }

  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hRow = rowAt(HORIZON_Y);
  const haze = night ? ([24, 28, 44] as RGB) : daySky(HORIZON_Y + 1, m);

  if (night) {
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 500; i++) g.fillRect(rnd() * BG_W, rnd() * hRow * 0.75, 1.5, 1.5);
  }

  // vzdálené hory (Olympic Mountains / Cascades) v oparu
  g.fillStyle = css(mix(haze, night ? [10, 12, 22] : [90, 105, 120], 0.35));
  g.beginPath();
  g.moveTo(0, hRow);
  for (let x = 0; x <= BG_W; x += 32) {
    g.lineTo(x, hRow - 10 - Math.abs(Math.sin(x * 0.0031) * 26 + Math.sin(x * 0.011) * 10));
  }
  g.lineTo(BG_W, hRow);
  g.fill();

  // pod horizontem město v oparu, dole stejný tón jako spodek fotky (plynulý přechod na jejích okrajích)
  const sea = g.createLinearGradient(0, hRow, 0, BG_H);
  sea.addColorStop(0, night ? '#10141f' : css(mix(haze, [70, 85, 95], 0.6)));
  sea.addColorStop(0.25, css(ground));
  sea.addColorStop(1, css(mix(ground, [0, 0, 0], 0.3)));
  g.fillStyle = sea;
  g.fillRect(0, hRow, BG_W, BG_H - hRow);

  // nízké vzdálené město na pobřeží
  for (let i = 0; i < 700; i++) {
    const x = rnd() * BG_W;
    const bw = 6 + rnd() * 22;
    const bh = 4 + rnd() * 22 + (rnd() < 0.08 ? rnd() * 40 : 0);
    const top = hRow - bh + 8;
    const shade = night ? 10 + rnd() * 12 : 95 + rnd() * 60;
    g.fillStyle = css(night ? [shade, shade, shade + 8] : mix([shade, shade + 6, shade + 14], haze, 0.35));
    g.fillRect(x, top, bw, hRow + 20 - top);
    if (night) {
      for (let wy = top + 3; wy < hRow + 18; wy += 5) {
        for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
          if (rnd() < 0.3) {
            g.fillStyle = rnd() < 0.8 ? 'rgba(255,212,140,0.9)' : 'rgba(190,220,255,0.9)';
            g.fillRect(wx, wy, 2, 2);
          }
        }
      }
    }
  }
  return c;
}

/**
 * Noční verze fotky: obloha (vyplněná od horního okraje přes plynulé přechody)
 * se nahradí noční oblohou, stromy ztmavnou, budovy ztmavnou a rozsvítí se okna.
 */
function nightify(img: ImageData, m: SkyMap): ImageData {
  const { width: W, height: H, data } = img;
  const out = new ImageData(new Uint8ClampedArray(data), W, H);
  const o = out.data;

  // maska oblohy: flood fill od horního okraje přes pixely bez ostrých hran
  const sky = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) {
    sky[x] = 1;
    stack.push(x);
  }
  const diff = (a: number, b: number) =>
    Math.abs(data[a * 4] - data[b * 4]) + Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) + Math.abs(data[a * 4 + 2] - data[b * 4 + 2]);
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y < H - 1 ? i + W : -1, y > 0 ? i - W : -1];
    for (const j of nb) {
      if (j < 0 || sky[j]) continue;
      const b = data[j * 4 + 2];
      if (b >= data[j * 4] && diff(i, j) < 14) {
        sky[j] = 1;
        stack.push(j);
      }
    }
  }

  const hash = (a: number, b: number) => {
    let h = (a * 374761393 + b * 668265263 + 7) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const cellW = Math.max(4, Math.round(W / 450));
  const cellH = cellW + 2;

  for (let y = 0; y < H; y++) {
    const ns = nightSky(m.worldAtRow(y));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = i * 4;
      const r = data[k];
      const gg = data[k + 1];
      const b = data[k + 2];
      if (sky[i]) {
        o[k] = ns[0];
        o[k + 1] = ns[1];
        o[k + 2] = ns[2];
        continue;
      }
      const tree = gg > r * 1.02 && gg > b * 0.95;
      if (tree) {
        o[k] = r * 0.05;
        o[k + 1] = gg * 0.06;
        o[k + 2] = b * 0.08;
        continue;
      }
      // budova: tma s nádechem do modra + okna v pravidelné mřížce
      o[k] = r * 0.07;
      o[k + 1] = gg * 0.08;
      o[k + 2] = b * 0.12 + 4;
      const cx = Math.floor(x / cellW);
      const cy = Math.floor(y / cellH);
      const inCore = x % cellW < cellW - 1 && y % cellH < cellH - 1;
      if (inCore && y > H * 0.08) {
        const h = hash(cx, cy);
        if (h < 0.11) {
          const warm = hash(cy, cx) < 0.8;
          const f = 0.6 + h * 3.5;
          o[k] = (warm ? 255 : 190) * f;
          o[k + 1] = (warm ? 205 : 215) * f;
          o[k + 2] = (warm ? 130 : 255) * f;
        }
      }
    }
  }

  // Space Needle: osvětlený talíř a maják
  const ctxCanvas = document.createElement('canvas');
  ctxCanvas.width = W;
  ctxCanvas.height = H;
  const g = ctxCanvas.getContext('2d')!;
  g.putImageData(out, 0, 0);
  const sx = NEEDLE_SAUCER.x * W;
  const sy = NEEDLE_SAUCER.y * H;
  const glow = g.createRadialGradient(sx, sy, 2, sx, sy, NEEDLE_SAUCER.w * W);
  glow.addColorStop(0, 'rgba(255,236,190,0.95)');
  glow.addColorStop(0.35, 'rgba(255,220,160,0.45)');
  glow.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.ellipse(sx, sy, NEEDLE_SAUCER.w * W, NEEDLE_SAUCER.w * W * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,245,215,0.95)';
  g.fillRect(sx - NEEDLE_SAUCER.w * W * 0.42, sy - 2, NEEDLE_SAUCER.w * W * 0.84, 5);
  g.fillStyle = '#ff3a2a';
  g.beginPath();
  g.arc(NEEDLE_BEACON.x * W, NEEDLE_BEACON.y * H, 4, 0, Math.PI * 2);
  g.fill();
  return g.getImageData(0, 0, W, H);
}

/** Prodloužení fotky dolů: zrcadlený a rozmazaný spodní pruh, který přejde do průměrné barvy. */
function extendDown(img: ImageData, ext: number, groundOut?: THREE.Color): HTMLCanvasElement {
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
  g.save();
  g.filter = 'blur(14px) brightness(0.75) saturate(0.85)';
  g.translate(0, 2 * H);
  g.scale(1, -1);
  g.drawImage(src, 0, H - ext, W, ext, 0, H - ext, W, ext);
  g.restore();

  // průměrná barva spodního řádku fotky
  const acc = [0, 0, 0];
  for (let x = 0; x < W; x++) {
    const i = ((H - 1) * W + x) * 4;
    acc[0] += img.data[i];
    acc[1] += img.data[i + 1];
    acc[2] += img.data[i + 2];
  }
  const avg: RGB = [(acc[0] / W) * 0.8, (acc[1] / W) * 0.8, (acc[2] / W) * 0.8];
  const fade = g.createLinearGradient(0, H, 0, H + ext);
  groundOut?.setRGB(avg[0] / 255, avg[1] / 255, avg[2] / 255, THREE.SRGBColorSpace);
  fade.addColorStop(0, `rgba(${avg.map((v) => v | 0).join(',')},0)`);
  fade.addColorStop(0.6, `rgba(${avg.map((v) => v | 0).join(',')},0.85)`);
  fade.addColorStop(1, `rgba(${avg.map((v) => v | 0).join(',')},1)`);
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
