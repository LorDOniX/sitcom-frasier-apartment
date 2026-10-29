# Co si stáhnout nebo koupit sám

Všechno, co šlo stáhnout zdarma a bez přihlášení (CC0), už v projektu je – viz `public/textures/README.md` a `public/models/README.md`.
Níže jsou věci, které vyžadují **účet, platbu nebo tvé rozhodnutí o licenci**. Byt funguje i bez nich; jde o věrnost seriálu.

## 1. 3D Warehouse – kusy přímo z Frasierova bytu (zdarma, účet Trimble ID)

> **Stav 29. 10. 2026:** staženo a zapojeno 19 modelů (viz tabulka v `public/models/README.md`).
> GLB je ve 3D Warehouse jen pro placené plány; zdarma jde **Collada File** (ZIP s `.dae`) – to stačí.
> Bezplatný účet má limit **3 stažení denně** (reklamními videi až 100).

**Postup pro další modely:** *Download → Collada File* → ZIP (nerozbalovat) do `stazene/` →
`python3 tools/dae2glb/extract.py` → `npm run dev` → `npm run models` (u nového modelu je potřeba doplnit
řádek do `OUT` v `tools/dae2glb/convert.cjs` a položku do `src/data/furniture.json`, nebo dej vědět).

Autor **R. Sebastian** vymodeloval desítky předmětů z bytu (odkazy ověřené přes API 3D Warehouse):

### Priorita A – nahradí zástupné kusy v bytě

| Model | Soubor | Nahradí | Velikost | Odkaz |
| --- | --- | --- | --- | --- |
| Frasier Sofa | `sofa.glb` | procedurální pohovka | 0,4 MB | <https://3dwarehouse.sketchup.com/model/9da14ca5-3c06-4dbd-a887-3da4d4f3a750> |
| Frasier Crane's Eames Lounge Chair & Ottoman | `eames.glb` | mid-century křeslo + podnožka | 1,1 MB | <https://3dwarehouse.sketchup.com/model/23a1c8c6-44af-4399-8900-866827f6e90d> |
| Frasier Crane's Dining Table with Chairs | `dining.glb` | skleněný stůl + 4 židle | 0,6 MB | <https://3dwarehouse.sketchup.com/model/30791f20-9780-433b-9e53-07d58f964384> |
| Frasier Crane's Kitchen Counter Stools | `stools.glb` | barové stoličky | 0,7 MB | <https://3dwarehouse.sketchup.com/model/2662f091-5a5e-4e3a-a416-36538be3cbbd> |
| Frasier Crane's Floor Lamp | `floor_lamp.glb` | stojací lampa | 0,2 MB | <https://3dwarehouse.sketchup.com/model/64fd6a4d-da85-466a-939c-d43267791cea> |
| Frasier Crane's Display Pedestal | `pedestal.glb` | podstavec s bustou | 1,5 MB | <https://3dwarehouse.sketchup.com/model/46d1189c-0662-4363-b7f5-b8f8eeb4eb0f> |
| Frasier Crane's Large Abstract Painting | `painting_large.glb` | obraz za klavírem | 0,5 MB | <https://3dwarehouse.sketchup.com/model/f00b9fc9-68c7-4323-b19e-34a36a3c4f87> |
| Frasier Crane's Red & Blue Vase Painting | `painting_vase.glb` | obraz v předsíni | 0,2 MB | <https://3dwarehouse.sketchup.com/model/3e617b64-6a90-4afb-a44f-031cd51741b1> |
| Martin Crane's Side Table | `martin_table.glb` | stolek u Martinova křesla | 1,0 MB | <https://3dwarehouse.sketchup.com/model/bc4e9602-8a2a-456c-9724-11a910d6ce0c> |

### Priorita B – věci, které v bytě zatím chybí

| Model | Soubor | Kam | Velikost | Odkaz |
| --- | --- | --- | --- | --- |
| Dr. Frasier Crane's Fireplace | `fireplace.glb` | krb (velký soubor, zmenším) | 12,6 MB | <https://3dwarehouse.sketchup.com/model/995b513b-7e52-45f0-a519-6e0becc3356c> |
| Frasier Crane's Andirons | `andirons.glb` | kozlíky do krbu | 0,2 MB | <https://3dwarehouse.sketchup.com/model/e4710eba-c266-4572-b9c1-34d4c466adab> |
| Frasier Crane's Refrigerator | `fridge.glb` | lednice v kuchyni | 0,7 MB | <https://3dwarehouse.sketchup.com/model/0dafdbb0-1e4f-427e-a93a-2b50b345fe65> |
| Frasier Crane's Apartment Front Door | `front_door.glb` | vstupní dveře | 0,6 MB | <https://3dwarehouse.sketchup.com/model/72b18621-45ce-49cd-8112-ddfd1279a9d2> |
| Frasier Crane's Side Table | `side_table.glb` | stolek u pohovky | 0,7 MB | <https://3dwarehouse.sketchup.com/model/98f90f5f-2ed9-41ac-b22f-6dfc968eee09> |
| Frasier Crane's Three Drawer Table | `drawer_table.glb` | komoda / předsíň | 0,2 MB | <https://3dwarehouse.sketchup.com/model/9892ba7a-96c8-4093-be5f-c7ff97a64d62> |
| Frasier Crane's Corbu Table Lamp | `corbu_lamp.glb` | stolní lampa | 0,4 MB | <https://3dwarehouse.sketchup.com/model/14e5f1c3-855e-48a7-917f-91199417def9> |
| Knoll Wassily Chair Black | `wassily.glb` | křeslo (ve scénách u okna) | 2,0 MB | <https://3dwarehouse.sketchup.com/model/a447cec8-d1d6-4cdf-9d5d-d702d23bc403> |
| Frasier Crane's Framed Art | `art1.glb` | obraz | 1,3 MB | <https://3dwarehouse.sketchup.com/model/4fdbbcfd-a11a-4885-8f86-2b007a3bdb21> |
| Frasier Crane's Framed Art 2 | `art2.glb` | obraz | 0,7 MB | <https://3dwarehouse.sketchup.com/model/33c2dae5-22bd-470c-a8e7-fe13b53daf5a> |
| Rauschenberg ACE NOVEMBR VENICE USA poster | `poster.glb` | plakát | 0,8 MB | <https://3dwarehouse.sketchup.com/model/f660abee-71fb-481f-ae70-ce88cf15408a> |
| "Elegy in Green" | `elegy.glb` | obraz | 1,9 MB | <https://3dwarehouse.sketchup.com/model/c03e34bb-8c13-40ea-91a6-33d1cef1b759> |
| Black Vase Frasier | `black_vase.glb` | váza | 2,1 MB | <https://3dwarehouse.sketchup.com/model/a6492094-3e24-4164-930e-29c37baf765f> |

Martinovo křeslo ani klavír ve 3D Warehouse nejsou – zůstanou procedurální.

Nestaženo zatím: **Frasier Crane's Floor Lamp** (lampa je procedurální), **Large Abstract Painting**
(místo něj visí za klavírem Charles Cleeton), **Framed Art 2**, **Side Table**, **Wassily Chair**.
Vstupní dveře (`front_door.glb`) jsou převedené, ale zatím nezapojené (dveře se otvírají přes vlastní křídlo).
Licence 3D Warehouse dovoluje modely použít v projektu, **nedovoluje šířit model samostatně** – veřejný web s nimi raději ne.

## 2. CGTrader – Sit Com Set (6 USD) – nedoporučuji

[CGTrader](https://www.cgtrader.com/3d-print-models/games-toys/board-games/sit-com-set): STL (41 MB) + FBX (41 MB), **33 dílů**, šest velkých sekcí stěn/podlahy a 60+ kusů nábytku, **miniatura v měřítku 28 mm (jednotky mm)**, bez textur, licence **„Editorial License (no AI)“**.

* Díly jsou pro 3D tisk – nábytek bývá seskupený po několika kusech v jednom dílu, často spojený s podložkou. Kusy by se v Blenderu oddělily, zvětšily (~60×), opravily, rozbalilo UV a otexturovalo.
* Skoro všechno podstatné je dnes zdarma ve 3D Warehouse ve vyšší kvalitě. Smysl by dával jen kvůli Martinovu křeslu a klavíru.
* Pokud ho přesto koupíš: s Blenderem ve WSL to zvládnu – skriptem v režimu bez GUI (`blender -b -P skript.py`) importuji FBX, rozdělím díly, zkontroluji je na náhledech a vyexportuji GLB.

## 3. Fotografie výhledu – Wikimedia Commons (licence ověřené přes API)

> **Stav:** ve dne se používá *June 2022* (`public/skybox_day.jpg`), v noci *evening of 2014-10-19 no. 09*
> (`public/skybox_night.jpg`); autoři jsou uvedeni v úvodním panelu a v README.

| Soubor | Rozměr | Licence | K čemu |
| --- | --- | --- | --- |
| [Space Needle 360 Panorama.jpg](https://commons.wikimedia.org/wiki/File:Space_Needle_360_Panorama.jpg) | 9889 × 1200 | CC BY-SA 3.0 (A. Hornung) | **360° pás kolem dokola** – výhled ze všech oken (bez Space Needle, je focené z ní) |
| [Seattle skyline panorama from Kerry Park, June 2022.jpg](https://commons.wikimedia.org/wiki/File:Seattle_skyline_panorama_from_Kerry_Park,_June_2022.jpg) | 13516 × 2221 | CC BY-SA 4.0 (SounderBruce) | náhrada `skybox.jpg` za balkonem s jasnou licencí |
| [Seattle skyline panorama from Kerry Park, August 2022.jpg](https://commons.wikimedia.org/wiki/File:Seattle_skyline_panorama_from_Kerry_Park,_August_2022.jpg) | 9521 × 2202 | CC BY-SA 4.0 (SounderBruce) | totéž, jiné světlo |
| [Seattle skyline from Kerry Park, evening of 2014-10-19 no. 09.jpg](https://commons.wikimedia.org/wiki/File:Seattle_skyline_from_Kerry_Park,_evening_of_2014-10-19_no._09.jpg) | 5096 × 3395 | CC BY-SA 2.0 (ragesoss) | **skutečná noční fotka** místo dopočítané |
| [Seattle skyline at night (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Seattle_skyline_at_night_(Unsplash).jpg) | 3274 × 1842 | CC0 | noc bez povinnosti uvádět autora |
| [Seattle skyline and Mount Rainier from Kerry Park, 1992](https://commons.wikimedia.org/wiki/File:Seattle_skyline_and_Mount_Rainier_from_Kerry_Park,_1992_(51719842636).jpg) | 3672 × 3657 | CC BY 2.0 (Seattle Municipal Archives) | dobová fotka z doby seriálu (čtvercový formát) |

CC BY / BY-SA = uvést autora a licenci (doplním do titulků / README). Ulož do kořene projektu, třeba `vyhled_360.jpg`, `vyhled_den.jpg`, `vyhled_noc.jpg`.

## 4. Blender ve WSL (Ubuntu 24.04)

Z apt (ověřeno simulací, 80 balíčků, ~124 MB ke stažení):

```bash
sudo apt update
sudo apt install -y blender=4.0.2+dfsg-1ubuntu8 blender-data=4.0.2+dfsg-1ubuntu8
blender --version   # Blender 4.0.2
```

Obsahuje import/export **glTF/GLB, FBX, STL, OBJ** – na všechno výše stačí. **Neobsahuje Collada (.dae)** (ubuntí sestavení je bez OpenCOLLADA); není potřeba, 3D Warehouse dává GLB.

Alternativa bez sudo s plnou výbavou (i Collada) – oficiální Blender 4.5 LTS:

```bash
cd ~ && wget https://download.blender.org/release/Blender4.5/blender-4.5.15-linux-x64.tar.xz
tar xf blender-4.5.15-linux-x64.tar.xz && ~/blender-4.5.15-linux-x64/blender --version
```

Systémové knihovny, které oficiální Blender potřebuje (libxi6, libxxf86vm1, libxfixes3, libxrender1, libgl1, libegl1, libxkbcommon0, libsm6), už v tvém WSL nainstalované jsou.

## Nedoporučuji / nejde
* **Sitcoms3D** – jen data pro výzkum (snímky ze seriálu, mračno bodů), bez meshů a bez uvedené licence.
* **Unreal Engine rekonstrukce z Redditu** – není ke stažení.
* **Znělka seriálu / KACL** – chráněno autorským právem.
