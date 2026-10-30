import * as THREE from 'three';

/** Sada PBR map z public/textures/<dir>/ (diff, nor, rough – WebP vyrobené z assets/textures přes npm run assets). */
export interface PbrMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/**
 * Načtené obrázky podle URL. Každé použití mapy (jiný odstín látky, jiné opakování) dostane vlastní
 * Texture se sdíleným zdrojem (Texture.source) – do GPU se obrázek nahraje jen jednou.
 * Textura se označí k nahrání až po načtení obrázku (jinak by three.js každý snímek varoval).
 */
interface Shared {
  source: THREE.Texture["source"];
  loaded: boolean;
  waiting: THREE.Texture[];
}
const cache = new Map<string, Shared>();

function sharedTexture(loader: THREE.TextureLoader, url: string): THREE.Texture {
  let s = cache.get(url);
  if (!s) {
    const entry: Shared = { source: null!, loaded: false, waiting: [] };
    entry.source = loader.load(url, () => {
      entry.loaded = true;
      for (const t of entry.waiting) t.needsUpdate = true;
      entry.waiting.length = 0;
    }).source;
    cache.set(url, (s = entry));
  }
  const t = new THREE.Texture();
  t.source = s.source;
  if (s.loaded) t.needsUpdate = true;
  else s.waiting.push(t);
  return t;
}

/**
 * Načte PBR mapy a nastaví opakování. repeat = kolikrát se textura zopakuje
 * přes UV 0..1 (u podlahy celý půdorys, u stěn 1 UV = 1 m).
 */
export function loadPbr(
  loader: THREE.TextureLoader,
  dir: string,
  repeat: THREE.Vector2,
  aniso: number,
  maps: (keyof PbrMaps)[] = ['map', 'normalMap', 'roughnessMap'],
): Partial<PbrMaps> {
  const file = { map: 'diff', normalMap: 'nor', roughnessMap: 'rough' } as const;
  const load = (name: string, srgb: boolean) => {
    const t = sharedTexture(loader, `/textures/${dir}/${name}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.copy(repeat);
    t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const out: Partial<PbrMaps> = {};
  for (const k of maps) out[k] = load(file[k], k === 'map');
  return out;
}
