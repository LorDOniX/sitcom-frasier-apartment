// Měřítko odhadnuté z půdorysu (šířka dveří ~0,8–0,9 m, postel 1,6 m) => ~37 px na metr.
export const METERS_PER_PX = 0.027;

// Rozměry obrázku půdorysu (pudorys.jpg) a bod, který bude ve světě v počátku.
export const PLAN_W = 1280;
export const PLAN_H = 1016;
export const PLAN_ORIGIN: [number, number] = [PLAN_W / 2, PLAN_H / 2];

export const WALL_HEIGHT = 2.75;
export const DOOR_HEIGHT = 2.1;
export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.22;

export const WALK_SPEED = 1.6; // m/s
export const RUN_SPEED = 3.4;
export const INTERACT_DISTANCE = 2.2;

// Start v předsíni za vstupními dveřmi, pohled do obývacího pokoje.
export const SPAWN_PX: [number, number] = [440, 792];
export const SPAWN_YAW = -Math.PI / 2;
