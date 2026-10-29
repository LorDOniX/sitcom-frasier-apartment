import { PLAN_H, PLAN_W } from './config';
import { toPlan } from './plan';

/** Minimapa: zmenšený půdorys s polohou a směrem pohledu hráče. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private img = new Image();
  private ready = false;
  visible = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.img.onload = () => (this.ready = true);
    this.img.src = '/pudorys.jpg';
  }

  toggle() {
    this.visible = !this.visible;
    this.canvas.style.display = this.visible ? 'block' : 'none';
  }

  /** x, z = poloha ve světě; yaw = natočení kamery (0 = pohled do -Z). */
  draw(x: number, z: number, yaw: number) {
    if (!this.visible || !this.ready) return;
    const { ctx, canvas } = this;
    const sx = canvas.width / PLAN_W;
    const sy = canvas.height / PLAN_H;
    ctx.drawImage(this.img, 0, 0, canvas.width, canvas.height);
    const [px, py] = toPlan(x, z);
    const cx = px * sx;
    const cy = py * sy;
    // směr pohledu: kamera hledí do -Z, rotace yaw kolem Y => (-sin yaw, -cos yaw) v (x, z)
    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);
    const ang = Math.atan2(dz, dx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(220, 40, 40, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 26, ang - 0.6, ang + 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d42020';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
