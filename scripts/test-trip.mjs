// Data-integrity checks + a Monte Carlo run of the trip planner.
//   node scripts/test-trip.mjs
import fs from 'fs';
import assert from 'assert/strict';
import { metroLines } from '../metro-lines.js';
import { STATIONS } from '../metro-map.js';
import { STATION_COORDS } from '../station-coords.js';
import { planTrip, HUBS, linesServing, platformLines, rideStops, rideMinutes, DISTANCES, shortlist } from '../trip.js';
import { indexPlaces, dataKey, roster, venueOrder, matches, isChain, CATEGORIES } from '../places.js';

const raw = JSON.parse(fs.readFileSync(new URL('../places.json', import.meta.url), 'utf8'));
const places = indexPlaces(raw);
const at = s => places[dataKey(s)] ?? [];
const hasMood = (s, mood) => at(s).some(p => matches(p, mood));
const coordsOf = s => STATION_COORDS[dataKey(s)];
const all = [...new Set(metroLines.flatMap(l => l.stations))];
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  ✗', msg); } };

console.log('— data integrity');
check(all.length === 98, `expected 98 stations, got ${all.length}`);
for (const s of all) {
  check(STATIONS[s], `no map position for ${s}`);
  check(coordsOf(s), `no coordinates for ${s} (data key "${dataKey(s)}")`);
}
for (const h of HUBS) check(linesServing(h).length > 1, `hub ${h} serves only one line`);
for (const k of Object.keys(places)) check(all.some(s => dataKey(s) === k), `places key "${k}" isn't reachable`);
console.log(`  ${all.length} stations · ${HUBS.length} hubs · ${Object.values(places).flat().length} places kept of ${Object.values(raw).flat().length}`);
console.log('  stations with no places:', all.filter(s => !at(s).length).join(', ') || 'none');

console.log('— chain filter spot checks');
for (const [name, want] of [["Papa Johns Pizza", true], ["Nando's PERi-PERi", true], ["&pizza", true], ["Wiseguy Pizza", false],
                            ["Roscoe's Pizzeria", false], ["Compass Coffee", false], ["Target", true], ["Targeted Fitness", false],
                            ["Marshalls", true], ["Marshall's Bar & Grille", false], ["Roti", true], ["Roti Rolls", false]])
  check(isChain(name) === want, `isChain("${name}") should be ${want}`);

console.log('— planner (Monte Carlo)');
let seed = 42;
const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const moods = ['Coffee', 'Drinks', 'Food', 'Activity', 'Shopping', 'Surprise'];
const stats = {};
let swaps = 0, runs = 0;
const shortlistSizes = [];
for (const distance of Object.keys(DISTANCES)) for (const mood of moods) {
  const st = stats[`${distance}/${mood}`] = { n: 0, moodMiss: 0, bandMiss: 0, stops: 0, relaxed: {} };
  for (const line of metroLines) for (const start of line.stations) for (let r = 0; r < 4; r++) {
    const t = planTrip({ start, line, mood, distance, hasMood, rng });
    const L = metroLines.find(l => l.name === t.line);
    const i = L.stations.indexOf(start), j = L.stations.indexOf(t.dest);
    assert(i >= 0 && j >= 0 && i !== j, `bad trip ${JSON.stringify(t)}`);
    assert.equal(Math.abs(i - j), t.numStops);
    assert.equal(t.terminal, j < i ? L.stations[0] : L.stations.at(-1));
    assert.equal(rideStops(t.line, start, t.dest).length, t.numStops + 1);
    /* the mystery shortlist is honest: it holds the real stop, all on this line and
       direction, in riding order, and it's never so short it gives the game away */
    const ks = t.candidates.map(s => (L.stations.indexOf(s) - i) * Math.sign(j - i));
    assert(t.candidates.includes(t.dest), `shortlist misses the stop: ${JSON.stringify(t)}`);
    assert(ks.every((k, n) => k > 0 && (n === 0 || k > ks[n - 1])), `shortlist out of order: ${JSON.stringify(t)}`);
    const room = j > i ? L.stations.length - 1 - i : i;
    assert(t.candidates.length >= Math.min(3, room), `shortlist too short: ${JSON.stringify(t)}`);
    shortlistSizes.push(t.candidates.length);
    st.n++; st.stops += t.numStops; runs++;
    if (mood !== 'Surprise' && !hasMood(t.dest, mood)) st.moodMiss++;
    const b = DISTANCES[distance];
    if (t.numStops < b.min || t.numStops > b.max) st.bandMiss++;
    if (t.relaxed) st.relaxed[t.relaxed] = (st.relaxed[t.relaxed] ?? 0) + 1;
    if (t.line !== line.name) swaps++;
  }
}
const pct = (a, n) => `${(100 * a / n).toFixed(1)}%`.padStart(6);
console.log('  band/mood            mood miss  band miss  avg stops  relaxed');
for (const [k, s] of Object.entries(stats))
  console.log(`  ${k.padEnd(20)} ${pct(s.moodMiss, s.n)}     ${pct(s.bandMiss, s.n)}     ${(s.stops / s.n).toFixed(1).padStart(5)}    ${JSON.stringify(s.relaxed)}`);
console.log(`  line changed from the one picked: ${pct(swaps, runs)} (only where lines share a platform)`);
check(Object.entries(stats).every(([k, s]) => k.endsWith('Surprise') || s.moodMiss / s.n < 0.01), 'mood miss rate should be ~0');

shortlistSizes.sort((a, b) => a - b);
console.log(`  mystery shortlist size: median ${shortlistSizes[shortlistSizes.length >> 1]}, min ${shortlistSizes[0]}, max ${shortlistSizes.at(-1)}`);

console.log('— shortlists for shared / daily rides');
for (const [l, a, b] of [['Red', 'Rhode Island Ave', 'Metro Center'], ['Silver', 'Ashburn', 'Downtown Largo'], ['Red', 'Twinbrook', 'Shady Grove'], ['Green', 'Fort Totten', 'Georgia Ave–Petworth']]) {
  const s = shortlist(l, a, b);
  check(s.includes(b), `shortlist(${l}, ${a}, ${b}) misses the stop`);
  console.log(`  ${a} → ${b}: ${s.join(', ')}`);
}

console.log('— shared platforms');
for (const [line, st] of [['Orange', 'Ballston–MU'], ['Red', 'Metro Center'], ['Yellow', "L'Enfant Plaza"], ['Blue', 'Pentagon'], ['Red', 'Fort Totten']])
  console.log(`  ${st} on ${line}: ${platformLines(metroLines.find(l => l.name === line), st).map(l => l.name).join(' + ')}`);

console.log('— venue pools match roster counts');
for (const s of all) {
  const list = at(s), r = roster(list);
  for (const c of CATEGORIES) check(venueOrder(list, c, rng).length === r.counts[c], `${s} ${c}: roster ${r.counts[c]} vs pool`);
}

console.log('— ride time sanity');
for (const [l, a, b] of [['Red', 'Shady Grove', 'Glenmont'], ['Red', 'Gallery Place', 'Takoma'], ['Silver', 'Ashburn', 'Downtown Largo'], ['Orange', 'Rosslyn', 'Foggy Bottom–GWU']])
  console.log(`  ${l} ${a} → ${b}: ${rideStops(l, a, b).length - 1} stops, ~${rideMinutes(rideStops(l, a, b), coordsOf)} min`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
