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
