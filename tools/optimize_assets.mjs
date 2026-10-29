#!/usr/bin/env node
/**
 * Optimalizace podkladů pro web: assets/  ->  public/  (spuštění: npm run assets)
 *
 * - modely (glTF/GLB): gltf-transform optimize – sloučení meshů a materiálů (méně draw calls),
 *   komprese geometrie meshopt, textury WebP max. 1024 px, opatrné zjednodušení geometrie,
 * - PBR textury (assets/textures/<dir>/*.jpg): WebP, max. 1024 px,
 * - fotografie výhledu: WebP.
 *
 * Zpracují se jen soubory, které jsou novější než výstup (nebo všechny s --force).
 * Zdroje v assets/ se do buildu nedostanou, Vite kopíruje jen public/.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'public');
const CLI = path.join(ROOT, 'node_modules', '.bin', 'gltf-transform');
const force = process.argv.includes('--force');

const TEX_SIZE = 1024;
// modely, u kterých stačí menší textury (velké plochy s jednoduchou strukturou)
const TEX_SIZE_BY_MODEL = { fireplace: 512 };

const stale = (src, out) => force || !fs.existsSync(out) || fs.statSync(src).mtimeMs > fs.statSync(out).mtimeMs;
const kb = (f) => fs.statSync(f).size / 1024;
let before = 0;
let after = 0;
const report = (label, src, out) => {
  const a = Array.isArray(src) ? src.reduce((s, f) => s + kb(f), 0) : kb(src);
  const b = kb(out);
  before += a;
  after += b;
  console.log(`${label.padEnd(44)} ${a.toFixed(0).padStart(6)} kB -> ${b.toFixed(0).padStart(6)} kB`);
};

/** Všechny soubory glTF modelu (gltf + bin + textury) kvůli porovnání velikosti. */
function gltfFiles(file) {
  if (file.endsWith('.glb')) return [file];
  const dir = path.dirname(file);
  return fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => fs.statSync(f).isFile());
}

function optimizeModel(src, out) {
  const name = path.basename(out, '.glb');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(
    CLI,
    [
      'optimize', src, out,
      '--compress', 'meshopt',
      '--texture-compress', 'webp',
      '--texture-size', String(TEX_SIZE_BY_MODEL[name] ?? TEX_SIZE),
      // zjednodušení jen tam, kde to není vidět (chyba 0,05 % rozměru meshe)
      '--simplify-error', '0.0005',
      // obrazy a malé modely nesmí ztratit tvar rámu
      '--simplify-lock-border', 'true',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

// --- modely --------------------------------------------------------------------
const models = path.join(SRC, 'models');
for (const entry of fs.readdirSync(models, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name === 'custom') {
    for (const f of fs.readdirSync(path.join(models, 'custom')).filter((f) => f.endsWith('.glb'))) {
      const src = path.join(models, 'custom', f);
      const out = path.join(OUT, 'models', 'custom', f);
      if (!stale(src, out)) continue;
      optimizeModel(src, out);
      report(`models/custom/${f}`, src, out);
    }
    continue;
  }
  // Poly Haven: assets/models/<name>/<name>.gltf -> public/models/<name>.glb
  const src = path.join(models, entry.name, `${entry.name}.gltf`);
  if (!fs.existsSync(src)) continue;
  const out = path.join(OUT, 'models', `${entry.name}.glb`);
  if (!stale(src, out)) continue;
  optimizeModel(src, out);
  report(`models/${entry.name}.glb`, gltfFiles(src), out);
}

// --- textury -------------------------------------------------------------------
const textures = path.join(SRC, 'textures');
for (const dir of fs.readdirSync(textures, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of fs.readdirSync(path.join(textures, dir.name)).filter((f) => f.endsWith('.jpg'))) {
    const src = path.join(textures, dir.name, f);
    const out = path.join(OUT, 'textures', dir.name, f.replace(/\.jpg$/, '.webp'));
    if (!stale(src, out)) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    // normal mapy citlivé na artefakty => vyšší kvalita
    const quality = f.startsWith('nor') ? 82 : 78;
    await sharp(src).resize(TEX_SIZE, TEX_SIZE, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toFile(out);
    report(`textures/${dir.name}/${path.basename(out)}`, src, out);
  }
}
for (const f of ['README.md']) {
  const src = path.join(textures, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'textures', f));
}

// --- fotografie výhledu --------------------------------------------------------
for (const f of fs.readdirSync(SRC).filter((f) => /^skybox_.*\.jpg$/.test(f))) {
  const src = path.join(SRC, f);
  const out = path.join(OUT, f.replace(/\.jpg$/, '.webp'));
  if (!stale(src, out)) continue;
  await sharp(src).webp({ quality: 82 }).toFile(out);
  report(f.replace(/\.jpg$/, '.webp'), src, out);
}

if (before) console.log(`\ncelkem ${(before / 1024).toFixed(1)} MB -> ${(after / 1024).toFixed(1)} MB`);
else console.log('vše je aktuální (pro nové zpracování: npm run assets -- --force)');
