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

// Ammunition.
export const MAG_SIZE = 12, START_SPARE = 24, AMMO_BOX = 12;

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
