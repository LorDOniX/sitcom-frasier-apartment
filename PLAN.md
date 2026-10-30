# Rozbor podkladů a plán prací

## 1. Co z konverzace s ChatGPT jde stáhnout a použít ve WebGL

Hotový model bytu ve formátu pro web (glTF/GLB) s texturami **neexistuje**. Byt je tedy postavený z vlastního půdorysu (fáze 1 je hotová) a jednotlivé zdroje se budou postupně doplňovat.

| Zdroj | Co obsahuje | Použitelnost pro three.js | Licence / cena | Doporučení |
| --- | --- | --- | --- | --- |
| **Fotografie výhledu** (Wikimedia Commons) | Kerry Park den (13516 × 2221) a večer (5096 × 3395) | ✅ **používá se** | CC BY-SA 4.0 / 2.0 | uvádět autory (úvodní panel, README); původní `skybox.jpg` neznámého původu se už nepoužívá |
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

### Fáze 2 – materiály a světlo ✅ hotovo (29. 10. 2026)
* Výhled z fotografie `skybox.jpg` (Kerry Park: Space Needle, downtown, Mount Rainier) za balkonem, procedurální pozadí dokola s navázanou oblohou, noční verze fotky.
* PBR podlahy podle místností: parkety rybí kost (obývák, jídelna, chodby), koberec (ložnice, chodba domu), mramorová dlažba (koupelny, kuchyně, prádelna, komora), žula (balkon). Textury CC0 z Poly Haven a ambientCG.
* Stěny z malované omítky (reliéf z normal mapy), soklové lišty, zárubně a obložky dveří, rámy a vnitřní parapety oken.
* Slunce se stíny (sluneční skvrny pod okny obýváku), odlesky z `RoomEnvironment`, noční stropní svítidla.

Zbývá z původního plánu fáze 2 (přesunuto do dalších fází):
* předpočítané nepřímé světlo (lightmapa z Blenderu) – bez něj je výplňové světlo všude stejné,
* `RectAreaLight` u velkých oken,
* fotografie výhledu i do ostatních směrů (teď je fotka jen za balkonem, okna obýváku a ložnic koukají na procedurální pozadí),
* sloučení drobných těles (zárubně, rámy oken) do jedné geometrie kvůli počtu draw callů.

### Fáze 3 – nábytek a typické předměty ✅ hotovo (29. 10. 2026, bez placených a přihlašovacích zdrojů)
* **glTF modely CC0 z Poly Haven** (11 kusů, `public/models/`): mid-century kožené křeslo jako zástupce Eames, podnožky, kožené křeslo u balkonu, jídelní židle, stolky, konzole za pohovkou, závěsné lampy, rostliny, busta, váza.
* **Procedurální modely** (`src/world/props.ts`) tam, kde volný model není: Frasierova olivová pohovka (samet Fabric028) a dvojsedák, **Martinovo pruhované křeslo s vysunutou podnožkou a izolepou**, klavírní křídlo s otevřeným víkem, klaviaturou a pedály, kuchyňská linka s dvířky a dřezem, ostrůvek s varnou deskou, barové stoličky, skleněný jídelní stůl s podnoží do X, stojací lampa (v noci svítí), postele s povlečením, vany (i volně stojící černá), WC, umyvadla, koberec s bordurou, vestavěné skříňky pod okny.
* **Obrazy**: procedurální abstraktní malby a zátiší s vázou, automaticky zavěšené na nejbližší stěnu; lze nahradit vlastním obrázkem (`image`).
* Systém nábytku: `furniture.json` – `kind` (procedurální) nebo `model` (glTF/GLB, i vlastní), `scale` / `fit: "box"` / `modelRot`, kolizní obdélník; ověřeno, že všechny místnosti jsou průchozí.
* Co zůstává na tobě (účet / platba) – viz **[STAHNOUT.md](STAHNOUT.md)**: originální Eames, lampa a obrazy z 3D Warehouse, případně CGTrader *Sit Com Set*.
* **Doplněno z 3D Warehouse** (Collada → GLB přes `tools/dae2glb`): originální pohovka, Eames s podnožkou, jídelní souprava, barové stoličky, **krb**, lednice, podstavec, stolky, lampa Corbu, váza a 6 obrazů/plakátů ze seriálu.
* **Výhled**: skutečné fotografie z Kerry Parku pro den i noc (CC BY-SA, Wikimedia Commons).
* Zatím chybí: knihovny, bar s lahvemi sherry, Eddieho pelíšek, horní kuchyňské skříňky, drobnosti na policích, model vstupních dveří (převedený, nezapojený).

### Fáze 4 – interakce a atmosféra
* ✅ **Hotovo (30. 10. 2026)**: vypínače stropních světel po místnostech, lampy na E, popisky zajímavostí (info panel), dveře se otevírají od hráče, vstupní dveře z modelu, syntetizované zvuky (kroky podle povrchu, dveře, vypínače, dozvuk v koupelnách, šum města, klavír s Bachovým preludiem, rádio KACL s vlastní znělkou). Původní zadání:
* Rozsvěcení světel vypínači (`E` na vypínač), stmívání.
* Klavír zahraje melodii, rádio KACL se znělkou „Hello Seattle, I'm listening…“ (pozor na autorská práva – vlastní nahrávka).
* Zvuky kroků podle povrchu, ozvěna v koupelně, šum města na balkoně.
* Popisky zajímavostí (Eames křeslo, obrazy) – info panel po zaměření.
* Plynulé otevírání dveří tam, kam hráč stojí (dveře se otevřou „od hráče“).

### Fáze 5 – optimalizace a nasazení
* ✅ **Zmenšení pro web (29. 10. 2026)**: zdroje přesunuté do `assets/`, `npm run assets` vyrábí do `public/` GLB s meshopt + WebP a WebP textury/fotky. Podklady 44 MB → 13 MB, úvodní přenos 11,5 MB, draw calls modelů 1 308 → 113, noční fotka líně, three.js v samostatném chunku, ukazatel průběhu načítání.
* ✅ **Kvalita a mobil (30. 10. 2026)**: volba kvality (rozlišení, stíny, vyhlazování, šířka výhledu), dotykové ovládání, stínová mapa jen při změně (v klidu polovina draw calls), sdílení PBR textur (odhad paměti textur v GPU 719 → 607 MB, nízká kvalita 540 MB), počítadlo FPS.
* Zbývá: KTX2 textury (menší paměť GPU, potřebuje Basis transcoder), lazy loading místností / LOD, mobilní ovládání, nastavení kvality (stíny, rozlišení), statický hosting – až po vyřešení licencí podkladů (modely z 3D Warehouse a půdorys šířit nelze).

### Volitelně – „skutečný“ vzhled ze seriálu
* Natrénovat Gaussian splatting / NeRF ze Sitcoms3D dat pro obývák a vložit ho do three.js (např. knihovna pro 3D Gaussian splatting) – vizuálně nejvěrnější, ale jen pro osobní použití.

## 4. Známá omezení prototypu
* Měřítko je odhad (±10 %); pokud se najde kótovaný rozměr (např. šířka klavíru nebo výška dveří ze seriálu), stačí upravit `METERS_PER_PX` v `src/config.ts`.
* Některé vnitřní příčky jsou v půdorysu šrafované a mohly se při trasování mírně zdeformovat; šatny a skříně mají jen otvory bez dveří.
* Stíny vrhá jen slunce; stropní svítidla (noc) stíny nemají a prosvítají přes stěny.
* Nábytek je zčásti zástupný (procedurální modely jsou jednodušší než skutečné kusy ze seriálu); polohy jsou odečtené z půdorysu s přesností ~10 cm.
* Fotka výhledu je jen jedna (110° za balkonem); jinými okny je vidět procedurální pozadí. Noční verze je vypočtená, ne fotografovaná – okna se rozsvěcují i na části stromů.
