# Elliott Bay Towers, apt. 1901 – procházka bytem Frasiera Cranea

WebGL procházka bytem ze sitcomu *Frasier* (1993–2004). Vite + TypeScript + three.js.
Geometrie bytu je vytažená přímo z půdorysu `pudorys.jpg` (Iñaki Aliste Lizarralde, 1 : 100), takže rozměry i rozmístění místností odpovídají kresbě.

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produkční build do dist/
npm run assets   # po změně čehokoli v assets/: optimalizace modelů, textur a fotek do public/
```

Zdrojové podklady jsou v `assets/` (do buildu se nedostanou), aplikace načítá jen optimalizované
verze z `public/`. Úvodní načtení je ~11,5 MB (noční fotka 1,1 MB se stáhne až při přepnutí na noc).

## Ovládání

| Klávesa | Akce |
| --- | --- |
| `W` `A` `S` `D` / šipky | chůze |
| myš | rozhlížení (po kliknutí se zamkne kurzor) |
| `Shift` | rychlejší chůze |
| `E` | interakce s tím, na co míří zaměřovač: dveře (otevřou se od hráče), posuvné dveře na balkon, vypínače světel, lampy, klavír, rádio KACL, popisky zajímavostí |
| `M` | minimapa |
| `P` | podlaha: materiály / barevný půdorys |
| `N` | den / noc |
| `C` | vypnout kolize (létání skrz stěny pro ladění) |
| `F` | počítadlo FPS (a počet draw calls) |
| `Esc` | pauza |

Na telefonu a tabletu (dotykové zařízení bez myši) se místo zamčení kurzoru zapne dotykové ovládání: levý palec = joystick pod prstem, tažení v pravé části = rozhlížení, tlačítka **E** (akce), **M** (minimapa), **☾** (den/noc) a **☰** (menu). Kvalita (nízká / střední / vysoká) se volí v úvodním menu a ukládá do prohlížeče; bez volby mají dotyková zařízení nízkou.

## Jak to funguje

```
pudorys.jpg ──► tools/trace_walls.py ──► src/data/walls.json      (polygony stěn)
                     ▲                    public/floor_mask.png    (tvar podlahy a stropu)
tools/plan_edits.json┘                    public/rooms.png         (mapa místností pro HUD)
                                          public/floors/*.png      (masky materiálů podlah po výškových úrovních)
                                          src/data/levels.json     (obrysy výškových úrovní)
src/data/openings.json  (dveře, okna, balkon, místnosti + jejich podlaha, výškové úrovně – ručně zadané v px půdorysu)
src/data/furniture.json (nábytek: procedurální `kind` nebo glTF `model`, obrazy, stropní světla, vypínače)
src/data/info.json      (texty popisků zajímavostí podle názvu předmětu)
public/models/          (glTF modely CC0 – viz public/models/README.md)
assets/                 (zdroje: textury JPG, modely glTF z Poly Haven, modely z 3D Warehouse, fotky)
  ──► npm run assets ──► public/textures/*.webp, public/models/*.glb, public/models/custom/*.glb, public/skybox_*.webp
```

* **Stěny**: prahování černé barvy → morfologické otevření → ruční úpravy (`tools/plan_edits.json`: smazat text/nábytek, dokreslit chybějící zdi) → trasování obrysu → zjednodušení a srovnání hran na násobky 45° → `ExtrudeGeometry` do výšky 2,75 m.
* **Měřítko**: 0,027 m/px (≈ 37 px na metr), odhadnuto z šířky dveří a postelí. Mění se v `src/config.ts`.
* **Dveře**: v `openings.json` je pant (`hinge`), volný konec křídla (`tip`) a výchozí strana otvírání (`open`). Hráč dveře otevře vždy od sebe. Nadpraží se generuje automaticky; vstupní dveře mají vzhled z modelu `front_door.glb` (jen křídlo, zrcadlené na obě strany).
* **Výškové úrovně**: obývák, jídelna, kuchyně a předsíň jsou o dva schody (2 × 17 cm) níž než zbytek bytu; žlutý pás kolem balkonu v půdorysu je mezistupeň. Zadání je v `levels` v `openings.json` (oblast zaplavená od semínka po stěny a dělicí čáru, schod jako mnohoúhelník), `npm run trace` z něj vyrobí `src/data/levels.json` a masky podlah pro každou úroveň. Výška podlahy (`src/levels.ts`) posouvá hráče, nábytek, dveře, okna a lišty; stěny začínají u nejnižší podlahy.
* **Kolize**: hráč je kruh o poloměru 22 cm, úsečky stěn / oken / nábytku jsou v prostorové mřížce, dveře se přidávají dynamicky podle aktuálního natočení.
* **Podlahy**: každá místnost má v `openings.json` materiál (`wood`, `carpet`, `tile`, `stone`, `corridor`). Generátor z mapy místností vyrobí nepřekrývající se masky a každý materiál je jedna rovina s `alphaMap`. Dělicí čára `room_dividers` určuje hranici dlažby a parket mezi kuchyní a jídelnou.
* **Výhled**: `src/world/skyline.ts` – denní fotografie na výseči válce (140°) se středem za balkonem, noční zvlášť (110°), dole prodloužená a po stranách prolnutá s procedurálním pozadím, jehož obloha je navzorkovaná z okrajů fotky. Polohu horizontu a záběr lze doladit konstantami na začátku souboru.
* **Světlo**: odpolední slunce se stínovou mapou (4096², stíny vrhají stěny, strop, dveře i nábytek) – do bytu svítí jen okny; výplň dělá polokulové světlo a `RoomEnvironment` pro odlesky. V noci svítí stropní svítidla, rozsvěcují se vypínači u dveří (`switches` ve `furniture.json`: indexy světel a poloha – bod u stěny, nebo `door` = vedle kliky dveří). Lampy (`light: true`) se zapínají přímo. Bodová světla jsou viditelná jen v noci a vypínač mění jen jejich intenzitu – změna počtu světel by překompilovala shadery.
* **Výkon** (`src/quality.ts`): kvalita určuje rozlišení vykreslování, velikost stínové mapy (1024 / 2048 / 4096), vyhlazování hran a šířku fotky výhledu (4096 / 6144 / 8192 px). Stínová mapa slunce se přepočítává jen při změně (pohyb dveří, načtení modelu, přepnutí den/noc) – v klidu odpadá celý stínový průchod (polovina draw calls). PBR textury se stejnou mapou (různé odstíny látek) sdílejí obrázek, do GPU se nahraje jednou.
* **Zvuk** (`src/audio.ts`): vše syntetizované přes Web Audio, žádné nahrávky – kroky podle povrchu (parkety, koberec, dlažba, kámen; koberec v obýváku podle jeho obrysu), dveře, posuvné dveře, cvaknutí vypínačů, dozvuk v koupelnách, šum města podle otevřených balkonových dveří, klavír (Bachovo Preludium C dur, volné dílo) a rádio KACL (vlastní znělka, hlas z `speechSynthesis`, generovaná hudba přes filtr malého reproduktoru). Zdroje mají polohu (`PannerNode`), posluchač je kamera.
* **Kontrola dat**: `npm run trace` přegeneruje data a uloží `tools/out/walls_overlay.png` – půdorys s vykreslenými stěnami (červeně), dveřmi (zeleně), okny (modře) a zábradlím. Po každé úpravě JSONů se vyplatí ho otevřít.

Nástroj potřebuje jen Python 3 + Pillow.

## Autoři a licence podkladů

* **Fotografie výhledu** (Wikimedia Commons): den – [SounderBruce, *Seattle skyline panorama from Kerry Park, June 2022*](https://commons.wikimedia.org/wiki/File:Seattle_skyline_panorama_from_Kerry_Park,_June_2022.jpg), CC BY-SA 4.0; noc – [ragesoss, *Seattle skyline from Kerry Park, evening of 2014-10-19 no. 09*](https://commons.wikimedia.org/wiki/File:Seattle_skyline_from_Kerry_Park,_evening_of_2014-10-19_no._09.jpg), CC BY-SA 2.0. Upravené verze (`public/skybox_*.jpg`, zmenšené) podléhají stejné licenci.
* **Modely z bytu**: 3D Warehouse, převážně R. Sebastian – licence 3D Warehouse (použití v projektu ano, samostatné šíření ne; `public/models/custom/` je v `.gitignore`).
* **Ostatní modely a textury**: Poly Haven, ambientCG – CC0.
* **Půdorys**: Iñaki Aliste Lizarralde.

## Převod modelů z 3D Warehouse

```bash
python3 tools/dae2glb/extract.py   # stazene/*.zip -> tools/out/dl/
npm run dev                        # v druhém terminálu
npm run models                     # -> assets/models/custom/*.glb (+ náhledy v tools/out/thumbs/)
npm run assets                     # -> optimalizované public/models/custom/*.glb
```

## Optimalizace pro web (`tools/optimize_assets.mjs`)

* **Modely**: `gltf-transform optimize` – sloučení meshů a materiálů (draw calls modelů 1 308 → 113),
  komprese geometrie **meshopt** (dekodér v aplikaci: `GLTFLoader.setMeshoptDecoder`), textury **WebP** max. 1024 px
  (krb 512 px), opatrné zjednodušení geometrie (chyba 0,05 % rozměru). 34 MB → 7,2 MB.
* **PBR textury**: WebP max. 1024 px (normal mapy kvalita 82, ostatní 78). 6,6 MB → 3,8 MB.
* **Fotky výhledu**: WebP. 3,7 MB → 2,2 MB; noční se načítá líně.
* **JavaScript**: three.js v samostatném chunku (`vite.config.ts`) – 174 kB gzip, aplikace 21 kB gzip.
* Skript zpracuje jen změněné soubory; `npm run assets -- --force` vše znovu.

## Struktura

```
src/
  main.ts           scéna, smyčka, UI, klávesy
  config.ts         měřítko, výšky, rychlosti, start
  plan.ts           převod px půdorysu <-> metry
  player.ts         pohyb první osobou (PointerLockControls)
  collision.ts      kolize kruh × úsečky
  minimap.ts, rooms.ts (název místnosti a povrch pod hráčem)
  interact.ts       rozhraní interaktivních objektů (E)
  audio.ts          syntetizované zvuky (Web Audio)
  info.ts           panel s popiskem zajímavosti
  quality.ts        nastavení kvality, přepočet stínů jen při změně
  touch.ts          dotykové ovládání (joystick, rozhlížení, tlačítka)
  world/walls.ts, openings.ts, floor.ts, skyline.ts, materials.ts
  world/furniture.ts  rozmístění nábytku, glTF modely, obrazy, akce předmětů
  world/lighting.ts   stropní světla, vypínače, okruhy světel
  world/actions.ts    klavír, rádio, popisky
  world/props.ts      procedurální nábytek (pohovka, Martinovo křeslo, klavír, kuchyň s horními skříňkami a digestoří,
                      sloup s knihovnou, konferenční stolek, rádio, koupelny…); meshe se slučují podle materiálu
  data/*.json
tools/trace_walls.py, plan_edits.json
```

Další postup, přehled zdrojů a fází viz [PLAN.md](PLAN.md). Co si stáhnout / koupit sám: [STAHNOUT.md](STAHNOUT.md).
