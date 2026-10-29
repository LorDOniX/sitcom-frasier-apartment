# Rozbor podkladů a plán prací

## 1. Co z konverzace s ChatGPT jde stáhnout a použít ve WebGL

Hotový model bytu ve formátu pro web (glTF/GLB) s texturami **neexistuje**. Byt je tedy postavený z vlastního půdorysu (fáze 1 je hotová) a jednotlivé zdroje se budou postupně doplňovat.

| Zdroj | Co obsahuje | Použitelnost pro three.js | Licence / cena | Doporučení |
| --- | --- | --- | --- | --- |
| **Půdorys – I. A. Lizarralde** (`pudorys.jpg`) | rozvržení všech místností a nábytku, 1 : 100 | ✅ **už se používá** jako zdroj stěn, dveří, oken a jako textura podlahy | autorská kresba, prodává se jako tisk (pixels.com) | pro veřejné nasazení nahradit vlastní překreslenou podlahou nebo se zeptat autora |
| **CGTrader – Sit Com Set** | 6 částí stavby + 60+ kusů nábytku, FBX + STL (~41 MB) | ⚠️ jde to: Blender → úprava měřítka → materiály → GLB. Model je pro 3D tisk, **bez textur a UV** | placené (~6 USD), licence z CGTrader | **koupit** – nejrychlejší zdroj tvarů charakteristického nábytku (pohovka, krb, klavír, kuchyň) |
| **Cults3D – Sit Com Set** | stejný model jen v STL | ⚠️ horší než CGTrader (STL = jen trojúhelníky, žádné skupiny) | placené (~6 USD) | nekupovat, vzít CGTrader variantu |
| **3D Warehouse** – Eames křeslo + podnožka, stojací lampa, 2 obrazy | modely SketchUp s materiály (Eames ~8,6 k polygonů, 11 materiálů) | ✅ stáhnout `.skp` → Blender (add-on SketchUp importer) nebo SketchUp → export glTF/DAE → GLB | zdarma (účet Trimble), licence 3D Warehouse – dovoluje použití v projektu, ne samostatné šíření modelu | **stáhnout** – nejdetailnější kusy z původního seriálu |
| **Poly Haven** – Diagonal Parquet, Fabric Pattern 05 a další | PBR textury (barva, normal, roughness), 1–8K | ✅ přímo: JPG/PNG do `MeshStandardMaterial` | **CC0** | **stáhnout** (stačí 2K) – podlaha, čalounění, omítka |
| **ambientCG** | PBR materiály (dlažba, mramor, kůže, kov) | ✅ přímo | **CC0** | **stáhnout** – koupelny, kuchyň, kožené křeslo |
| **Sitcoms3D** (GitHub, ethanweber) | prostředí `Frasier-apartment`: snímky z epizod, COLMAP rekonstrukce, NeRF data, `threejs.json` (mračno bodů + bounding box), segmentace | ⚠️ **žádné hotové meshe**; mračno bodů se dá v three.js zobrazit jako reference, mesh by se musel natrénovat (NeRF/Gaussian splatting) | kód MIT, **licence dat neuvedená** (snímky ze seriálu) | stáhnout jen jako **referenci** rozměrů/barev, nepublikovat |
| **Unreal Engine 5 rekonstrukce** (Reddit, Strid3r21) | ručně modelovaný obývák | ❌ zatím ke stažení není | – | jen vizuální inspirace; případně napsat autorovi |

### Na co pozor
* Byt je **televizní kulisa** – čtvrtá stěna, strop a výhled jsou domyšlené (v půdorysu je spodní stěna obýváku s okny mezi pilíři).
* Pro **veřejné publikování** je problematický půdorys (cizí autorské dílo), materiály ze seriálu (Sitcoms3D) a placené modely, jejichž licence obvykle zakazuje šíření zdrojových souborů – v GLB na webu jsou ale prakticky stažitelné. U CGTrader i 3D Warehouse si před zveřejněním přečíst podmínky.
* Velké modely před nasazením zmenšit: `gltf-transform` (Draco/Meshopt komprese geometrie, KTX2 textury).

## 2. Co je hotové (fáze 1 – prototyp)

* Vite + TypeScript + three.js projekt (`npm run dev`).
* Celý byt v měřítku podle půdorysu (≈ 29 × 23 m, strop 2,75 m): 8 polygonů stěn vytažených automaticky z obrázku, 14 místností, kus chodby domu před vstupními dveřmi.
* Ovládání WASD + myš (Pointer Lock), `Shift` = rychlejší chůze, jemné pohupování při chůzi.
* **10 otvíracích dveří** (`E`) se správnou stranou otvírání podle oblouků v půdorysu a **2 posuvné dveře na balkon**.
* Okna (parapet, sklo, rám), prosklená stěna k balkonu, zábradlí, skleněná zástěna vany.
* Kolize se stěnami, okny, nábytkem a dveřmi (i během otvírání). Ověřeno automatickým testem: všechny dveře jdou otevřené projít, zavřené blokují.
* Zástupný nábytek z jednoduchých těles (pohovky, Martinovo křeslo, Eames, klavír, jídelní stůl, kuchyňský ostrůvek a linky, postele).
* Podlaha přepínatelná mezi barevným půdorysem a procedurálními parketami (`P`), strop, stropní svítidla.
* Procedurální panorama Seattlu (Space Needle za balkonem, Mount Rainier, Elliott Bay), den / noc (`N`).
* Minimapa s polohou a směrem pohledu (`M`), název místnosti v rohu obrazovky.
* Nástroj `tools/trace_walls.py` + kontrolní překryv `tools/out/walls_overlay.png`.

## 3. Přehled dalších fází

### Fáze 2 – materiály a světlo (bez nákupu modelů)
1. PBR textury z Poly Haven / ambientCG: parkety v obýváku a chodbách, dlažba v koupelnách a kuchyni, omítka stěn. Místo jedné roviny podlahy rozdělit podlahu podle `rooms.png` (každá místnost svůj materiál).
2. Lišty, zárubně dveří, parapety, pilíře u oken – drobnosti, které nejvíc přidají na „architektuře“.
3. Osvětlení: předpočítané nepřímé světlo (lightmapa z Blenderu) nebo aspoň `RectAreaLight` u oken + HDRI prostředí (`RoomEnvironment` / PMREM) pro odlesky.
4. Stíny od slunce oknem (jedno `DirectionalLight` se shadow mapou omezenou na byt).
5. Výhled: místo kreslené panoramy fotografie Seattlu od Space Needle (ekvirektangulární, CC0/CC-BY) nebo vlastní render.

### Fáze 3 – nábytek a typické předměty
1. Koupit CGTrader *Sit Com Set*, v Blenderu: převést FBX, srovnat měřítko podle `furniture.json`, UV unwrap, materiály, export do GLB po kusech.
2. Stáhnout z 3D Warehouse Eames křeslo, stojací lampu a oba obrazy → GLB.
3. Doplnit, co v balíčku chybí: Martinovo křeslo (proužkovaná látka – upravit Fabric Pattern 05), krb, knihovny, bar s lahvemi sherry, socha u sloupu, Eddieho pelíšek.
4. V kódu nahradit zástupná tělesa za `GLTFLoader` + `DRACOLoader`, kolize ponechat obdélníkové z `furniture.json`.

### Fáze 4 – interakce a atmosféra
* Rozsvěcení světel vypínači (`E` na vypínač), stmívání.
* Klavír zahraje melodii, rádio KACL se znělkou „Hello Seattle, I'm listening…“ (pozor na autorská práva – vlastní nahrávka).
* Zvuky kroků podle povrchu, ozvěna v koupelně, šum města na balkoně.
* Popisky zajímavostí (Eames křeslo, obrazy) – info panel po zaměření.
* Plynulé otevírání dveří tam, kam hráč stojí (dveře se otevřou „od hráče“).

### Fáze 5 – optimalizace a nasazení
* Komprese GLB (`gltf-transform optimize`, Draco/Meshopt, KTX2), lazy loading místností.
* Mobilní ovládání (virtuální joystick, dotykové rozhlížení), nastavení kvality.
* Statický hosting (GitHub Pages / Netlify) – až po vyřešení licencí podkladů.

### Volitelně – „skutečný“ vzhled ze seriálu
* Natrénovat Gaussian splatting / NeRF ze Sitcoms3D dat pro obývák a vložit ho do three.js (např. knihovna pro 3D Gaussian splatting) – vizuálně nejvěrnější, ale jen pro osobní použití.

## 4. Známá omezení prototypu
* Měřítko je odhad (±10 %); pokud se najde kótovaný rozměr (např. šířka klavíru nebo výška dveří ze seriálu), stačí upravit `METERS_PER_PX` v `src/config.ts`.
* Některé vnitřní příčky jsou v půdorysu šrafované a mohly se při trasování mírně zdeformovat; šatny a skříně mají jen otvory bez dveří.
* Světla nemají stíny, takže prosvítají přes stěny (řeší fáze 2).
* Nábytek je jen zástupný a na podlaze je zároveň vidět nakreslený nábytek z půdorysu (klávesa `P` přepne na parkety).
