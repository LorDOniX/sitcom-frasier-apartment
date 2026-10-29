# Elliott Bay Towers, apt. 1901 – procházka bytem Frasiera Cranea

WebGL procházka bytem ze sitcomu *Frasier* (1993–2004). Vite + TypeScript + three.js.
Geometrie bytu je vytažená přímo z půdorysu `pudorys.jpg` (Iñaki Aliste Lizarralde, 1 : 100), takže rozměry i rozmístění místností odpovídají kresbě.

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produkční build do dist/
```

## Ovládání

| Klávesa | Akce |
| --- | --- |
| `W` `A` `S` `D` / šipky | chůze |
| myš | rozhlížení (po kliknutí se zamkne kurzor) |
| `Shift` | rychlejší chůze |
| `E` | otevřít / zavřít dveře, na které míří zaměřovač (i posuvné dveře na balkon) |
| `M` | minimapa |
| `P` | podlaha: materiály / barevný půdorys |
| `N` | den / noc |
| `C` | vypnout kolize (létání skrz stěny pro ladění) |
| `Esc` | pauza |

## Jak to funguje

```
pudorys.jpg ──► tools/trace_walls.py ──► src/data/walls.json      (polygony stěn)
                     ▲                    public/floor_mask.png    (tvar podlahy a stropu)
tools/plan_edits.json┘                    public/rooms.png         (mapa místností pro HUD)
                                          public/floors/*.png      (masky materiálů podlah)
src/data/openings.json  (dveře, okna, balkon, místnosti + jejich podlaha – ručně zadané v px půdorysu)
src/data/furniture.json (zástupný nábytek a světla)
public/textures/        (PBR textury CC0 – viz public/textures/README.md)
public/skybox.jpg       (fotografie výhledu, kopie ./skybox.jpg)
```

* **Stěny**: prahování černé barvy → morfologické otevření → ruční úpravy (`tools/plan_edits.json`: smazat text/nábytek, dokreslit chybějící zdi) → trasování obrysu → zjednodušení a srovnání hran na násobky 45° → `ExtrudeGeometry` do výšky 2,75 m.
* **Měřítko**: 0,027 m/px (≈ 37 px na metr), odhadnuto z šířky dveří a postelí. Mění se v `src/config.ts`.
* **Dveře**: v `openings.json` je pant (`hinge`), volný konec křídla (`tip`) a bod, kam se otvírají (`open`). Nadpraží se generuje automaticky.
* **Kolize**: hráč je kruh o poloměru 22 cm, úsečky stěn / oken / nábytku jsou v prostorové mřížce, dveře se přidávají dynamicky podle aktuálního natočení.
* **Podlahy**: každá místnost má v `openings.json` materiál (`wood`, `carpet`, `tile`, `stone`, `corridor`). Generátor z mapy místností vyrobí nepřekrývající se masky a každý materiál je jedna rovina s `alphaMap`. Dělicí čára `room_dividers` určuje hranici dlažby a parket mezi kuchyní a jídelnou.
* **Výhled**: `src/world/skyline.ts` – fotografie na výseči válce (110°) se středem za balkonem, dole prodloužená a po stranách prolnutá s procedurálním pozadím, jehož obloha je navzorkovaná z okrajů fotky. Noční verze se počítá z fotky (obloha → noc, budovy ztmavnou, rozsvítí se okna, Space Needle svítí). Polohu horizontu a záběr lze doladit konstantami na začátku souboru.
* **Světlo**: odpolední slunce se stínovou mapou (4096², stíny vrhají stěny, strop, dveře i nábytek) – do bytu svítí jen okny; výplň dělá polokulové světlo a `RoomEnvironment` pro odlesky. V noci svítí stropní svítidla.
* **Kontrola dat**: `npm run trace` přegeneruje data a uloží `tools/out/walls_overlay.png` – půdorys s vykreslenými stěnami (červeně), dveřmi (zeleně), okny (modře) a zábradlím. Po každé úpravě JSONů se vyplatí ho otevřít.

Nástroj potřebuje jen Python 3 + Pillow.

## Struktura

```
src/
  main.ts           scéna, smyčka, UI, klávesy
  config.ts         měřítko, výšky, rychlosti, start
  plan.ts           převod px půdorysu <-> metry
  player.ts         pohyb první osobou (PointerLockControls)
  collision.ts      kolize kruh × úsečky
  minimap.ts, rooms.ts
  world/walls.ts, openings.ts, furniture.ts, floor.ts, skyline.ts, materials.ts
  data/*.json
tools/trace_walls.py, plan_edits.json
```

Další postup, přehled zdrojů a fází viz [PLAN.md](PLAN.md).
