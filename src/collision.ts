import * as THREE from 'three';

/** Úsečka v rovině podlahy (x, z). */
export interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/**
 * Kolize hráče (kruh) se statickými a pohyblivými úsečkami.
 * Statické úsečky jsou v mřížce (spatial hash), dynamické (dveře) se dodávají každý snímek.
 */
export class CollisionWorld {
  private cell = 1.0;
  private grid = new Map<string, Segment[]>();
  private dynamic: (() => Segment[])[] = [];

  addStatic(seg: Segment) {
    const x0 = Math.floor(Math.min(seg.ax, seg.bx) / this.cell);
    const x1 = Math.floor(Math.max(seg.ax, seg.bx) / this.cell);
    const z0 = Math.floor(Math.min(seg.az, seg.bz) / this.cell);
    const z1 = Math.floor(Math.max(seg.az, seg.bz) / this.cell);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = `${x},${z}`;
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(seg);
      }
    }
  }

  addPolygon(points: THREE.Vector2[]) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      this.addStatic({ ax: a.x, az: a.y, bx: b.x, bz: b.y });
    }
  }

  addDynamic(provider: () => Segment[]) {
    this.dynamic.push(provider);
  }

  /** Vytlačí kruh (x, z, r) ze všech úseček. Vrací opravenou pozici. */
  resolve(pos: THREE.Vector2, r: number): THREE.Vector2 {
    const segs = new Set<Segment>();
    const cx0 = Math.floor((pos.x - r) / this.cell);
    const cx1 = Math.floor((pos.x + r) / this.cell);
    const cz0 = Math.floor((pos.y - r) / this.cell);
    const cz1 = Math.floor((pos.y + r) / this.cell);
    for (let x = cx0; x <= cx1; x++) {
      for (let z = cz0; z <= cz1; z++) {
        const list = this.grid.get(`${x},${z}`);
        if (list) for (const s of list) segs.add(s);
      }
    }
    const all = [...segs];
    for (const d of this.dynamic) all.push(...d());

    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const s of all) {
        const dx = s.bx - s.ax;
        const dz = s.bz - s.az;
        const l2 = dx * dx + dz * dz || 1e-9;
        let t = ((pos.x - s.ax) * dx + (pos.y - s.az) * dz) / l2;
        t = Math.max(0, Math.min(1, t));
        const px = s.ax + dx * t;
        const pz = s.az + dz * t;
        let nx = pos.x - px;
        let nz = pos.y - pz;
        const d2 = nx * nx + nz * nz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1e-6;
          nx /= d;
          nz /= d;
          pos.x = px + nx * r;
          pos.y = pz + nz * r;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return pos;
  }
}
