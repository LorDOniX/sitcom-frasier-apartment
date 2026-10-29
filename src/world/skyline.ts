import * as THREE from 'three';

/**
 * Procedurální panorama Seattlu na válci kolem bytu (zástupce za fotografii / HDRI).
 * Balkon v půdorysu míří nahoru (-Z), tam je Space Needle a Elliott Bay.
 */
export class Skyline {
  readonly mesh: THREE.Mesh;
  private day: THREE.CanvasTexture;
  private night: THREE.CanvasTexture;
  private mat: THREE.MeshBasicMaterial;

  constructor() {
    this.day = new THREE.CanvasTexture(drawPanorama(false));
    this.night = new THREE.CanvasTexture(drawPanorama(true));
    for (const t of [this.day, this.night]) t.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ map: this.day, side: THREE.BackSide, fog: false });
    // byt je v 19. patře: horizont těsně pod úrovní očí
    const geo = new THREE.CylinderGeometry(90, 90, 120, 64, 1, true);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.y = -8;
    // zrcadlit, aby panorama nebylo zevnitř převrácené
    this.mesh.scale.x = -1;
  }

  setNight(night: boolean) {
    this.mat.map = night ? this.night : this.day;
    this.mat.needsUpdate = true;
  }
}

function drawPanorama(night: boolean): HTMLCanvasElement {
  const W = 4096;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const horizon = H * 0.56;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  if (night) {
    sky.addColorStop(0, '#060914');
    sky.addColorStop(0.7, '#17203a');
    sky.addColorStop(1, '#3b3550');
  } else {
    sky.addColorStop(0, '#5d8fc7');
    sky.addColorStop(0.75, '#b8d0e6');
    sky.addColorStop(1, '#e9e2d6');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);

  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  if (night) {
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 400; i++) g.fillRect(rnd() * W, rnd() * horizon * 0.7, 1.5, 1.5);
  }

  // Mount Rainier (na jihovýchodě, tj. v půdorysu vpravo dole => u ~0.85)
  const rx = W * 0.85;
  g.fillStyle = night ? '#2a2f45' : '#c9d3e0';
  g.beginPath();
  g.moveTo(rx - 520, horizon);
  g.quadraticCurveTo(rx - 120, horizon - 210, rx, horizon - 250);
  g.quadraticCurveTo(rx + 120, horizon - 210, rx + 520, horizon);
  g.fill();
  if (!night) {
    g.fillStyle = '#f6f8fb';
    g.beginPath();
    g.moveTo(rx - 150, horizon - 170);
    g.quadraticCurveTo(rx - 50, horizon - 235, rx, horizon - 250);
    g.quadraticCurveTo(rx + 50, horizon - 235, rx + 150, horizon - 170);
    g.fill();
  }

  // Olympic Mountains za zálivem
  g.fillStyle = night ? '#1c2236' : '#9fb0c4';
  g.beginPath();
  g.moveTo(0, horizon);
  for (let x = 0; x <= W; x += 40) {
    g.lineTo(x, horizon - 30 - Math.abs(Math.sin(x * 0.004) * 60 + Math.sin(x * 0.013) * 25));
  }
  g.lineTo(W, horizon);
  g.fill();

  // voda (Elliott Bay) pod horizontem
  const sea = g.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, night ? '#151a2c' : '#6b8fa8');
  sea.addColorStop(1, night ? '#05070d' : '#2f4d63');
  g.fillStyle = sea;
  g.fillRect(0, horizon, W, H - horizon);

  // město – bloky budov v pásu kolem dokola, nejvyšší za balkonem
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W;
    const u = x / W;
    const core = Math.exp(-Math.pow((u - 0.42) / 0.12, 2)) + 0.35 * Math.exp(-Math.pow((u - 0.62) / 0.1, 2));
    const bw = 18 + rnd() * 50;
    const bh = 20 + rnd() * 70 + core * rnd() * 260;
    const top = horizon - bh + 40;
    const shade = night ? 12 + rnd() * 14 : 120 + rnd() * 70;
    g.fillStyle = night ? `rgb(${shade},${shade},${shade + 8})` : `rgb(${shade - 10},${shade},${shade + 12})`;
    g.fillRect(x, top, bw, horizon + 120 - top);
    if (night) {
      for (let wy = top + 6; wy < horizon + 110; wy += 9) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 7) {
          if (rnd() < 0.35) {
            g.fillStyle = rnd() < 0.8 ? 'rgba(255,214,140,0.9)' : 'rgba(190,220,255,0.9)';
            g.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
  }

  // Space Needle – přímo za balkonem (u = 0.5 je směr -Z)
  const nx = W * 0.5;
  const base = horizon + 60;
  const topY = horizon - 330;
  g.fillStyle = night ? '#d9d4c8' : '#f2efe8';
  g.strokeStyle = g.fillStyle;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(nx - 46, base);
  g.quadraticCurveTo(nx - 6, horizon - 120, nx - 14, topY + 40);
  g.moveTo(nx + 46, base);
  g.quadraticCurveTo(nx + 6, horizon - 120, nx + 14, topY + 40);
  g.stroke();
  g.beginPath();
  g.ellipse(nx, topY + 30, 70, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(nx - 52, topY + 10, 104, 16);
  g.beginPath();
  g.moveTo(nx - 30, topY + 10);
  g.lineTo(nx, topY - 30);
  g.lineTo(nx + 30, topY + 10);
  g.fill();
  g.fillRect(nx - 2, topY - 90, 4, 62);
  if (night) {
    g.fillStyle = '#ffd890';
    g.fillRect(nx - 50, topY + 22, 100, 4);
    g.fillStyle = '#ff4040';
    g.fillRect(nx - 3, topY - 94, 6, 6);
  }
  return c;
}
