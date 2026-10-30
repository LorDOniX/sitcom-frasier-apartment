import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { EYE_HEIGHT, PLAYER_RADIUS, RUN_SPEED, WALK_SPEED } from './config';
import type { CollisionWorld } from './collision';
import { floorHeight } from './levels';

/** Pohyb první osobou: WASD + myš (Pointer Lock), kolize kruhu se stěnami. */
export class Player {
  readonly controls: PointerLockControls;
  collisions = true;
  /** Volá se po každém kroku (~0,7 m ušlé vzdálenosti) – zvuk kroků. */
  onStep?: () => void;
  /** analogový pohyb (dotykový joystick): x = doprava, y = dopředu, délka 0..1 */
  readonly input = new THREE.Vector2();
  private walked = 0;
  private keys = new Set<string>();
  private velocity = new THREE.Vector2();
  private bob = 0;
  /** výška podlahy pod hráčem, plynule dotahovaná (schody) */
  private floorY: number;

  constructor(
    private camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private world: CollisionWorld,
  ) {
    this.controls = new PointerLockControls(camera, dom);
    this.floorY = floorHeight(camera.position.x, camera.position.z);
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get position(): THREE.Vector3 {
    return this.camera.position;
  }

  /** Natočení kolem svislé osy (0 = pohled do -Z). */
  get yaw(): number {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    return e.y;
  }

  update(dt: number) {
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + this.input.y;
    const side = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.input.x;
    // joystick: rychlost podle výchylky (lehce = pomalu), klávesy vždy plnou rychlostí
    const analog = this.input.lengthSq() > 0 && fwd * fwd + side * side <= 1.0001 ? Math.hypot(fwd, side) : 1;
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED) * analog;

    const yaw = this.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    // vpravo = dopředu otočené o -90°
    const rx = -fz;
    const rz = fx;
    const want = new THREE.Vector2(fx * fwd + rx * side, fz * fwd + rz * side);
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
    // plynulý rozjezd a brzdění
    this.velocity.lerp(want, Math.min(1, dt * 10));

    const pos = new THREE.Vector2(this.camera.position.x, this.camera.position.z);
    const before = pos.clone();
    const step = this.velocity.clone().multiplyScalar(dt);
    // pohyb po menších krocích, aby se neprošlo tenkou stěnou
    const n = Math.max(1, Math.ceil(step.length() / 0.05));
    step.divideScalar(n);
    for (let i = 0; i < n; i++) {
      pos.add(step);
      if (this.collisions) this.world.resolve(pos, PLAYER_RADIUS);
    }
    this.camera.position.x = pos.x;
    this.camera.position.z = pos.y;
    this.walked += pos.distanceTo(before);
    if (this.walked > 0.7) {
      this.walked = 0;
      this.onStep?.();
    }

    // výška podlahy (snížený obývák, schody) – plynule, ať schod není skok
    this.floorY += (floorHeight(pos.x, pos.y) - this.floorY) * Math.min(1, dt * 10);

    // jemné pohupování při chůzi
    const moving = this.velocity.length();
    this.bob += dt * moving * 5.5;
    this.camera.position.y = this.floorY + EYE_HEIGHT + Math.sin(this.bob) * 0.018 * Math.min(1, moving / WALK_SPEED);
  }
}
