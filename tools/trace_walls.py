#!/usr/bin/env python3
"""Vytáhne stěny z půdorysu (pudorys.jpg) jako polygony v pixelových souřadnicích.

Postup:
  1. prahování tmavých pixelů (stěny jsou v půdorysu černé),
  2. morfologické otevření (odstraní tenké čáry, text, šrafy),
  3. zahození malých komponent a ruční úpravy z tools/plan_edits.json
     (mazání nábytku/textu, dokreslení chybějících stěn),
  4. trasování hranic (crack following) + zjednodušení Douglas-Peucker,
  5. zápis do src/data/walls.json + kontrolní obrázky do tools/out/.

Závislost: pouze Pillow.  Spuštění: npm run trace
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'pudorys.jpg')
EDITS = os.path.join(ROOT, 'tools', 'plan_edits.json')
OPENINGS = os.path.join(ROOT, 'src', 'data', 'openings.json')
OUT_JSON = os.path.join(ROOT, 'src', 'data', 'walls.json')
OUT_FLOOR = os.path.join(ROOT, 'public', 'floor_mask.png')
OUT_ROOMS = os.path.join(ROOT, 'public', 'rooms.png')
OUT_DIR = os.path.join(ROOT, 'tools', 'out')

THRESHOLD = 80      # jas < THRESHOLD => stěna
OPEN_KERNEL = 3     # velikost okna pro otevření
MIN_AREA = 300      # menší komponenty se zahodí (nábytek, šum)
DP_EPS = 1.3        # tolerance zjednodušení v px
MIN_HOLE = 200      # menší díry ve stěnách se zaplní


def load_mask(edits):
    im = Image.open(SRC).convert('L')
    m = im.point(lambda v: 255 if v < THRESHOLD else 0)
    m = m.filter(ImageFilter.MinFilter(OPEN_KERNEL)).filter(ImageFilter.MaxFilter(OPEN_KERNEL))
    m = drop_small(m, MIN_AREA)
    d = ImageDraw.Draw(m)
    for r in edits.get('erase_rects', []):
        d.rectangle(r[:4], fill=0)
    for p in edits.get('erase_polys', []):
        d.polygon([tuple(pt) for pt in p], fill=0)
    for ln in edits.get('add_lines', []):
        x1, y1, x2, y2, w = ln
        d.line([(x1, y1), (x2, y2)], fill=255, width=int(w))
    for p in edits.get('add_polys', []):
        d.polygon([tuple(pt) for pt in p], fill=255)
    for c in edits.get('add_circles', []):
        x, y, r = c
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return m


def drop_small(m, min_area):
    W, H = m.size
    px = m.load()
    seen = bytearray(W * H)
    out = Image.new('L', m.size, 0)
    opx = out.load()
    for y in range(H):
        for x in range(W):
            if seen[y * W + x] or px[x, y] < 128:
                continue
            st = [(x, y)]
            seen[y * W + x] = 1
            comp = []
            while st:
                cx, cy = st.pop()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and px[nx, ny] >= 128:
                        seen[ny * W + nx] = 1
                        st.append((nx, ny))
            if len(comp) >= min_area:
                for cx, cy in comp:
                    opx[cx, cy] = 255
    return out


def trace_loops(m):
    """Hranice mezi pixely stěny a okolím jako uzavřené smyčky (rohy pixelů).

    Hrany jsou orientované tak, aby stěna ležela vpravo (v obrazových souřadnicích
    s osou y dolů). Vnější obrysy pak mají kladnou plochu, díry zápornou.
    """
    W, H = m.size
    px = m.load()

    def fg(x, y):
        return 0 <= x < W and 0 <= y < H and px[x, y] >= 128

    nxt = {}
    for y in range(H):
        for x in range(W):
            if not fg(x, y):
                continue
            if not fg(x, y - 1):
                nxt.setdefault((x, y), []).append((x + 1, y))
            if not fg(x + 1, y):
                nxt.setdefault((x + 1, y), []).append((x + 1, y + 1))
            if not fg(x, y + 1):
                nxt.setdefault((x + 1, y + 1), []).append((x, y + 1))
            if not fg(x - 1, y):
                nxt.setdefault((x, y + 1), []).append((x, y))

    loops = []
    while nxt:
        start = next(iter(nxt))
        loop = [start]
        prev = start
        cur = pop_edge(nxt, start, None)
        while cur != start:
            loop.append(cur)
            nc = pop_edge(nxt, cur, (cur[0] - prev[0], cur[1] - prev[1]))
            prev, cur = cur, nc
        loops.append(loop)
    return loops


def pop_edge(nxt, v, d):
    cands = nxt[v]
    if len(cands) > 1 and d is not None:
        # v bodě dotyku dvou úhlopříčných pixelů zahni doprava => 4-souvislost
        right = (-d[1], d[0])
        pick = None
        for c in cands:
            if (c[0] - v[0], c[1] - v[1]) == right:
                pick = c
        if pick is None:
            pick = cands[0]
        cands.remove(pick)
    else:
        pick = cands.pop()
    if not cands:
        del nxt[v]
    return pick


def area(poly):
    s = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        s += x1 * y2 - x2 * y1
    return s / 2


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        ln = (dx * dx + dy * dy) ** 0.5 or 1e-9
        best, bi = -1, -1
        for i in range(a + 1, b):
            x, y = pts[i]
            dist = abs(dy * (x - ax) - dx * (y - ay)) / ln
            if dist > best:
                best, bi = dist, i
        if best > eps:
            keep[bi] = True
            st.append((a, bi))
            st.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def simplify_loop(loop, eps):
    # rozděl smyčku ve dvou nejvzdálenějších bodech a zjednoduš obě poloviny
    p0 = loop[0]
    far = max(range(len(loop)), key=lambda i: (loop[i][0] - p0[0]) ** 2 + (loop[i][1] - p0[1]) ** 2)
    a = dp(loop[:far + 1], eps)
    b = dp(loop[far:] + [loop[0]], eps)
    res = a[:-1] + b[:-1]
    return res


def regularize(poly, tol_deg=9.0, min_len=3.0):
    """Srovná hrany blízké násobkům 45° přesně na 45° a sloučí sousední souběžné hrany.

    Bez toho mají rovné stěny po zjednodušení drobné zlomy, které se ve 3D
    projeví jako svislé "žebrování" ve stínování.
    """
    import math
    n = len(poly)
    edges = []  # (úhel nebo None, bod na přímce, směr, délka)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        ln = math.hypot(dx, dy)
        if ln < 1e-9:
            continue
        a = math.degrees(math.atan2(dy, dx))
        snap = round(a / 45.0) * 45.0
        mid = ((x1 + x2) / 2, (y1 + y2) / 2)
        if ln >= min_len and abs(a - snap) <= tol_deg:
            r = math.radians(snap)
            edges.append([snap % 360, mid, (math.cos(r), math.sin(r)), ln])
        else:
            edges.append([None, mid, (dx / ln, dy / ln), ln])

    # sloučení sousedních hran se stejným srovnaným úhlem (vážený průměr polohy)
    def offset(e):
        (mx, my), (ux, uy) = e[1], e[2]
        return -uy * mx + ux * my  # vzdálenost přímky od počátku
    merged = True
    while merged and len(edges) > 3:
        merged = False
        for i in range(len(edges)):
            e, f = edges[i], edges[(i + 1) % len(edges)]
            if e[0] is not None and e[0] == f[0] and abs(offset(e) - offset(f)) < 2.0:
                w = e[3] + f[3]
                mid = ((e[1][0] * e[3] + f[1][0] * f[3]) / w, (e[1][1] * e[3] + f[1][1] * f[3]) / w)
                edges[i] = [e[0], mid, e[2], w]
                del edges[(i + 1) % len(edges)]
                merged = True
                break

    out = []
    m = len(edges)
    for i in range(m):
        e, f = edges[i - 1], edges[i]
        (px, py), (ux, uy) = e[1], e[2]
        (qx, qy), (vx, vy) = f[1], f[2]
        den = ux * vy - uy * vx
        if abs(den) < 0.2:
            # skoro rovnoběžné: vezmi bod mezi konci hran
            out.append(((px + ux * e[3] / 2 + qx - vx * f[3] / 2) / 2, (py + uy * e[3] / 2 + qy - vy * f[3] / 2) / 2))
            continue
        t = ((qx - px) * vy - (qy - py) * vx) / den
        out.append((round(px + ux * t, 2), round(py + uy * t, 2)))
    return out


def point_in_poly(pt, poly):
    x, y = pt
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def opening_lines(openings):
    for dr in openings.get('doors', []):
        yield dr['hinge'], dr['tip'], dr.get('t', 6)
    for key in ('sliders', 'windows', 'railings'):
        for o in openings.get(key, []):
            yield o['a'], o['b'], o.get('t', 6)


def barrier(walls, openings):
    """Maska stěn doplněná o zavřené dveře, okna a zábradlí."""
    m = walls.copy()
    d = ImageDraw.Draw(m)
    for a, b, t in opening_lines(openings):
        # prodloužit o pár px, ať se uzavřou drobné mezery u ostění
        (ax, ay), (bx, by) = a, b
        ln = max(1e-6, ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5)
        ux, uy = (bx - ax) / ln * 4, (by - ay) / ln * 4
        d.line([(ax - ux, ay - uy), (bx + ux, by + uy)], fill=255, width=max(3, int(t)))
    return m


def floor_mask(walls, openings):
    """Maska podlahy (a stropu): vše, kam se z okolí bytu nedá dostat přes stěny/okna/dveře.

    V aplikaci slouží jako alphaMap. Strop kryje i balkon (deska balkonu z patra nad ním).
    """
    m = barrier(walls, openings)
    ImageDraw.floodfill(m, (0, 0), 128)
    m.point(lambda v: 0 if v == 128 else 255).save(OUT_FLOOR)


def room_map(walls, openings):
    """Mapa místností pro HUD (public/rooms.png)."""
    # mapa místností: hodnota pixelu = index místnosti + 1 (0 = nic).
    # Geodetický Voronoi: BFS ze všech semínek najednou, takže otevřené
    # prostory (obývák/jídelna/kuchyně) se rozdělí podle nejbližšího semínka.
    from collections import deque
    bar = barrier(walls, openings)
    W, H = bar.size
    bpx = bar.load()
    lab = bytearray(W * H)
    q = deque()
    for i, room in enumerate(openings.get('rooms', [])):
        x, y = room['seed']
        if bpx[x, y] >= 128:
            print(f'varování: semínko místnosti {room["name"]} leží ve stěně')
            continue
        lab[y * W + x] = i + 1
        q.append((x, y))
    while q:
        x, y = q.popleft()
        v = lab[y * W + x]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not lab[ny * W + nx] and bpx[nx, ny] < 128:
                lab[ny * W + nx] = v
                q.append((nx, ny))
    r = Image.frombytes('L', (W, H), bytes(lab))
    # stěny a dveře přiřaď nejbližší místnosti (ať HUD ve dveřích nebliká)
    r = r.filter(ImageFilter.MaxFilter(7))
    r.save(OUT_ROOMS)


def draw_openings(d, openings):
    for dr in openings.get('doors', []):
        hx, hy = dr['hinge']
        d.line([tuple(dr['hinge']), tuple(dr['tip'])], fill=(0, 200, 0, 255), width=3)
        d.line([tuple(dr['hinge']), tuple(dr['open'])], fill=(0, 200, 0, 160), width=1)
        d.ellipse([hx - 3, hy - 3, hx + 3, hy + 3], fill=(0, 120, 0, 255))
    for s in openings.get('sliders', []):
        d.line([tuple(s['a']), tuple(s['b'])], fill=(255, 140, 0, 255), width=3)
    for w in openings.get('windows', []):
        d.line([tuple(w['a']), tuple(w['b'])], fill=(0, 140, 255, 255), width=3)
    for r in openings.get('railings', []):
        d.line([tuple(r['a']), tuple(r['b'])], fill=(160, 0, 200, 255), width=3)


def main():
    edits = json.load(open(EDITS)) if os.path.exists(EDITS) else {}
    m = load_mask(edits)
    os.makedirs(OUT_DIR, exist_ok=True)
    m.save(os.path.join(OUT_DIR, 'walls_mask.png'))

    loops = trace_loops(m)
    outers, holes = [], []
    for lp in loops:
        s = simplify_loop(lp, DP_EPS)
        if len(s) >= 4:
            s = regularize(s)
        if len(s) < 3:
            continue
        a = area(s)
        if abs(a) < 4:
            continue
        if a < 0 and -a < MIN_HOLE:
            continue
        (outers if a > 0 else holes).append(s)

    polys = [{'outer': o, 'holes': []} for o in outers]
    for h in holes:
        for p in polys:
            if point_in_poly((h[0][0] + 0.01, h[0][1] + 0.01), p['outer']):
                p['holes'].append(h)
                break

    with open(OUT_JSON, 'w') as f:
        json.dump({'source': 'pudorys.jpg', 'size': list(m.size), 'polygons': polys}, f, separators=(',', ':'))

    openings = json.load(open(OPENINGS)) if os.path.exists(OPENINGS) else {}
    floor_mask(m, openings)
    room_map(m, openings)

    # kontrolní překryv
    base = Image.open(SRC).convert('RGB')
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for p in polys:
        d.polygon([tuple(pt) for pt in p['outer']], fill=(255, 0, 0, 110), outline=(255, 0, 0, 255))
        for h in p['holes']:
            d.polygon([tuple(pt) for pt in h], fill=(0, 0, 0, 0), outline=(0, 160, 255, 255))
    draw_openings(d, openings)
    Image.alpha_composite(base.convert('RGBA'), ov).convert('RGB').save(os.path.join(OUT_DIR, 'walls_overlay.png'))

    nverts = sum(len(p['outer']) + sum(len(h) for h in p['holes']) for p in polys)
    print(f'{len(polys)} polygonů, {len(holes)} děr, {nverts} vrcholů -> {os.path.relpath(OUT_JSON, ROOT)}')


if __name__ == '__main__':
    sys.exit(main())
