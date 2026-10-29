# Co si stáhnout nebo koupit sám

Všechno, co šlo stáhnout zdarma a bez přihlášení (CC0), už v projektu je – viz `public/textures/README.md` a `public/models/README.md`.
Níže jsou věci, které vyžadují **účet, platbu nebo tvé rozhodnutí o licenci**. Žádná z nich není nutná – byt funguje i bez nich; jde o věrnější podobu se seriálem.

## 1. Zdarma, ale s přihlášením – doporučuji

### 3D Warehouse: kusy přímo z Frasierova bytu
Potřebuješ bezplatný účet Trimble ID. U každého modelu *Download* → nejlépe **Collada (.dae)** nebo **SketchUp (.skp)**.

| Model | Odkaz | Nahradí v bytě |
| --- | --- | --- |
| Eames Lounge Chair + Ottoman | [3D Warehouse](https://3dwarehouse.sketchup.com/model/23a1c8c6-44af-4399-8900-866827f6e90d/Frasier-Cranes-Eames-Lounge-Chair-Ottoman) | `Křeslo Eames`, `Podnožka Eames` (teď mid-century křeslo z Poly Haven) |
| Frasierova stojací lampa | [3D Warehouse](https://3dwarehouse.sketchup.com/model/64fd6a4d-da85-466a-939c-d43267791cea/Frasier-Cranes-Floor-Lamp) | `Stojací lampa` (teď procedurální) |
| Velký abstraktní obraz | [3D Warehouse](https://3dwarehouse.sketchup.com/model/f00b9fc9-68c7-4323-b19e-34a36a3c4f87/Frasier-Cranes-Large-Abstract-Painting) | obraz za klavírem (teď procedurální malba) |
| Obraz s červenomodrou vázou | [3D Warehouse](https://3dwarehouse.sketchup.com/model/3e617b64-6a90-4afb-a44f-031cd51741b1/Frasier-Cranes-Red-Blue-Vase-Painting) | obraz v předsíni (teď procedurální zátiší) |

**Převod do GLB (Blender, zdarma):**
1. `.dae`: *File → Import → Collada*. `.skp`: doinstaluj add-on „SketchUp Importer“, nebo model otevři v SketchUp Free a exportuj jako `.dae`.
2. Zkontroluj měřítko (Eames ≈ 0,84 m široký, ~0,85 m vysoký) a že přední strana míří na **-Y v Blenderu** (= +Z v three.js).
3. *File → Export → glTF 2.0*, formát **glTF Binary (.glb)**, zaškrtni *Apply Modifiers*, komprese volitelně.
4. Ulož do `public/models/custom/` (např. `eames.glb`).

**Zapojení do bytu** – v `src/data/furniture.json` u příslušné položky vyměň `model`:

```json
{ "name": "Křeslo Eames", "model": "/models/custom/eames.glb", "pos": [824, 852], "size": [0.85, 0.9], "rot": 135 }
```

* `"scale": 1.1` – zvětšení, `"fit": "box"` + `"h"` – natáhne model přesně na `size × h`,
* `"modelRot": 180` – když model po načtení kouká na opačnou stranu.

**Obrazy** stačí jako obrázek (bez 3D): vyřízni z modelu nebo z fotky samotné plátno, ulož do `public/paintings/` a v `furniture.json` → `paintings` přidej `"image": "/paintings/abstrakt.jpg"` (poměr stran nastav přes `w` a `h`).

Licence 3D Warehouse dovoluje modely použít v projektu, **nedovoluje šířit model samostatně** – při zveřejnění buildu na webu je GLB fakticky stažitelný, takže pro veřejnou verzi raději jen soukromě.

## 2. Placené – jen pokud chceš pracovat v Blenderu

### CGTrader – Sit Com Set (~6 USD)
[CGTrader](https://www.cgtrader.com/3d-print-models/games-toys/board-games/sit-com-set) – kup **verzi s FBX** (ne Cults3D, tam je jen STL).

* Obsahuje tvary charakteristického nábytku z bytu (pohovka, krb, sloup, klavír, kuchyň, 60+ kusů).
* Je to model pro **3D tisk**: bez textur, bez UV, často spojené kusy. Každý kus je potřeba v Blenderu oddělit, srovnat měřítko, rozbalit UV, dát materiály (textury už v projektu jsou) a exportovat do GLB → zapojení stejně jako výše.
* Upřímně: procedurální pohovka, Martinovo křeslo a klavír v projektu už vypadají podobně. Koupi bych zvážil, jen pokud tě baví modelovat, nebo chceš přesné tvary (krb, sloupy, Frasierův bar).

## 3. Fotografie výhledu

* **Licence současné fotky `skybox.jpg`** – nevím, odkud je. Pro soukromou procházku v pořádku, pro zveřejnění zjisti autora / licenci, nebo ji nahraď fotkou s licencí CC0 / CC-BY (Wikimedia Commons – hledej „Seattle skyline Kerry Park“, Flickr s filtrem licence).
* **Výhled do dalších směrů** (okna obýváku, ložnic, kuchyně teď koukají na kreslené pozadí): ideální je **sférické panorama 360°** (equirektangulární JPG, poměr 2 : 1, aspoň 6000 × 3000) pořízené z výšky nad Seattlem – Wikimedia Commons / Flickr („Seattle 360 panorama“). Stačí ho uložit jako `public/panorama.jpg` a dej vědět, zapojím ho.
* Noční fotka stejného pohledu by nahradila dopočítanou noční verzi.

## 4. Nástroje (zdarma)

| Nástroj | K čemu |
| --- | --- |
| [Blender](https://www.blender.org/) | převod `.dae/.skp/.fbx` → `.glb`, úpravy modelů, později lightmapy |
| [gltf-transform](https://gltf-transform.dev/) (`npx @gltf-transform/cli optimize in.glb out.glb`) | zmenšení modelů (Draco/Meshopt, KTX2) před nasazením |
| [SketchUp Free](https://app.sketchup.com/) | otevření `.skp` z 3D Warehouse a export do `.dae` |

## Nedoporučuji / nejde
* **Sitcoms3D** – jen data pro výzkum (snímky ze seriálu, mračno bodů), bez meshů a bez uvedené licence.
* **Unreal Engine rekonstrukce z Redditu** – není ke stažení; případně napsat autorovi (u/Strid3r21).
* **Znělka seriálu / KACL** – chráněno autorským právem, pro zvuky použít vlastní nebo CC0 nahrávky.
