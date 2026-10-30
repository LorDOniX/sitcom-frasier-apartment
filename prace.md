# Simulátor chůze po bytu
- chtěl bych udělat webgl aplikaci, threejs knihovnu, vite + typescript

# Přehled
- 3d procházka bytem Frasiera Cranea ze sitcomu

# Přehled dostupných modelů a textur
@frasier_crane_byt_konverzace.md

# Práce (původní zadání – hotovo)
- zkus projít konverzaci z chatgpt
- co by šlo postahovat a použít pro webgl
- ovládání přes wsad, pohled myší, dveře otevírat přes E
- celý byt v měřítku a rozmístnění z půdorysu @pudorys.jpg
- zkus navrhnout co půjde dodělat, přehled fází

---

# Stav k 29. 10. 2026

Hotové fáze (podrobně v @PLAN.md, technický popis v @README.md, zdroje v @STAHNOUT.md):

- **Fáze 1** – byt z půdorysu (stěny automaticky z `pudorys.jpg`), WASD + myš, 10 dveří + 2 posuvné na balkon (E), kolize, minimapa (M), název místnosti.
- **Fáze 2** – PBR podlahy podle místností, omítka, lišty, zárubně, slunce se stíny, den/noc (N).
- **Fáze 3** – nábytek: procedurální (Martinovo křeslo, klavír, kuchyň, koupelny, postele) + Poly Haven (CC0) + 19 modelů z 3D Warehouse (pohovka, Eames, jídelní souprava, stoličky, krb, lednice, obrazy…); výhled z fotek Kerry Parku (den i noc, CC BY-SA).
- **Fáze 4** – vypínače světel, lampy, popisky zajímavostí, dveře od hráče, model vstupních dveří, syntetizované zvuky, klavír, rádio KACL.
- **Fáze 5 (část)** – zmenšení pro web: zdroje v `assets/`, `npm run assets` → `public/` (meshopt + WebP), 44 MB → 13 MB, draw calls modelů 1 308 → 113.
- **Fáze 5 (kvalita, mobil)** – volba kvality, dotykové ovládání, stíny jen při změně, sdílení textur.

# Zprovoznění na jiném PC

```bash
git clone git@github.com:LorDOniX/sitcom-frasier-apartment.git
cd sitcom-frasier-apartment
npm install
npm run dev          # http://localhost:5173
```

**Pozor – v gitu nejsou modely z 3D Warehouse** (licence nedovoluje jejich šíření, jsou v `.gitignore`):

| Složka | Velikost | Co to je |
| --- | --- | --- |
| `assets/models/custom/` | 23 MB | převedené GLB (zdroj pro `npm run assets`) |
| `public/models/custom/` | 4 MB | optimalizované GLB, které načítá aplikace |
| `stazene/` | 44 MB | původní ZIPy z 3D Warehouse + fotky |

Bez nich byt funguje, ale **chybí pohovka, Eames, jídelní stůl, stoličky, krb, lednice, obrazy…** (v konzoli budou varování „Model … se nepodařilo načíst“). Možnosti:

1. **Nejjednodušší:** zkopírovat ze starého PC složku `public/models/custom/` (4 MB, USB / cloud) → hotovo.
2. Zkopírovat `assets/models/custom/` (23 MB) a spustit `npm run assets`.
3. Zkopírovat `stazene/` a převést znovu: `python3 tools/dae2glb/extract.py` → `npm run dev` → `npm run models` → `npm run assets`.

Plakát Rauschenberg používá texturu z aukční fotky (`poster_rauschenberg_foto.glb`). Při převodu podle bodu 3 ho vyrob
`node tools/poster_foto.mjs` → `npm run assets` (potřebuje `stazene/reference/19.jpg` – referenční fotky stažené
z @frasier_reference_fotky.md, číslované stejně jako v něm; jen pro lokální použití).

Pillow na Ubuntu 24.04: `sudo apt install python3-pil` (nebo `pip install --user --break-system-packages pillow`).

Potřebné nástroje: Node.js 24 (npm 11), Python 3 + Pillow (`tools/trace_walls.py`, `tools/dae2glb/extract.py`),
Google Chrome v `/usr/bin/google-chrome` jen pro převod Collada (`npm run models`, jinak `CHROME=/cesta npm run models`).
Na Windows bez WSL: `npm run dev` a `npm run assets` fungují, Python skripty potřebují Python s Pillow.

# Další práce

## Fáze 4 – interakce a atmosféra (hotovo 30. 10. 2026)
1. ✅ **Vypínače světel** – 9 vypínačů (`switches` ve `furniture.json`), u dveří pokojů se umisťují automaticky vedle kliky; noc už nerozsvěcí vše.
2. ✅ **Stojací lampa a lampa Corbu** – E rozsvítí / zhasne (`light: true`, `on`, `power`).
3. ✅ **Popisky zajímavostí** – Eames, Martinovo křeslo, pohovka, konferenční stolek, plakát Rauschenberg, krb (`src/data/info.json`).
4. ✅ **Zvuky** – vše syntetizované (Web Audio, `src/audio.ts`), žádné nahrávky: kroky podle povrchu, dveře, vypínače, dozvuk v koupelnách, šum města podle otevřeného balkonu.
5. ✅ **Klavír** – Bachovo Preludium C dur, takty 1–8 (volné dílo).
6. ✅ **Rádio KACL** – na konzoli za pohovkou; vlastní znělka, hlas přes `speechSynthesis`, generovaná hudba.
7. ✅ **Dveře** – otevírají se od hráče; vstupní dveře mají vzhled z `front_door.glb`.

Možná vylepšení: popisek výhledu z balkonu a dalších obrazů (chybí ověřené informace), světla v ostatních koupelnách, toaletě, komoře a prádelně (nemají svítidlo), hlas rádia jde mimo prostorový zvuk (`speechSynthesis` nejde napojit na Web Audio).

## Drobnosti, které zbývají
- Chybí: knihovny, bar s lahvemi sherry, Eddieho pelíšek, horní kuchyňské skříňky, drobnosti na policích.
- Ze 3D Warehouse nestaženo: Frasier's Floor Lamp, Large Abstract Painting, Framed Art 2, Side Table, Wassily Chair (odkazy v @STAHNOUT.md, limit 3 stažení/den).
- Fotka 360° pro výhled z ostatních oken (kandidát: *Space Needle 360 Panorama* na Wikimedia Commons, CC BY-SA 3.0).
- Stropní světla v noci nemají stíny a prosvítají stěnami.
- Výplňové světlo je všude stejné – předpočítané osvětlení (lightmapa z Blenderu) by výrazně pomohlo.

## Fáze 5 – zbytek
- ✅ Nastavení kvality (nízká / střední / vysoká v úvodním menu), dotykové ovládání pro telefon a tablet, počítadlo FPS (`F`).
- ✅ Stínová mapa jen při změně, sdílení PBR textur, menší fotka výhledu podle kvality (paměť textur v GPU ~719 → 607 MB, nízká kvalita 540 MB).
- KTX2 textury (méně paměti GPU, hlavně mobily) – potřebuje `toktx` z KTX-Software (archiv bez instalace, 6 MB); zbývající paměť je hlavně v texturách modelů a PBR mapách.
- LOD / lazy loading místností.
- Nasazení na statický hosting – až po vyřešení licencí (modely z 3D Warehouse a půdorys šířit nelze; fotky CC BY-SA s uvedením autora jsou OK).

# Užitečné příkazy

| Příkaz | Co dělá |
| --- | --- |
| `npm run dev` | vývojový server |
| `npm run build` / `npm run preview` | produkční build / jeho náhled |
| `npm run assets` | optimalizace `assets/` → `public/` (jen změněné soubory, `-- --force` vše) |
| `npm run trace` | přegenerování stěn, podlah a mapy místností z půdorysu (po úpravě `tools/plan_edits.json` nebo `src/data/openings.json`) |
| `npm run models` | převod Collada z 3D Warehouse → `assets/models/custom/` (běží při spuštěném `npm run dev`) |

Klávesy v aplikaci: WASD, myš, Shift, E (dveře), M (minimapa), P (podlaha / půdorys), N (den/noc), C (kolize), Esc.
