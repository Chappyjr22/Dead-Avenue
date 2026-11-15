// Plain data: colours, names and outfits. Safe to edit without touching the engine.

// Names painted on shop signs. The sign atlas holds exactly 16.
export const SHOP_SIGNS = ['LIBERTY DELI', '24 HR PHARMACY', 'PAWN & LOAN', 'LAUNDROMAT', 'SAL’S PIZZA', 'HARDWARE', 'CORNER BODEGA', 'WINE & LIQUOR', 'NAILS', 'USED BOOKS', 'COFFEE', 'DINER', 'TAILOR', 'FLOWERS', 'BARBER', 'ELECTRONICS'];

// Brick and render colours for building walls.
export const WALL_COLOURS = [0x7d3f30, 0x5e2f27, 0x6b4a37, 0x9a8266, 0xb3a58c, 0x7a7872, 0x4c4b4d, 0xa8a39a, 0x8a5a44, 0x6a3a30];

// Stone trim: sills, cornices, bulkheads.
export const TRIM_COLOURS = [0xa39c8c, 0x8d877b, 0x6f6a62, 0xb8b0a0];

// Shop awning fabric.
export const AWNING_COLOURS = [0x6d2a24, 0x2c4a3a, 0x2a3a5a, 0x8a7a4a, 0x3a3a3a];

// Abandoned car paint. Repeating a colour makes it more common (the two yellows are taxis).
export const CAR_COLOURS = [0x6b6d70, 0x1d1e20, 0x8f9194, 0x5a1a16, 0x1f2f47, 0x8c7a5a, 0xb38f1d, 0xb38f1d, 0x3a4a3c, 0xa8a8a4];

// Packaging colours for products left on shop shelves.
export const GOODS_COLOURS = [0xb03a2e, 0xd4a82a, 0x2e5fa8, 0x3f8a4a, 0xd8d4c8, 0xc8642a, 0x7a3a8a, 0x2a8a8a];

// Clothing and skin colours for the dead. sleeve: true covers the forearms with the shirt colour.
export const ZOMBIE_OUTFITS = [
  { skin: 0x6f7868, shirt: 0x2f3a44, legs: 0x1e2126, shoe: 0x0e0e0e, sleeve: true },
  { skin: 0x7a7466, shirt: 0x5a2a24, legs: 0x2a2f3a, shoe: 0x1a1512, sleeve: false },
  { skin: 0x66705f, shirt: 0x6a6a5c, legs: 0x3a3226, shoe: 0x0e0e0e, sleeve: false },
  { skin: 0x74685c, shirt: 0x26302a, legs: 0x2c2c30, shoe: 0x1a1512, sleeve: true },
  { skin: 0x6a7268, shirt: 0x7a7468, legs: 0x1c2430, shoe: 0x0e0e0e, sleeve: true },
  { skin: 0x70665a, shirt: 0x3f3550, legs: 0x4a4438, shoe: 0x1a1512, sleeve: false }
];

// Ammunition. Ammo boxes found in shops hold pistol rounds.
export const MAG_SIZE = 12, START_SPARE = 24, AMMO_BOX = 12, AMMO_BOX_WEAPON = 'makarov';

// Weapons the player carries, in key order (1, 2, ...). A zombie has 3 health.
// damage: per body hit; headshot: per hit above 1.5 m. auto: keeps firing while held, one shot per
// interval seconds. kick: visual recoil impulse; climb: radians the aim rises per shot (yaw: random sideways drift).
// noise: metres within which a shot is heard (see NOISE). reload: seconds. adsFov: camera field of view when aiming. model: file under assets/, without .glb.
// mount: where the weapon sits at the hip, relative to the camera (position, rotation, scale);
// hipTurn: an extra turn of the whole held view at the hip, gone when aiming; ads: how far the held view
// moves to bring the sights onto the camera axis; reloadPose: how far the held view drops, tips down and rolls
// at the middle of a reload. muzzle: flash position in the weapon's own space.
export const WEAPONS = {
  makarov: {
    name: 'Makarov', short: 'PISTOL', model: 'makarov', mag: MAG_SIZE, spare: START_SPARE,
    damage: 1, headshot: 3, auto: false, interval: 0.19, kick: 1, climb: 0, yaw: 0, reload: 1.25, adsFov: 52,
    mount: { pos: [0.075, -0.125, -0.42], rot: [0, 0, 0], scale: 0.85 }, hipTurn: [0, 0, 0], ads: [-0.075, 0.0772, 0.04], reloadPose: [0.3, 0.55, 0],
    muzzle: [0, 0.041, -0.2], flash: 0.22, sound: 'shot', noise: 45
  },
  ak47: {
    name: 'AK-47', short: 'RIFLE', model: 'weapons/ak47', mag: 30, spare: 90,
    damage: 2, headshot: 3, auto: true, interval: 0.1, kick: 1.35, climb: 0.007, yaw: 0.003, reload: 2.2, adsFov: 42,
    mount: { pos: [0.2214, -0.1412, -0.5793], rot: [-0.0082, 0, 0], scale: 0.85 }, hipTurn: [0, 0.18, 0.05], ads: [-0.2192, 0.1051, 0.4], reloadPose: [0.06, 0.14, 0.38],
    muzzle: [0, -0.006, -0.35], flash: 0.3, sound: 'rifle', noise: 110
  }
};
export const START_WEAPON = 'makarov';
// Seconds to change weapon: the held one lowers for half of it, the new one rises for the rest.
export const WEAPON_SWITCH = 0.5;

// Medkits: carried from the start, the most you can hold, health restored per use, and the seconds a use takes.
export const MEDKIT = { start: 1, max: 3, heal: 40, time: 1.0 };

// Shop types: the sign over the door and the interior are both chosen from one of these.
// medkit is the chance (0 to 1) that a loot spot in the shop holds a medkit instead of pistol ammo.
export const SHOP_TYPES = [
  { name: 'grocery', medkit: 0.2, signs: ['LIBERTY DELI', 'CORNER BODEGA', 'SAL’S PIZZA'], goods: [0xb03a2e, 0xd4a82a, 0x2e5fa8, 0x3f8a4a, 0xd8d4c8, 0xc8642a, 0x7a3a8a, 0x2a8a8a], fill: 0.45, chillers: true, wall: [0x9a9484, 0x8a9690, 0xa09078] },
  { name: 'pharmacy', medkit: 0.75, signs: ['24 HR PHARMACY', 'NAILS'], goods: [0xe8e8e2, 0xd8e4ec, 0xb8d4e4, 0xc4e0cc, 0xf0f0ea, 0x8ab4cc], fill: 0.5, chillers: false, wall: [0xb4b8b4, 0xa8b4bc, 0xb8c0b0] },
  { name: 'hardware', medkit: 0.05, signs: ['HARDWARE', 'ELECTRONICS'], goods: [0xc8642a, 0xd4a82a, 0x5a5a58, 0x2e5fa8, 0x8a2a22, 0x3a3a3a, 0x7a7a74], fill: 0.35, chillers: false, wall: [0x7a7872, 0x8a8478, 0x6e7478] },
  { name: 'liquor', medkit: 0.05, signs: ['WINE & LIQUOR'], goods: [0x1f4a2a, 0x2c5a30, 0xb07a1e, 0x8a5a24, 0x5a3418, 0x3a2a1c, 0xc89a3a], fill: 0.5, chillers: true, wall: [0x6a5a48, 0x5a4a3c, 0x4a4a42] },
  { name: 'books', medkit: 0.15, signs: ['USED BOOKS', 'TAILOR', 'PAWN & LOAN'], goods: [0x7a2a2a, 0x2a4a6a, 0x4a5a3a, 0x8a6a3a, 0x5a3a5a, 0xc8b88a, 0x3a3a48], fill: 0.7, chillers: false, wall: [0x8a7a60, 0x7a6a56, 0x6a6458] },
  { name: 'cafe', medkit: 0.2, signs: ['COFFEE', 'DINER', 'FLOWERS'], goods: [0x6a4028, 0xd8c8a8, 0xb03a2e, 0x3f8a4a, 0xd4a82a, 0xe0d8c8], fill: 0.3, chillers: true, wall: [0xa09078, 0x9a8c70, 0x8a9690] },
  { name: 'barber', medkit: 0.25, signs: ['BARBER', 'LAUNDROMAT'], goods: [0x2e5fa8, 0xb03a2e, 0xd8d4c8, 0x2a8a8a, 0x3a3a48], fill: 0.2, chillers: false, wall: [0x8a9690, 0x9a9a92, 0x7a8890] },
];

// Movement speeds in metres/second and camera field of view in degrees.
export const MOVEMENT = { walk: 2.5, sprint: 5.6, aim: 1.5, hipFov: 68, aimFov: 52 };

// Loot is identified at a distance but must be deliberately collected within reach.
// occlusionSlack lets you target loot sitting on a shelf or counter, whose own collision circle would otherwise hide it.
export const LOOT = { identifyRange: 5, reach: 2.4, minAimDot: 0.975, occlusionSlack: 0.75 };

export const PLAYER_CONTROL = { gravity: 16, jumpSpeed: 5.2, crouchSpeed: 1.2, standEye: 1.68, crouchEye: 1.08 };

// Day and night. The clock runs in game hours; day is dawn to dusk, night is dusk to dawn, and each half takes its own
// number of real seconds. The day number goes up at dawn, so night N follows day N. twilight: game hours over which
// the light blends at dusk and at dawn, centred on the hour. startHour: the clock when a new game starts.
export const DAY_CYCLE = { dayLength: 480, nightLength: 240, dawn: 6, dusk: 20, twilight: 1.6, startHour: 7.5 };

// The horde. The pool of zombie models is created at load and never grows: cap is the most alive at once.
// day: how the city behaves in daylight. nights: night 1, 2, 3, ...; the last row repeats, plus perNight for every
// night beyond the table, up to the limits in max.
// active: share of the pool walking the streets. speed: movement multiplier. sight: metres they can see you.
// hearing: multiplier on every noise radius. respawn: seconds a recycled zombie waits before it walks again.
// spawnMin and spawnMax: how far from the player a zombie (re)appears.
export const HORDE = {
  cap: { desktop: 24, phone: 16 },
  day: { active: 0.42, speed: 1, sight: 30, hearing: 1, respawn: 40, spawnMin: 60, spawnMax: 200 },
  nights: [
    { active: 0.67, speed: 1.15, sight: 36, hearing: 1.2, respawn: 14, spawnMin: 45, spawnMax: 110 },
    { active: 0.8, speed: 1.25, sight: 40, hearing: 1.3, respawn: 10, spawnMin: 40, spawnMax: 95 },
    { active: 0.92, speed: 1.35, sight: 44, hearing: 1.4, respawn: 7, spawnMin: 35, spawnMax: 85 }
  ],
  perNight: { active: 0.04, speed: 0.04, sight: 2, hearing: 0.05, respawn: -1, spawnMin: -2, spawnMax: -4 },
  max: { active: 1, speed: 1.6, sight: 52, hearing: 1.8, respawn: 4, spawnMin: 28, spawnMax: 70 },
  search: 8 // seconds a zombie lingers where it heard a noise (or last saw you) before it wanders off
};

// Noise draws the dead. Gunshots use each weapon's noise radius; sprinting gives off a small noise every interval
// seconds; walking and crouching are silent. Sustained fire carries further: each shot adds 1 to a heat that cools
// by 1 a second, and the radius grows by perShot for each point of heat, up to maxBoost.
export const NOISE = { sprint: 10, sprintInterval: 0.6, walk: 0, crouch: 0, perShot: 0.03, maxBoost: 0.45 };

// Dying is not the end. You wake on a street away from the dead, keep your weapons (with their starting rounds), the
// starting medkits and the gear you wear; everything else you carried is gone. These are the needs you wake with.
// minZombieDist: a respawn point is kept only this far from every live zombie, if any such point can be found.
export const DEATH = { hp: 100, hunger: 70, thirst: 70, minZombieDist: 60, tries: 60 };

// Light at three points of the cycle: day (the original golden look), dusk (the sun just down) and night. The game
// blends day to dusk to night by the night factor, which eases over DAY_CYCLE.twilight. Colours are linear RGB.
// sun: the directional light, which is the sun by day and the moon at night (sunI and moonI are its intensity on
// each side of dusk; it passes through zero at dusk, where it changes direction). sunY: the sun's height in the sky.
// hemi: sky colour, ground colour, intensity. fog: colour and density. sky: 0 day sky, 1 night sky. glow: sun glow in
// the sky. tint: multiplies the day sky. bloom: bloom strength. windows: lit window glow. lamps: powered streetlights.
// ash: brightness of the drifting ash. exposure: tone-mapping exposure.
export const LIGHTING = {
  sunDir: [0.10, 0.17, -1], moonDir: [-0.38, 0.62, 0.55],
  day: { sun: [1.0, 0.62, 0.36], sunI: 3.6, moonI: 0, sunY: 0.17, hemiSky: [0.36, 0.42, 0.62], hemiGround: [0.30, 0.20, 0.14], hemiI: 1.25, fog: [0.50, 0.33, 0.25], fogD: 0.0095, sky: 0, glow: 1, tint: [1, 1, 1], bloom: 0.42, windows: 5, lamps: 260, ash: 1, exposure: 1.05 },
  dusk: { sun: [1.0, 0.42, 0.22], sunI: 0, moonI: 0, sunY: -0.01, hemiSky: [0.24, 0.24, 0.42], hemiGround: [0.13, 0.09, 0.08], hemiI: 0.8, fog: [0.27, 0.17, 0.17], fogD: 0.0105, sky: 0.3, glow: 0.75, tint: [0.75, 0.55, 0.6], bloom: 0.5, windows: 6.5, lamps: 300, ash: 0.5, exposure: 1.05 },
  night: { sun: [0.55, 0.68, 1.0], sunI: 0, moonI: 0.17, sunY: -0.2, hemiSky: [0.09, 0.12, 0.27], hemiGround: [0.02, 0.02, 0.04], hemiI: 0.3, fog: [0.025, 0.035, 0.065], fogD: 0.0135, sky: 1, glow: 0, tint: [0.5, 0.5, 0.7], bloom: 0.62, windows: 9, lamps: 360, ash: 0.15, exposure: 1.1 }
};
