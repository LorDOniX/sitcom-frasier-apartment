import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY_DAY = 0x4f9fd8;
const SKY_NIGHT = 0x05081a;
// odlesky (parkety, klavír, sklo) z jednoduchého prostředí místnosti
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 400);
const spawn = toWorld(SPAWN_PX);
camera.position.set(spawn.x, EYE_HEIGHT, spawn.y);
camera.rotation.set(0, SPAWN_YAW, 0, 'YXZ');

// --- svět ------------------------------------------------------------------
const collision = new CollisionWorld();
const loader = new THREE.TextureLoader();
const manager = loader.manager;

const maxAniso = renderer.capabilities.getMaxAnisotropy();
const apartment = new THREE.Group();
scene.add(apartment);
apartment.add(buildWalls(collision, loader, maxAniso));
const floors = buildFloor(loader, maxAniso);
apartment.add(floors.group, floors.ceiling);
const interactables: Interactable[] = buildOpenings(apartment, collision);
const furniture = buildFurniture(apartment, collision, loader, maxAniso);

const hemi = new THREE.HemisphereLight(0xeef3ff, 0xe6d8c2, 0.75);
scene.add(hemi);

// Odpolední slunce: na fotce výhledu svítí zprava zezadu fotografa, tj. od jihozápadu
// (v půdorysu zdola zleva). Do bytu tak padá okny obýváku a kuchyně; strop a stěny vrhají stín.
const sun = new THREE.DirectionalLight(0xffe4c2, 5.5);
sun.position.copy(new THREE.Vector3(-0.45, 0.42, 0.79).normalize().multiplyScalar(60));
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 130 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const lamps = [...buildLights(apartment), ...furniture.nightLights];

const skyline = new Skyline(manager, renderer);
scene.add(skyline.group);

const rooms = new Rooms(loader);
const minimap = new Minimap($('minimap'));
const player = new Player(camera, renderer.domElement, collision);

// --- den / noc -------------------------------------------------------------
let night = false;
function applyDayNight() {
  skyline.setNight(night);
  scene.background = new THREE.Color(night ? SKY_NIGHT : SKY_DAY);
  scene.environmentIntensity = night ? 0.12 : 0.4;
  hemi.intensity = night ? 0.25 : 0.75;
  sun.intensity = night ? 0 : 5.5;
  for (const l of lamps) {
    l.intensity = night ? 9 : 0;
    l.visible = night;
  }
}
applyDayNight();

// --- UI --------------------------------------------------------------------
const overlay = $('overlay');
const startBtn = $<HTMLButtonElement>('start');
const hint = $('hint');
const roomLabel = $('room');

manager.onProgress = (_url, loaded, total) => {
  $('loading').textContent = `Načítám… ${Math.round((loaded / total) * 100)} %`;
};
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
