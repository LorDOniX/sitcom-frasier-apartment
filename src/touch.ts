import * as THREE from 'three';

/**
 * Dotykové ovládání (telefon, tablet): levá část obrazovky = virtuální joystick (objeví se pod prstem),
 * zbytek = tažením rozhlížení, tlačítka akce (E), minimapa, den/noc a menu.
 * Pracuje s Pointer Events (pointerType "touch"), takže funguje i s perem nebo myší v emulaci.
 */
export class TouchControls {
  active = false;
  /** pohyb z joysticku: x = doprava, y = dopředu, délka 0..1 */
  readonly move = new THREE.Vector2();
  private stickId: number | null = null;
  private lookId: number | null = null;
  private origin = new THREE.Vector2();
  private last = new THREE.Vector2();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private layer: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;

  constructor(
    private camera: THREE.Camera,
    private onAction: () => void,
    private onKey: (code: string) => void,
    private onMenu: () => void,
  ) {
    this.layer = document.getElementById('touch')!;
    this.stick = document.getElementById('stick')!;
    this.knob = document.getElementById('knob')!;
    this.layer.addEventListener('pointerdown', (e) => this.down(e));
    this.layer.addEventListener('pointermove', (e) => this.moveTo(e));
    for (const t of ['pointerup', 'pointercancel']) this.layer.addEventListener(t, (e) => this.up(e as PointerEvent));
    const button = (id: string, fn: () => void) =>
      document.getElementById(id)!.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        fn();
      });
    button('t-act', () => this.onAction());
    button('t-map', () => this.onKey('KeyM'));
    button('t-night', () => this.onKey('KeyN'));
    button('t-menu', () => this.onMenu());
  }

  start() {
    this.active = true;
    this.layer.hidden = false;
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  stop() {
    this.active = false;
    this.layer.hidden = true;
    this.stickId = this.lookId = null;
    this.move.set(0, 0);
    this.stick.hidden = true;
  }

  /** Zvýrazní tlačítko akce, když je na co působit. */
  setActionEnabled(on: boolean) {
    document.getElementById('t-act')!.classList.toggle('ready', on);
  }

  private down(e: PointerEvent) {
    this.layer.setPointerCapture(e.pointerId);
    if (this.stickId === null && e.clientX < window.innerWidth * 0.4) {
      this.stickId = e.pointerId;
      this.origin.set(e.clientX, e.clientY);
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.knob.style.transform = '';
      this.stick.hidden = false;
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.last.set(e.clientX, e.clientY);
    }
  }

  private moveTo(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      const R = 60;
      const d = new THREE.Vector2(e.clientX - this.origin.x, e.clientY - this.origin.y);
      if (d.length() > R) d.setLength(R);
      this.knob.style.transform = `translate(${d.x}px, ${d.y}px)`;
      this.move.set(d.x / R, -d.y / R);
    } else if (e.pointerId === this.lookId) {
      const k = 4 / Math.max(window.innerWidth, window.innerHeight); // celá šířka obrazovky ≈ 4 rad
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= (e.clientX - this.last.x) * k;
      this.euler.x = THREE.MathUtils.clamp(this.euler.x - (e.clientY - this.last.y) * k, -1.45, 1.45);
      this.camera.quaternion.setFromEuler(this.euler);
      this.last.set(e.clientX, e.clientY);
    }
  }

  private up(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.move.set(0, 0);
      this.stick.hidden = true;
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }
}
