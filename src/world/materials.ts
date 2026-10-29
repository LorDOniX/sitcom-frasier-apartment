import * as THREE from 'three';

/** Sada PBR map z public/textures/<dir>/ (diff, nor, rough – WebP vyrobené z assets/textures přes npm run assets). */
export interface PbrMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
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
    const t = loader.load(`/textures/${dir}/${name}.webp`);
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
