import * as THREE from 'three';
import { newSupplies, newEquipment } from './inventory.js';
import { WEAPONS, START_WEAPON, MEDKIT } from './data.js';

// Each weapon keeps its own loaded and spare rounds; player.ammo and player.spare read and write the held one's.
const newArsenal = () => Object.fromEntries(Object.entries(WEAPONS).map(([id, w]) => [id, { ammo: w.mag, spare: w.spare }]));
function createPlayer() {
  return {
    x: 41, z: 44, y: 0, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, reloading: 0, cool: 0, bob: 0, kick: 0, kills: 0, medkits: MEDKIT.start, healing: 0,
    hunger: 100, thirst: 100, supplies: newSupplies(), equipment: newEquipment(),
    weapon: START_WEAPON, switchTo: START_WEAPON, switching: 0, guns: newArsenal(),
    get ammo() { return this.guns[this.weapon].ammo; }, set ammo(n) { this.guns[this.weapon].ammo = n; },
    get spare() { return this.guns[this.weapon].spare; }, set spare(n) { this.guns[this.weapon].spare = n; }
  };
}
// State shared between modules.
const player = createPlayer();
const zombies = [];
const game = { ready: false, started: false, dead: false, touchMode: false, firing: false, inventoryOpen: false, controllerMode: false };
const clock = new THREE.Clock();

export { player, zombies, game, clock, newArsenal, createPlayer };
