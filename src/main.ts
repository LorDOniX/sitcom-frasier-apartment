import * as THREE from 'three';
import { EYE_HEIGHT, INTERACT_DISTANCE, SPAWN_PX, SPAWN_YAW } from './config';
import { CollisionWorld } from './collision';
import { Minimap } from './minimap';
import { toPlan, toWorld } from './plan';
import { Player } from './player';
import { Rooms } from './rooms';
import { buildFloor } from './world/floor';
import { buildFurniture, buildLights } from './world/furniture';
import { buildOpenings, type Interactable } from './world/openings';
import { Skyline } from './world/skyline';
import { buildWalls } from './world/walls';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- renderer, scéna, kamera -------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5d8fc7);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 400);
const spawn = toWorld(SPAWN_PX);
camera.position.set(spawn.x, EYE_HEIGHT, spawn.y);
camera.rotation.set(0, SPAWN_YAW, 0, 'YXZ');

// --- svět ------------------------------------------------------------------
const collision = new CollisionWorld();
const loader = new THREE.TextureLoader();
const manager = loader.manager;

const apartment = new THREE.Group();
scene.add(apartment);
apartment.add(buildWalls(collision));
const floors = buildFloor(loader, renderer.capabilities.getMaxAnisotropy());
apartment.add(floors.floor, floors.ceiling);
const interactables: Interactable[] = buildOpenings(apartment, collision);
buildFurniture(apartment, collision);

const hemi = new THREE.HemisphereLight(0xeef3ff, 0xcdbb9c, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
sun.position.set(-20, 30, -25);
scene.add(sun);
const lamps = buildLights(apartment);

const skyline = new Skyline();
scene.add(skyline.mesh);

const rooms = new Rooms(loader);
const minimap = new Minimap($('minimap'));
const player = new Player(camera, renderer.domElement, collision);

// --- den / noc -------------------------------------------------------------
let night = false;
function applyDayNight() {
  skyline.setNight(night);
  scene.background = new THREE.Color(night ? 0x060914 : 0x5d8fc7);
  hemi.intensity = night ? 0.3 : 1.5;
  sun.intensity = night ? 0 : 1.1;
  for (const l of lamps) l.intensity = night ? 9 : 2.5;
}
applyDayNight();

// --- UI --------------------------------------------------------------------
const overlay = $('overlay');
const startBtn = $<HTMLButtonElement>('start');
const hint = $('hint');
const roomLabel = $('room');

manager.onLoad = () => {
  $('loading').hidden = true;
  startBtn.hidden = false;
};
startBtn.addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => overlay.classList.add('hidden'));
player.controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

const raycaster = new THREE.Raycaster();
raycaster.far = INTERACT_DISTANCE;
const targets = interactables.flatMap((i) => i.targets);
let focused: Interactable | null = null;

function updateFocus() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = raycaster.intersectObjects(targets, false)[0];
  focused = (hit?.object.userData.interactable as Interactable) ?? null;
  if (focused && player.controls.isLocked) {
    hint.textContent = `E – ${focused.isOpen ? 'zavřít' : 'otevřít'}: ${focused.label}`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE':
      focused?.toggle();
      break;
    case 'KeyM':
      minimap.toggle();
      break;
    case 'KeyP':
      floors.togglePlan();
      break;
    case 'KeyN':
      night = !night;
      applyDayNight();
      break;
    case 'KeyC':
      player.collisions = !player.collisions;
      break;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ladění z konzole / automatických testů
Object.assign(window, { __frasier: { camera, player, interactables, toPlan, toWorld, scene } });

// --- smyčka ----------------------------------------------------------------
const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  if (player.controls.isLocked) player.update(dt);
  for (const i of interactables) i.update(dt);
  updateFocus();
  const p = camera.position;
  minimap.draw(p.x, p.z, player.yaw);
  roomLabel.textContent = rooms.at(p.x, p.z) ?? '';
  renderer.render(scene, camera);
});
