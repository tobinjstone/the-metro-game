/* ==================================================================
   trip.js — planning a mystery trip. Pure functions (no DOM).
   ================================================================== */
import { metroLines } from './metro-lines.js';
import { TRANSFER } from './metro-map.js';

/* Transfer hubs offered as a quick start (fate picks the line) */
export const HUBS = [...TRANSFER];

export const lineByName   = name => metroLines.find(l => l.name === name);
export const linesServing = station => metroLines.filter(l => l.stations.includes(station));

const neighbours = (line, station) => {
  const i = line.stations.indexOf(station);
  return [line.stations[i - 1], line.stations[i + 1]].filter(Boolean);
};

/* Lines whose trains use the same platform as `line` at this station —
   they run to a common neighbouring station. Ballston: Orange + Silver.
   Metro Center: Red stands alone (different level from Orange/Silver/Blue). */
export function platformLines(line, station) {
  const mine = neighbours(line, station);
  return linesServing(station).filter(l => l === line || neighbours(l, station).some(n => mine.includes(n)));
}

export const DISTANCES = {
  quick:  { label: 'Quick hop', min: 1,  max: 4 },
  wander: { label: 'Wander',    min: 5,  max: 9 },
  long:   { label: 'Long haul', min: 10, max: Infinity }
};

/**
 * Pick a trip.
 *   start     station name (metro-lines.js spelling)
 *   line      the line the player chose (ignored when fromHub)
 *   fromHub   true → any line at the station is fair game
 *   mood      'Coffee' | … | 'Surprise'
 *   distance  'quick' | 'wander' | 'long'
 *   hasMood   (station, mood) → boolean; is there a matching place there?
 * Returns { line, start, dest, numStops, terminal, relaxed, lineChoices }.
 * `relaxed` says which wish we had to bend: null, 'distance', 'mood' or 'both'.
 */
export function planTrip({ start, line, fromHub = false, mood = 'Surprise', distance = 'wander',
                           hasMood = () => true, rng = Math.random }) {
  const chosen = typeof line === 'string' ? lineByName(line) : line;
  const lines  = fromHub || !chosen ? linesServing(start) : platformLines(chosen, start);
  const band   = DISTANCES[distance] ?? DISTANCES.wander;

  const all = [];
  for (const l of lines) {
    const i = l.stations.indexOf(start), last = l.stations.length - 1;
    for (const dir of [-1, 1]) {
      for (let k = 1; i + dir * k >= 0 && i + dir * k <= last; k++) {
        const dest = l.stations[i + dir * k];
        all.push({
          line: l, dir, k, dest,
          terminal: dir < 0 ? l.stations[0] : l.stations[last],
          moodOk: mood === 'Surprise' || hasMood(dest, mood),
          gap: k < band.min ? band.min - k : k > band.max ? k - band.max : 0
        });
      }
    }
  }

  const closest = pool => {
    if (!pool.length) return pool;
    const g = Math.min(...pool.map(c => c.gap));
    return pool.filter(c => c.gap === g);
  };
  const tiers = [
    { relaxed: null,       pool: all.filter(c => c.moodOk && c.gap === 0) },
    { relaxed: 'distance', pool: closest(all.filter(c => c.moodOk)) },
    { relaxed: 'mood',     pool: all.filter(c => c.gap === 0) },
    { relaxed: 'both',     pool: closest(all) }
  ];
  const tier = tiers.find(t => t.pool.length);
  if (!tier) return null;

  /* line first, then direction, then stop — so long lines don't dominate */
  const pickOf = arr => arr[Math.floor(rng() * arr.length)];
  const l   = pickOf([...new Set(tier.pool.map(c => c.line))]);
  const byL = tier.pool.filter(c => c.line === l);
  const dir = pickOf([...new Set(byL.map(c => c.dir))]);
  const way = byL.filter(x => x.dir === dir);
  const c   = pickOf(way);

  return { line: l.name, start, dest: c.dest, numStops: c.k, terminal: c.terminal, dir,
           candidates: padShortlist(l, start, dir, way.map(x => x.k)),
           relaxed: tier.relaxed, lineChoices: lines.map(x => x.name) };
}

/* The mystery shortlist: every stop the draw could have landed on (same line,
   same direction), padded with the nearest neighbours to at least `min` so a
   lone candidate doesn't give the game away. "Your stop is one of these" stays
   true either way. Returns station names in riding order. */
function padShortlist(line, start, dir, ks, min = 3) {
  const i = line.stations.indexOf(start);
  const maxK = dir < 0 ? i : line.stations.length - 1 - i;
  const set = new Set(ks);
  while (set.size < Math.min(min, maxK)) {
    /* add the stop closest to the ones already listed (ties go further out) */
    let best = null, bestD = Infinity;
    for (let k = 1; k <= maxK; k++) {
      if (set.has(k)) continue;
      const d = Math.min(...[...set].map(s => Math.abs(s - k)));
      if (d < bestD || (d === bestD && k > best)) { best = k; bestD = d; }
    }
    if (best == null) break;
    set.add(best);
  }
  return [...set].sort((a, b) => a - b).map(k => line.stations[i + dir * k]);
}

/* Shortlist for a trip that didn't come from planTrip (a shared link, the daily
   ride): every stop in the same distance band as the real one, same direction. */
export function shortlist(lineName, start, dest) {
  const line = lineByName(lineName);
  const i = line.stations.indexOf(start), j = line.stations.indexOf(dest), k = Math.abs(j - i), dir = Math.sign(j - i);
  const band = Object.values(DISTANCES).find(b => k >= b.min && k <= b.max) ?? DISTANCES.wander;
  const maxK = dir < 0 ? i : line.stations.length - 1 - i;
  const ks = [];
  for (let n = band.min; n <= Math.min(band.max, maxK); n++) ks.push(n);
  return padShortlist(line, start, dir, ks.length ? ks : [k]);
}

/* Stations from start to dest inclusive, in riding order */
export function rideStops(lineName, start, dest) {
  const s = lineByName(lineName).stations, a = s.indexOf(start), b = s.indexOf(dest);
  return a <= b ? s.slice(a, b + 1) : s.slice(b, a + 1).reverse();
}

/* Rough ride time: straight-line distance at ~56 km/h plus ~30 s per stop
   (Shady Grove → Glenmont comes out near WMATA's ~66 min).
   coordsOf(station) → [lat, lng] or undefined; falls back to 2.5 min a stop. */
export function rideMinutes(stops, coordsOf) {
  let min = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = coordsOf?.(stops[i - 1]), b = coordsOf?.(stops[i]);
    if (!a || !b) { min += 2.5; continue; }
    const km = haversineKm(a, b);
    min += 0.5 + km / 0.94;
  }
  return Math.max(2, Math.round(min));
}
function haversineKm([lat1, lng1], [lat2, lng2]) {
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
export const distanceKm = haversineKm;
