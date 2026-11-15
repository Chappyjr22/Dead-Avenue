// The game clock and what it does to the horde. Plain logic, no Three.js: tests import it directly.
import { DAY_CYCLE, HORDE } from './data.js';

export const newDaytime = (C = DAY_CYCLE) => ({ day: 1, hour: C.startHour });
export const isNightHour = (h, C = DAY_CYCLE) => h >= C.dusk || h < C.dawn;
// Game hours per real second in each half of the cycle.
const rate = (night, C) => night ? (24 - C.dusk + C.dawn) / C.nightLength : (C.dusk - C.dawn) / C.dayLength;

// Moves the clock on by dt real seconds. A step that crosses dusk or dawn changes rate there; dawn starts a new day.
export function advanceClock(t, dt, C = DAY_CYCLE) {
  let left = dt;
  for (let guard = 0; left > 1e-9 && guard < 8; guard++) {
    const night = isNightHour(t.hour, C), r = rate(night, C);
    const toEdge = night ? (C.dawn - t.hour + 24) % 24 : C.dusk - t.hour; // game hours to the next dusk or dawn
    if (left * r < toEdge) { t.hour += left * r; break; }
    left -= toEdge / r;
    t.hour = night ? C.dawn : C.dusk;
    if (night) t.day++;
  }
  if (t.hour >= 24) t.hour -= 24;
  return t;
}
// For tests and the harness: jump straight to a time (and day).
export function setClock(t, hour, day = t.day) { t.hour = ((hour % 24) + 24) % 24; t.day = day; return t; }

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
// 0 in daylight, 1 at night, easing across the twilight either side of dusk and of dawn.
export function nightFactor(hour, C = DAY_CYCLE) {
  const w = C.twilight / 2;
  return hour >= 12 ? smooth(C.dusk - w, C.dusk + w, hour) : 1 - smooth(C.dawn - w, C.dawn + w, hour);
}
export const formatHour = h => { const m = Math.floor(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

// Night n (1, 2, 3, ...): the table row, then perNight for each night past the table, held within max.
const KEYS = Object.keys(HORDE.day);
export function nightValues(n, out = {}) {
  const rows = HORDE.nights, row = rows[Math.min(Math.max(1, n), rows.length) - 1], extra = Math.max(0, n - rows.length);
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i], step = HORDE.perNight[k], v = row[k] + step * extra;
    out[k] = step < 0 ? Math.max(HORDE.max[k], v) : Math.min(HORDE.max[k], v);
  }
  return out;
}
// The horde right now: day values blended toward tonight's by the night factor, so dusk ramps up and dawn calms down.
// Night n follows day n, and the hours after midnight still belong to it. Writes into out: no garbage per frame.
const tonight = {};
export const threat = { ...HORDE.day, night: 0, nightNumber: 0 };
export function hordeAt(day, hour, out = threat) {
  const f = nightFactor(hour), d = HORDE.day; nightValues(day, tonight);
  for (let i = 0; i < KEYS.length; i++) { const k = KEYS[i]; out[k] = d[k] + (tonight[k] - d[k]) * f; }
  out.night = f; out.nightNumber = isNightHour(hour) ? day : 0;
  return out;
}
// The size of the zombie pool: never more than this many alive at once.
export const hordeCap = phone => phone ? HORDE.cap.phone : HORDE.cap.desktop;
export const activeTarget = (t, pool) => Math.min(pool, Math.round(t.active * pool));
