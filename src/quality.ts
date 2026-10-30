/**
 * Nastavení kvality (fáze 5): rozlišení vykreslování, velikost stínové mapy, vyhlazování hran.
 * Volba se ukládá do localStorage; bez uložené volby mají dotyková zařízení nízkou kvalitu.
 */
export type Quality = 'low' | 'medium' | 'high';

export interface QualitySettings {
  label: string;
  /** strop pro devicePixelRatio */
  pixelRatio: number;
  /** velikost stínové mapy slunce */
  shadowMap: number;
  antialias: boolean;
  /** maximální šířka fotky výhledu v px (8192 × 2154 zabere v GPU ~90 MB) */
  skylineWidth: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { label: 'Nízká', pixelRatio: 1, shadowMap: 1024, antialias: false, skylineWidth: 4096 },
  medium: { label: 'Střední', pixelRatio: 1.5, shadowMap: 2048, antialias: true, skylineWidth: 6144 },
  high: { label: 'Vysoká', pixelRatio: 2, shadowMap: 4096, antialias: true, skylineWidth: 8192 },
};

/** Dotykové zařízení bez myši (telefon, tablet) – místo Pointer Locku dotykové ovládání. */
export const isTouch = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;

const KEY = 'frasier.quality';

export function loadQuality(): Quality {
  const q = localStorage.getItem(KEY);
  return q === 'low' || q === 'medium' || q === 'high' ? q : isTouch ? 'low' : 'high';
}

export function saveQuality(q: Quality) {
  localStorage.setItem(KEY, q);
}

/**
 * Stínová mapa slunce se nepřepočítává každý snímek (slunce i nábytek stojí) – jen když se něco pohne
 * (dveře) nebo načte (modely). Kdo něco změní, zavolá markShadows().
 */
let shadowFrames = 2;
export function markShadows(frames = 1) {
  shadowFrames = Math.max(shadowFrames, frames);
}
/** Má se v tomto snímku přepočítat stínová mapa? (volá smyčka jednou za snímek) */
export function takeShadowUpdate(): boolean {
  if (shadowFrames <= 0) return false;
  shadowFrames--;
  return true;
}
