/* ==================================================================
   store.js — what the game remembers between visits (localStorage).
   Every read/write is guarded: private windows and blocked storage
   just mean nothing is remembered.
   ================================================================== */
const KEY = 'metro-game:v1';
const TRIP_TTL_MS = 12 * 60 * 60 * 1000;          // an unfinished ride expires after 12 h

const blank = () => ({ prefs: { mystery: true, distance: 'wander' }, trip: null, passport: { stations: {}, trips: [] } });

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') {
      const b = blank();
      return { prefs: { ...b.prefs, ...saved.prefs }, trip: saved.trip ?? null, passport: { ...b.passport, ...saved.passport } };
    }
  } catch { /* fall through */ }
  return blank();
}
let state = read();
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } };

export const prefs = () => state.prefs;
export function setPref(k, v) { state.prefs[k] = v; write(); }

/* The trip in progress, if it's recent enough to resume */
export function activeTrip() {
  const t = state.trip;
  if (!t) return null;
  if (Date.now() - (t.createdAt ?? 0) > TRIP_TTL_MS) { state.trip = null; write(); return null; }
  return t;
}
export function saveTrip(t) { state.trip = t; write(); }
export function updateTrip(patch) { if (state.trip) { Object.assign(state.trip, patch); write(); } return state.trip; }
export function clearTrip() { state.trip = null; write(); }

/* Passport: one stamp per station, plus a short trip log */
export const passport = () => state.passport;
export const stampCount = () => Object.keys(state.passport.stations).length;
export function stamp(trip) {
  const p = state.passport, now = new Date().toISOString();
  if (p.trips.some(x => x.id === trip.id)) return { isNew: false, visits: p.stations[trip.dest]?.visits ?? 1 };
  const s = p.stations[trip.dest] ??= { first: now, visits: 0 };
  s.visits++; s.last = now;
  p.trips.unshift({ id: trip.id, line: trip.line, start: trip.start, dest: trip.dest, stops: trip.numStops, at: now });
  p.trips.length = Math.min(p.trips.length, 50);
  write();
  return { isNew: s.visits === 1, visits: s.visits };
}
