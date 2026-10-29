#!/usr/bin/env node
/**
 * Převod modelů Collada (.dae) z 3D Warehouse do GLB pro three.js.
 *
 *   1) python3 tools/dae2glb/extract.py        # rozbalí stazene/ do tools/out/dl/
 *   2) npm run dev                             # Vite servíruje převodník i rozbalené soubory
 *   3) npm run models                          # převede vše z OUT do assets/models/custom/
 *   4) npm run assets                          # optimalizace pro web -> public/models/custom/
 *
 * Převod běží v headless Chrome (three.js ColladaLoader -> GLTFExporter): odstraní čáry hran
 * ze SketchUpu, volitelně ořízne scénu na zadaný prostor, zmenší textury a uloží náhledy
 * (zepředu, z boku, shora) do tools/out/thumbs/ pro kontrolu orientace.
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DL = path.join(ROOT, 'tools', 'out', 'dl');
const OUT_DIR = path.join(ROOT, 'assets', 'models', 'custom');
const THUMBS = path.join(ROOT, 'tools', 'out', 'thumbs');
const BASE = process.env.DEV_URL || 'http://localhost:5173';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

// složka v tools/out/dl  ->  výsledný soubor v assets/models/custom
const OUT = {
  frasier_s_sofa_prop: 'sofa',
  eames_lounge_chair_black_frasier: 'eames',
  frasier_crane_s_dining_table_w_chairs: 'dining',
  frasier_counterstool_3: 'stools',
  pedestal: 'pedestal',
  frasier_fireplace_6: 'fireplace',
  fasier_s_refrigerator: 'fridge',
  frasier_s_three_drawer_table: 'drawer_table',
  martin_crane_s_side_table: 'martin_table',
  ball_table_2_reflective: 'ball_table',
  corbu_lamp_3: 'corbu_lamp',
  black_vase_frasier: 'black_vase',
  charles_cleeton_48_x_72_5: 'painting_cleeton',
  frasier_crane_s_red_blue_vase_painting: 'painting_vase',
  frasier_crane_s_rauschenber_venice_usa_2: 'poster_rauschenberg',
  dancers_i: 'painting_dancers',
  elegy_in_green: 'painting_elegy',
  frasier_apartment_framed_art: 'painting_framed',
  frasier_crane_s_door: 'front_door',
};

// úpravy jednotlivých modelů (souřadnice v metrech po načtení, osa Y nahoru)
const OPTS = {
  // pod pohovkou jsou v souboru pomocné objekty pod úrovní podlahy
  frasier_s_sofa_prop: { keepBox: [[-5, -0.05, -5], [5, 5, 5]] },
  // „krb“ je výřez celé scény obýváku (16 × 12 m): jen krb s obložením, bez černé tyče nahoře
  frasier_fireplace_6: {
    keepBox: [[1.4, -0.05, -10.0], [6.0, 3.7, -8.2]],
    dropBoxes: [[[3.7, 1.2, -9.8], [3.95, 3.7, -9.5]]],
    maxTex: 512,
  },
};

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(THUMBS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('chyba stránky:', e.message));
  await page.goto(`${BASE}/tools/dae2glb/index.html`);
  await page.waitForFunction(() => window.ready, null, { timeout: 30000 });

  const only = process.argv.slice(2);
  for (const slug of Object.keys(OUT)) {
    if (only.length && !only.includes(slug) && !only.includes(OUT[slug])) continue;
    const dir = path.join(DL, slug);
    if (!fs.existsSync(dir)) {
      console.log(`${slug}: chybí v tools/out/dl (spusť extract.py)`);
      continue;
    }
    const dae = fs.readdirSync(dir, { recursive: true }).find((f) => f.toLowerCase().endsWith('.dae'));
    const url = `/tools/out/dl/${slug}/${dae}`.split('/').map(encodeURIComponent).join('/');
    try {
      const r = await page.evaluate(([u, o]) => window.convert(u, o), [url, { maxTex: 1024, ...(OPTS[slug] || {}) }]);
      const file = path.join(OUT_DIR, OUT[slug] + '.glb');
      fs.writeFileSync(file, Buffer.from(r.glb, 'base64'));
      r.thumbs.forEach((t, i) => fs.writeFileSync(path.join(THUMBS, `${OUT[slug]}_${i}.jpg`), Buffer.from(t.split(',')[1], 'base64')));
      const missing = r.failed.length ? ` (chybí ${r.failed.length} textur)` : '';
      console.log(`${OUT[slug]}.glb: ${r.size.join(' × ')} m, ${r.tris} trojúhelníků, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB${missing}`);
    } catch (e) {
      console.log(`${slug}: CHYBA ${e.message.slice(0, 200)}`);
    }
  }
  await browser.close();
})();
