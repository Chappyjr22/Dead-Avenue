import * as THREE from 'three';
import { MAG_SIZE, START_SPARE, MEDKIT } from './data.js';

// State shared between modules.
const player = { x: 41, z: 44, y: 0, yaw: 0, pitch: 0.03, hp: 100, hurt: 0, ammo: MAG_SIZE, spare: START_SPARE, reloading: 0, cool: 0, bob: 0, kick: 0, kills: 0, medkits: MEDKIT.start, healing: 0 };
const zombies = [];
const game = { ready: false, started: false, dead: false, touchMode: false, firing: false };
const clock = new THREE.Clock();

export { player, zombies, game, clock };
