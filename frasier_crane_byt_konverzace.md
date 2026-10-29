# Konverzace: 3D model a textury bytu Frasiera Cranea

**Téma:** Frasier Crane, Elliott Bay Towers, fotorealistická 3D rekonstrukce, Blender, Three.js  
**Datum exportu:** 29. 10. 2026  
**Formát:** Markdown (`.md`)

> Přepis relevantní části konverzace. Původní interaktivně zobrazené obrázky nejsou vloženy do souboru; zachovány jsou texty, odkazy a jejich kontext. Automatické interní citační značky byly při exportu vynechány; uvedeny jsou přímé odkazy na zmíněné zdroje.

---

## 1. Dotaz: Model a textury Frasierova apartmánu

**Uživatel:**

> najdi mne model + textury apartmana frasiera cranea (sitcom 1993), jedna se o byt v elliot bay towers

**Asistent:**

Prohledám dostupné 3D modely Frasierova bytu, včetně komunitních projektů a modelů pro Blender, SketchUp nebo herní enginy. Zaměřím se na to, jestli obsahují i textury a dají se převést pro Three.js.

Našel jsem několik konkrétních 3D rekonstrukcí bytu Frasiera Cranea ze seriálu **Frasier** (1993–2004), tedy apartmánu č. 1901 ve fiktivní budově Elliott Bay Towers v Seattlu.

**Důležité:** Zatím jsem nenašel hotový kompletní model ve formátu `.glb` nebo `.fbx` s ověřenými texturami. Existují ale modely geometrie, vědecká 3D rekonstrukce a velmi dobré reference pro vytvoření texturované scény.

### 1.1 Sit Com Set – skutečný 3D model bytu

**[Sit Com Set – Cults3D](https://cults3d.com/en/3d-model/architecture/sit-com-set)**

- Orientační cena v době hledání: přibližně 6 USD.
- Formát: STL.
- Obsah: šest částí konstrukce bytu a více než 60 modelů vybavení, včetně pohovky, klavíru, krbu, kuchyně, sloupu a dalších dekorací.

Je to nejkonkrétnější nalezený balíček skutečných 3D objektů. Nevýhodou je, že jde o **model pro 3D tisk**, nikoli hotovou vizualizační scénu. STL obvykle neobsahuje textury ani UV mapování. Pro Three.js by bylo potřeba doplnit materiály a převést model do GLB.

### 1.2 Sitcoms3D – bezplatná výzkumná rekonstrukce

**[Sitcoms3D – GitHub](https://github.com/ethanweber/sitcoms3D)**

- Zdarma.
- Data pro NeRF, COLMAP a další 3D rekonstrukční postupy.
- Dataset zahrnuje `Frasier-apartment`.
- Obsahuje obrázky, polohy kamer a prostorová data, ale nikoli hotovou klasickou texturovanou 3D scénu.

Pro technický projekt je zajímavý především tím, že z těchto podkladů lze vytvářet nebo dále rekonstruovat trojrozměrný prostor.

### 1.3 CGTrader – varianta modelu ve FBX

**[Sit Com Set – CGTrader](https://www.cgtrader.com/3d-print-models/games-toys/board-games/sit-com-set)**

- Orientační cena v době hledání: přibližně 6 USD.
- Formáty: FBX + STL.
- Stejný model jako na Cults3D, ale autor výslovně potvrzuje FBX verze všech součástí.
- Celková velikost FBX souborů je přibližně 41 MB.
- Textury nejsou potvrzené.

Pro Blender a Three.js bych preferoval tuto variantu.

### 1.4 Samostatné modely skutečného vybavení bytu

V knihovně 3D Warehouse se nachází několik specifických předmětů z původního seriálu. Jsou dostupné jako modely SketchUp a obsahují materiály.

- [Eames Lounge Chair + Ottoman](https://embed-3dwarehouse-classic.sketchup.com/model/23a1c8c6-44af-4399-8900-866827f6e90d/Frasier-Cranes-Eames-Lounge-Chair-Ottoman) – ikonické křeslo a podnožka.
- [Frasierova stojací lampa](https://embed-3dwarehouse-classic.sketchup.com/model/64fd6a4d-da85-466a-939c-d43267791cea/Frasier-Cranes-Floor-Lamp) – mosazná lampa.
- [Velký abstraktní obraz](https://embed-3dwarehouse-classic.sketchup.com/model/f00b9fc9-68c7-4323-b19e-34a36a3c4f87/Frasier-Cranes-Large-Abstract-Painting) – obraz za klavírem.
- [Obraz s červenomodrou vázou](https://embed-3dwarehouse-classic.sketchup.com/model/3e617b64-6a90-4afb-a44f-031cd51741b1/Frasier-Cranes-Red-Blue-Vase-Painting) – další obraz ze seriálu.

### 1.5 Detailní rekonstrukce v Unreal Engine 5

**[Frasier's Apartment in Unreal Engine – Reddit](https://www.reddit.com/r/Frasier/comments/1pmlbes/i_created_frasiers_apartment_in_unreal_engine/)**

Autor Strid3r21 vytvořil interaktivní rekonstrukci obývacího pokoje. Projekt zahrnuje ručně modelované vybavení, ale podle zveřejněných informací zatím není dostupný ke stažení. Autor připouštěl možnost budoucího bezplatného sdílení.

### 1.6 Půdorys pro přesné rozmístění objektů

**[Půdorys Frasierova bytu – Iñaki Aliste Lizarralde](https://pixels.com/featured/the-apartment-from-frasier-inaki-aliste-lizarralde.html)**

Půdorys zachycuje uspořádání místností i nábytku. Jako předloha pro rekonstrukci v Blenderu je velmi užitečný.

### 1.7 Doporučení pro Three.js

**Nejlepší aktuálně dostupný základ je CGTrader FBX model**, následně doplněný o jednotlivé detailnější předměty z 3D Warehouse.

Postup by byl: import FBX do Blenderu, úprava geometrie a měřítka, doplnění UV a PBR textur (dřevěná podlaha, koberec, čalounění, krb), vytvoření panoramatu Seattlu za okny a export do `.glb`.

**Asistent – doplňující otázka:**

> Chceš spíše **fotorealistický byt s texturami, kterým lze procházet ve Three.js**, nebo ti stačí jednodušší low-poly model celého bytu? Podle toho se dost liší, které z nalezených podkladů mají největší smysl.

---

## 2. Upřesnění: Fotorealistická procházka ve Three.js

**Uživatel:**

> fotorealistický byt s texturami, kterým lze procházet ve Three.js

**Asistent:**

Pro fotorealistickou procházku v Three.js je klíčové sehnat nejen geometrii, ale i materiály, textury a správné rozmístění vybavení. Ověřím, které rekonstrukce bytu lze skutečně získat, a navrhnu nejrychlejší cestu k použitelné `.glb` scéně.

Pro **fotorealistickou 3D procházku Frasierovým bytem v Elliott Bay Towers** bych zvolil kombinaci existujícího modelu, detailnějšího nábytku a vlastních PBR textur.

Po ověření dostupných zdrojů jsem nenašel kompletní fotorealistickou scénu připravenou přímo pro Three.js. Našel jsem ale použitelný základ, díky kterému není nutné modelovat celý byt od nuly.

### 2.1 Nejlepší nalezený základ

**[Sit Com Set – CGTrader](https://www.cgtrader.com/3d-print-models/games-toys/board-games/sit-com-set)**

- Placený model.
- FBX + STL.
- Šest stavebních částí a více než 60 modelů vybavení.
- Autor potvrdil FBX verze všech součástí.

Výhoda je, že už obsahuje charakteristické prvky Frasierova bytu: krb, sloup s knihovnou, klavír, kuchyni a nábytek.

**Nevýhoda:** Jde primárně o miniaturu pro 3D tisk. Materiály a fotorealistické textury nejsou doložené. Model bude potřebovat úpravy v Blenderu a texturování. Samotné zakoupení tedy ještě neznamená hotový fotorealistický byt.

### 2.2 Kde získat fotorealistické textury a nábytek

**[Dřevěná podlaha – Poly Haven: Diagonal Parquet](https://polyhaven.com/a/diagonal_parquet)**

- Zdarma, CC0.
- Barevná textura, normal mapa a roughness.
- Vhodné pro obývací část bytu.

**[Čalounění – Poly Haven: Fabric Pattern 05](https://polyhaven.com/a/fabric_pattern_05)**

- Zdarma, CC0.
- Vzorovaná tkanina pro křesla a pohovky.
- Pro přesnou napodobeninu Martinova křesla bude potřeba upravit barvy a vzor.

**[Eames Lounge Chair + Ottoman – 3D Warehouse](https://embed-3dwarehouse-classic.sketchup.com/model/23a1c8c6-44af-4399-8900-866827f6e90d/Frasier-Cranes-Eames-Lounge-Chair-Ottoman)**

- Model má přibližně 8 610 polygonů a 11 materiálů.
- Pro detailní záběr vhodnější než jednoduchá 3D miniatura.

Další modely ze seriálu:

- [Stojací lampa](https://embed-3dwarehouse-classic.sketchup.com/model/64fd6a4d-da85-466a-939c-d43267791cea/Frasier-Cranes-Floor-Lamp)
- [Abstraktní obraz za klavírem](https://embed-3dwarehouse-classic.sketchup.com/model/f00b9fc9-68c7-4323-b19e-34a36a3c4f87/Frasier-Cranes-Large-Abstract-Painting)
- [Obraz s červenomodrou vázou](https://embed-3dwarehouse-classic.sketchup.com/model/3e617b64-6a90-4afb-a44f-031cd51741b1/Frasier-Cranes-Red-Blue-Vase-Painting)

Další zdroje materiálů:

- [ambientCG](https://ambientcg.com/)
- [Poly Haven](https://polyhaven.com/)

Oba poskytují bezplatné PBR materiály s licencí CC0.

### 2.3 Jak z toho udělat skutečnou 3D procházku

1. **Blender:** Importovat FBX, převést scénu do skutečných rozměrů, opravit geometrii a doplnit chybějící stěny a strop.
2. **Materiály:** Doplnit 2K–4K PBR textury podlahy, zdí, látkových potahů, kůže a nábytku.
3. **Osvětlení:** Využít světlo z velkých oken, realistické stíny a předpočítané nepřímé osvětlení.
4. **Export:** Vytvořit optimalizovanou scénu `frasier-apartment.glb` včetně materiálů.
5. **Three.js:** Načíst model přes `GLTFLoader`, vytvořit pohyb pomocí `PointerLockControls` a doplnit kolize se stěnami a nábytkem.

Výsledná procházka by mohla mít pohyb WASD, ovládání myší, otevírání dveří, možnost přechodu na balkon a přepínání denního a nočního osvětlení.

**Důležitý detail:** Protože původní byt byl televizní kulisou, některé části, zejména čtvrtou stěnu a strop, bude nutné architektonicky domyslet. Také výhled na Seattle je specifická kulisa původního seriálu.

### 2.4 Alternativa s nejlepším vizuálem

**[Fotorealistická rekonstrukce v Unreal Engine 5 – Reddit](https://www.reddit.com/r/Frasier/comments/1pmlbes/i_created_frasiers_apartment_in_unreal_engine/)**

Tento fanouškovský projekt je vizuálně nejzajímavější nalezená alternativa. Autor ale zatím nezveřejnil soubory ke stažení a jeho rekonstrukce stále vyžaduje dokončení.

### 2.5 Konečné doporučení

Pokud chceš vybudovat celý byt ve Three.js, začal bych zakoupením FBX geometrie z CGTrader a následným nahrazením nejvýraznějších kusů nábytku detailnějšími modely. Pouhé přidání textur na model určený pro 3D tisk nebude na skutečný fotorealismus stačit.

Jakmile budeš mít původní FBX soubory, můžeme z nich připravit konkrétní scénu pro Three.js včetně materiálů, osvětlení, procházení a kolizí.

---

## 3. Žádost o export

**Uživatel:**

> udělej mně výstup naší konverzace do md souboru pro stáhnutí

---

## Přehled nejdůležitějších odkazů

| Zdroj | Účel | Odkaz |
| --- | --- | --- |
| CGTrader – Sit Com Set | Geometrie, FBX + STL | [Otevřít](https://www.cgtrader.com/3d-print-models/games-toys/board-games/sit-com-set) |
| Cults3D – Sit Com Set | Geometrie, STL | [Otevřít](https://cults3d.com/en/3d-model/architecture/sit-com-set) |
| Sitcoms3D | Rekonstrukční dataset | [GitHub](https://github.com/ethanweber/sitcoms3D) |
| 3D Warehouse – Eames | Detailní křeslo | [Otevřít](https://embed-3dwarehouse-classic.sketchup.com/model/23a1c8c6-44af-4399-8900-866827f6e90d/Frasier-Cranes-Eames-Lounge-Chair-Ottoman) |
| Poly Haven – podlaha | PBR materiál | [Otevřít](https://polyhaven.com/a/diagonal_parquet) |
| Poly Haven – látka | PBR materiál | [Otevřít](https://polyhaven.com/a/fabric_pattern_05) |
| ambientCG | PBR materiály | [Otevřít](https://ambientcg.com/) |
| Půdorys | Rozvržení místností | [Otevřít](https://pixels.com/featured/the-apartment-from-frasier-inaki-aliste-lizarralde.html) |
| Unreal Engine rekonstrukce | Inspirace | [Reddit](https://www.reddit.com/r/Frasier/comments/1pmlbes/i_created_frasiers_apartment_in_unreal_engine/) |

> **Poznámka:** Dostupnost, ceny, licenční podmínky a obsah balíčků se mohou změnit. U zakoupených nebo stažených 3D modelů je nutné před publikováním výsledné aplikace zkontrolovat podmínky dalšího použití.
