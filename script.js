/* ==================================================================
   The Metro Game — app logic
   ================================================================== */
import { metroLines, shortName } from './metro-lines.js';
import { renderSystemMap, animateTrip, ambientTrains, LINE_COLORS, UNIT } from './metro-map.js';
import { planTrip, HUBS, linesServing, platformLines, lineByName, rideStops, rideMinutes, DISTANCES, distanceKm, shortlist } from './trip.js';
import { indexPlaces, dataKey, roster, venueOrder, matches, walkInfo, CATEGORIES, CATEGORY_WORD } from './places.js';
import { STATION_COORDS } from './station-coords.js';
import * as store from './store.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pick = arr => arr[Math.random() * arr.length | 0];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coordsOf = s => STATION_COORDS[dataKey(s)];
const TOTAL_STATIONS = new Set(metroLines.flatMap(l => l.stations)).size;
const dots = lines => `<span class="dots" aria-hidden="true">${lines.map(l => `<i style="background:${l.color}"></i>`).join('')}</span>`;

/* ------------------------------------------------------------------
   Places data — loaded in the background; only needed once you pick a mood
   ------------------------------------------------------------------ */
let places = {};
let placesPromise = null;
function loadPlaces() {
  placesPromise ??= fetch('./places.json')
    .then(r => { if (!r.ok) throw new Error(`Couldn't load places (${r.status})`); return r.json(); })
    .then(raw => (places = indexPlaces(raw)))
    .catch(e => { placesPromise = null; throw e; });
  return placesPromise;
}
const placesAt = s => places[dataKey(s)] ?? [];
const hasMood  = (s, mood) => placesAt(s).some(p => matches(p, mood));

/* ------------------------------------------------------------------
   State
   ------------------------------------------------------------------ */
const sel = { line: null, start: null, fromHub: false, mood: null };   // choices before a trip exists
let trip = null;                 // the trip in progress (mirrored to localStorage)
let tripTimeline = null;
let venue = null;                // { mood, order, idx, note }

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  window.__metroBooted = true;                            // tells index.html's load watchdog we're alive
  $('#year').textContent = new Date().getFullYear();
  drawIntroMap();

  $('#start-btn').addEventListener('click', () => { renderLineSelection(); go('line'); });
  $('#home-btn').addEventListener('click', () => go('intro'));
  $('#resume-btn').addEventListener('click', resumeTrip);
  $('#discard-btn').addEventListener('click', () => { store.clearTrip(); trip = null; refreshIntro(); });
  $('#passport-link').addEventListener('click', () => go('passport'));
  $('#daily-btn').addEventListener('click', startDailyRide);
  $('#play-again').addEventListener('click', restart);
  $('#start-over-btn').addEventListener('click', restart);
  $('#passport-new').addEventListener('click', () => { renderLineSelection(); go('line'); });
  $('#board-btn').addEventListener('click', board);
  $('#venue-btn').addEventListener('click', showVenue);
  $('#share-btn').addEventListener('click', shareRide);
  $('#passport-share').addEventListener('click', sharePassport);
  wireMoodScreen();
  wireTicket();
  wireRide();

  loadPlaces().catch(() => {});                           // warm it up; errors surface on the mood screen
  history.replaceState({ screen: 'intro' }, '');
  refreshIntro();
  openSharedRide();
  addEventListener("hashchange", openSharedRide);       // a ride link opened in a tab that already has the game
  registerServiceWorker();
});

/* ------------------------------------------------------------------
   Navigation — every screen is a history entry, so Back works
   ------------------------------------------------------------------ */
const SCREENS = {
  intro: 'intro-screen', line: 'line-screen', station: 'station-screen', mood: 'mood-screen',
  trip: 'trip-screen', ride: 'ride-screen', arrival: 'arrival-screen', venue: 'venue-screen', passport: 'passport-screen'
};
let current = 'intro';

function go(name, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState']({ screen: name }, '');
  enter(name);
}
window.addEventListener('popstate', e => {
  const name = e.state?.screen ?? 'intro';
  enter(canEnter(name) ? name : 'intro');
});

function canEnter(name) {
  switch (name) {
    case 'station': return !!sel.line;
    case 'mood':    return !!sel.start;
    case 'trip': case 'ride': return !!trip;
    case 'arrival': return trip?.phase === 'arrived';
    case 'venue':   return trip?.phase === 'arrived' && venue?.tripId === trip.id;
    default:        return true;
  }
}

/* Screens are built lazily, so a Back into history from before a reload
   (or from an older trip) rebuilds what it needs instead of showing a blank. */
let ticketFor = null, arrivalFor = null;
function prepare(name) {
  if (name === 'line' && !$('#line-screen').children.length) renderLineSelection();
  if (name === 'trip' && ticketFor !== trip.id) { runTrip(trip, { animate: false }); return; }
  if (name === 'trip') tripTimeline?.progress(1);         // coming back to a ticket: show it finished
  if (name === 'arrival' && arrivalFor !== trip.id) renderArrival(trip.stamp ?? { isNew: false, visits: 1 });
  if (name === 'ride') renderRide();
  if (name === 'passport') renderPassport();
}

const STEP = { line: 0, station: 0, mood: 1, trip: 2, ride: 3, arrival: 4, venue: 4 };
function setProgress(name) {
  const step = STEP[name];
  document.body.classList.toggle('has-progress', step != null);
  $('#progress').style.setProperty('--step', step ?? 0);
  $$('#progress li').forEach((li, i) => {
    li.className = i < step ? 'done' : i === step ? 'current' : '';
    if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
}

function enter(name) {
  current = name;
  document.body.classList.toggle('started', name !== 'intro');
  setProgress(name);
  if (name === 'intro') refreshIntro();
  if (name === 'intro') introTrains?.play(); else introTrains?.pause();
  prepare(name);
  keepAwake(name === 'ride');
  showScreen(SCREENS[name]);
}

function showScreen(id) {
  const next = document.getElementById(id);
  if (next.classList.contains('active')) return;

  $$('.screen.active').forEach(el => {
    el.classList.add('slide-out');
    el.classList.remove('active');
    const done = e => {
      if (e && e.target !== el) return;                    // a child's transition bubbled up
      el.removeEventListener('transitionend', done);
      if (el.classList.contains('active')) return;         // we came back before the fade finished
      el.hidden = true; el.classList.remove('slide-out');
    };
    el.addEventListener('transitionend', done);
    setTimeout(done, 500);                                // safety net
  });

  next.hidden = false;
  next.classList.remove('slide-out');
  next.scrollTop = 0;
  next.classList.add('slide-in');
  reflow(next);                                          // commit the start state, then transition
  next.classList.remove('slide-in');
  next.classList.add('active');
  $('[tabindex="-1"]', next)?.focus({ preventScroll: true });
}

/* Forces style recalculation so a class swap animates instead of snapping */
const reflow = el => void el.offsetHeight;

/* ------------------------------------------------------------------
   Intro: the map draws itself in; resume card + passport link
   ------------------------------------------------------------------ */
let introTrains = null;
function drawIntroMap() {
  const svg = $('#intro-map');
  const map = renderSystemMap(svg);
  const { bounds, layers } = map;
  const frame = () => {
    const aspect = innerWidth / Math.max(1, innerHeight);
    if (aspect < 0.9) {                                  // tall screens: frame downtown so lines radiate past the logo
      const h = bounds.h * 1.05, w = h * aspect;
      svg.setAttribute('viewBox', `${300 - w / 2} ${326 - h / 2} ${w} ${h}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    } else {
      svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
  };
  frame();
  addEventListener('resize', frame);
  if (reducedMotion) return;
  [...layers.lines.children, ...layers.casings.children].forEach(p => {
    p.setAttribute('pathLength', 1);
    p.style.animationDelay = `${0.12 * ['Red', 'Green', 'Yellow', 'Blue', 'Silver', 'Orange'].indexOf(p.dataset.line)}s`;
    p.classList.add('draw');
  });
  introTrains = ambientTrains(map, 3);                     // a few trains drift along once the lines are in
}

function refreshIntro() {
  const t = store.activeTrip();
  $('#resume-card').hidden = !t;
  if (t) {
    $('.resume-eyebrow').textContent = t.phase === 'arrived' ? 'You’ve arrived' : t.phase === 'ride' ? 'You’re mid-ride' : 'Ticket waiting';
    const left = t.numStops - t.passed;
    $('#resume-text').textContent =
      t.phase === 'arrived' ? `You made it to ${shortName(t.dest)}. Your place is waiting.`
    : t.phase === 'ride'    ? (isMystery(t) && !t.peeked
                                ? `Riding the ${t.line} Line toward ${shortName(t.terminal)}. We’ll tell you when to get off.`
                                : `${plural(left, 'stop')} to go on the ${t.line} Line toward ${shortName(t.terminal)}.`)
    :                         `Your ticket from ${shortName(t.start)} is ready: ${t.line} Line toward ${shortName(t.terminal)}.`;
  }
  const n = store.stampCount(), link = $('#passport-link');
  link.hidden = !n;
  link.textContent = `Your passport · ${plural(n, 'station')}`;
  $('#daily-btn').textContent = `Today’s ride · from ${shortName(dailyPlan().start)}`;
}

/* ------------------------------------------------------------------
   Today's ride — the same mystery trip for everyone, all day (DC time)
   ------------------------------------------------------------------ */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
function seededRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (const ch of seed) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function dailyPlan() {
  const rng = seededRng(`metro-game:${today()}`);
  const start = HUBS[Math.floor(rng() * HUBS.length)];
  return planTrip({ start, fromHub: true, mood: 'Surprise', distance: 'wander', rng });
}
function startDailyRide() {
  const prefs = store.prefs();
  trip = makeTrip(dailyPlan(), { mood: 'Surprise', distance: 'wander', mystery: prefs.mystery, chosenLine: null, daily: today() });
  runTrip(trip);
}

function resumeTrip() {
  trip = store.activeTrip();
  if (!trip) { refreshIntro(); return; }
  sel.mood = trip.mood;
  if (trip.phase === 'arrived') { showVenue(); return; }
  if (trip.phase === 'ride') { go('ride'); return; }
  runTrip(trip, { animate: false });
}

/* ------------------------------------------------------------------
   Slot-machine counter (GSAP) — returns the timeline
   ------------------------------------------------------------------ */
function gsapSlot(el, items, finalText, hops = 30) {
  const tl = gsap.timeline();
  const minHop = 0.04, maxHop = 0.18, ease = t => t * t;
  for (let i = 0; i < hops; i++) {
    const progress = i / (hops - 1);
    const dur = gsap.utils.interpolate(minHop, maxHop, ease(progress));
    const text = (i === hops - 1) ? finalText : items[i % items.length];
    tl.to({}, { duration: dur, onStart: () => (el.textContent = text) });
  }
  return tl;
}

/* ------------------------------------------------------------------
   LINE picker
   ------------------------------------------------------------------ */
const bullet = (line, cls = 'bullet') => `<span class="${cls}" style="background:${line.color};color:${line.text}">${line.code}</span>`;
const END_NAME = { "Franconia–Springfield": "Franconia" };
const endName = s => END_NAME[s] ?? shortName(s);
const ALL_STATIONS = [...new Set(metroLines.flatMap(l => l.stations))].sort((a, b) => a.localeCompare(b));

/* Start anywhere: one line → that line; several → first train in */
function startAt(station) {
  const lines = linesServing(station);
  sel.start = station;
  sel.fromHub = lines.length > 1;
  sel.line = lines.length > 1 ? null : lines[0];
  renderMood();
  go('mood');
}

function renderLineSelection() {
  const screen = $('#line-screen');
  screen.innerHTML = `
    <div class="screen-body">
      <h2 class="screen-title" tabindex="-1">Where are you starting?</h2>
      <div id="locate-slot" class="locate-slot">
        <button id="locate-btn" class="btn btn-primary btn-wide" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          Use my location</button>
      </div>
      <div class="search-all">
        <label class="visually-hidden" for="all-search">Search all stations</label>
        <input id="all-search" class="station-search" type="search" placeholder="Search all ${ALL_STATIONS.length} stations…" autocomplete="off">
        <div id="all-results" class="search-results" hidden></div>
      </div>
      <p class="section-label">Or pick a line</p>
      <div id="line-picker" class="line-list"></div>
      <p class="section-label">Or start at a transfer hub and take the first train in</p>
      <div id="hub-picker" class="hub-chips"></div>
    </div>`;

  $('#line-picker', screen).innerHTML = metroLines.map((l, idx) =>
    `<button type="button" class="line-row" data-idx="${idx}">${bullet(l)}<span class="ln-name">${l.name}</span>
       <span class="ln-ends">${endName(l.stations[0])} ↔ ${endName(l.stations.at(-1))}</span></button>`).join('');
  $('#line-picker', screen).addEventListener('click', e => {
    const t = e.target.closest('.line-row');
    if (!t) return;
    sel.line = metroLines[Number(t.dataset.idx)];
    sel.fromHub = false;
    renderStationSelection();
    go('station');
  });

  $('#hub-picker', screen).innerHTML = HUBS.map(h =>
    `<button type="button" class="hub-chip" data-hub="${h}">${dots(linesServing(h))}${shortName(h)}</button>`).join('');
  $('#hub-picker', screen).addEventListener('click', e => {
    const t = e.target.closest('.hub-chip');
    if (t) startAt(t.dataset.hub);
  });

  /* search every station */
  const input = $('#all-search', screen), results = $('#all-results', screen);
  const matchesQ = q => ALL_STATIONS.filter(s => s.toLowerCase().includes(q) || shortName(s).toLowerCase().includes(q)).slice(0, 6);
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const found = q ? matchesQ(q) : [];
    results.hidden = !q;
    results.innerHTML = found.length
      ? found.map(s => `<button type="button" data-station="${s}">${dots(linesServing(s))}<span>${shortName(s)}</span></button>`).join('')
      : '<p class="empty">No station matches that.</p>';
  });
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = matchesQ(input.value.trim().toLowerCase())[0];
    if (first) startAt(first);
  });
  results.addEventListener('click', e => {
    const b = e.target.closest('button[data-station]');
    if (b) startAt(b.dataset.station);
  });

  $('#locate-btn', screen).addEventListener('click', locate);
}

/* Nearest station from the phone's location */
function locate() {
  const btn = $('#locate-btn');
  if (!('geolocation' in navigator)) { toast('Your browser can’t share a location. Search instead.'); return; }
  btn.disabled = true; btn.lastChild.textContent = ' Finding you…';
  navigator.geolocation.getCurrentPosition(pos => {
    const me = [pos.coords.latitude, pos.coords.longitude];
    let best = null, bestKm = Infinity;
    for (const s of ALL_STATIONS) {
      const c = coordsOf(s); if (!c) continue;
      const km = distanceKm(me, c);
      if (km < bestKm) { best = s; bestKm = km; }
    }
    const far = bestKm > 3;
    const walk = far ? `${bestKm.toFixed(1)} km away` : `${Math.max(1, Math.round(bestKm * 1000 / 80))} min walk`;
    $('#locate-slot').innerHTML = `
      <button type="button" class="nearest" id="nearest-btn">
        <span class="nearest-text"><small>Nearest station · ${walk}</small><b>${shortName(best)}</b></span>
        ${dots(linesServing(best))}<span class="nearest-go">Start here</span>
      </button>`;
    $('#nearest-btn').addEventListener('click', () => startAt(best));
  }, () => {
    btn.disabled = false; btn.lastChild.textContent = ' Use my location';
    toast('Couldn’t get your location. Search for your station instead.');
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

/* ------------------------------------------------------------------
   STATION picker (strip map)
   ------------------------------------------------------------------ */
function renderStationSelection() {
  const screen = $('#station-screen');
  const line = sel.line;
  screen.innerHTML = `
    <div class="screen-body">
      <h2 class="screen-title line-title" tabindex="-1">${bullet(line, 'chip')}<span>${line.name} Line</span></h2>
      <p class="subtitle">Choose your starting station</p>
      <input id="station-search" class="station-search" type="search" placeholder="Search stations…" autocomplete="off" aria-label="Search stations">
      <div id="station-picker" class="strip" style="--line-color:${line.color}"></div>
      <button id="back-btn" class="text-link back-link" type="button">← Back</button>
    </div>`;

  const sp = $('#station-picker', screen);
  const last = line.stations.length - 1;
  line.stations.forEach((stop, i) => {
    const others = linesServing(stop).filter(l => l !== line);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'station-btn' + (i === 0 ? ' first' : '') + (i === last ? ' last' : '')
                + (others.length ? ' transfer' : '') + ((i === 0 || i === last) ? ' terminus' : '');
    b.dataset.station = stop;
    b.innerHTML = `<span class="dot"></span><span class="name">${shortName(stop)}</span>
                   <span class="xfer" aria-hidden="true">${others.map(l => `<i style="background:${l.color}"></i>`).join('')}</span>`;
    sp.appendChild(b);
  });

  const choose = station => {
    sel.start = station;
    renderMood();
    go('mood');
  };
  sp.addEventListener('click', e => {
    const t = e.target.closest('.station-btn');
    if (t) choose(t.dataset.station);
  });

  /* live search */
  const search = $('#station-search', screen);
  const rows = $$('.station-btn', sp);
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach(btn => {
      const show = !q || btn.dataset.station.toLowerCase().includes(q) || shortName(btn.dataset.station).toLowerCase().includes(q);
      btn.hidden = !show;
      if (show) visible++;
    });
    let empty = $('.empty', sp);
    if (!visible) {
      if (!empty) { empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No station matches that.'; sp.appendChild(empty); }
    } else empty?.remove();
  });
  search.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = rows.find(r => !r.hidden);
    if (first) choose(first.dataset.station);
  });

  $('#back-btn', screen).addEventListener('click', () => history.back());
}

/* ------------------------------------------------------------------
   MOOD + HOW FAR + mystery
   ------------------------------------------------------------------ */
const startLines = () => sel.fromHub ? linesServing(sel.start) : platformLines(sel.line, sel.start);

function renderMood() {
  const lines = startLines();
  const which = lines.length < 2 ? ''
              : sel.fromHub ? ' · any line, first train in'
              : ` · ${lines.map(l => l.name).join(' or ')}, first train in`;
  $('#mood-origin').innerHTML = `${dots(lines)}<span>From ${shortName(sel.start)}${which}</span>`;
  $('#mood-error').hidden = true;
  syncMoodControls();
}

function syncMoodControls() {
  const prefs = store.prefs();
  $$('.cat-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === sel.mood)));
  $$('#distance-picker button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.distance === prefs.distance)));
  $('#mystery-toggle').setAttribute('aria-checked', String(prefs.mystery));
  $('#mystery-sub').textContent = prefs.mystery ? 'Your stop stays secret until you arrive' : 'You’ll see your stop before you board';
  $('#go-btn').disabled = !sel.mood;
  $('#mood-promise').textContent =
      !sel.mood ? 'Pick a mood and we’ll find a stop that has it.'
    : sel.mood === 'Surprise' ? 'Any stop on the line is fair game.'
    : `Only stops with ${CATEGORY_WORD[sel.mood]} nearby go into the draw.`;
}

function wireMoodScreen() {
  $('#mood-back-btn').addEventListener('click', () => history.back());
  $('#category-grid').addEventListener('click', e => {
    const b = e.target.closest('.cat-btn');
    if (!b) return;
    sel.mood = b.dataset.cat;
    syncMoodControls();
  });
  $('#distance-picker').addEventListener('click', e => {
    const b = e.target.closest('button[data-distance]');
    if (!b) return;
    store.setPref('distance', b.dataset.distance);
    syncMoodControls();
  });
  $('#mystery-toggle').addEventListener('click', () => {
    store.setPref('mystery', !store.prefs().mystery);
    syncMoodControls();
  });
  $('#go-btn').addEventListener('click', findTrain);
  $('#retry-btn').addEventListener('click', findTrain);
}

async function findTrain() {
  const btn = $('#go-btn');
  btn.disabled = true; btn.textContent = 'Loading places…';
  try {
    await loadPlaces();
  } catch (e) {
    console.error(e);
    $('#mood-error').hidden = false;
    btn.disabled = false; btn.textContent = 'Find my train';
    return;
  }
  btn.textContent = 'Find my train'; btn.disabled = false;
  $('#mood-error').hidden = true;

  const prefs = store.prefs();
  const plan = planTrip({ start: sel.start, line: sel.line, fromHub: sel.fromHub,
                          mood: sel.mood, distance: prefs.distance, hasMood });
  trip = makeTrip(plan, { mood: sel.mood, distance: prefs.distance, mystery: prefs.mystery,
                          chosenLine: sel.fromHub ? null : sel.line.name });
  runTrip(trip);
}

function makeTrip(plan, extra) {
  const t = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...plan, ...extra,
              peeked: false, passed: 0, phase: 'board', createdAt: Date.now(),
              minutes: rideMinutes(rideStops(plan.line, plan.start, plan.dest), coordsOf) };
  store.saveTrip(t);
  return t;
}

/* ------------------------------------------------------------------
   TRIP reveal (the ticket)
   ------------------------------------------------------------------ */
let skipNow = null;                                       // fast-forwards the reveal when set

function wireTicket() {
  const skip = () => skipNow?.();
  $('#result-card').addEventListener('click', e => { if (!e.target.closest('button')) skip(); });
  $('#skip-hint').addEventListener('click', skip);
  $('#peek-btn').addEventListener('click', () => {
    trip.peeked = !trip.peeked;
    store.updateTrip({ peeked: trip.peeked });
    showPeek();
  });
}

function showPeek() {
  const peeked = trip.peeked;
  $('#peek-btn').textContent = peeked ? 'Hide it again' : 'Peek at my stop';
  $('#peek-btn').setAttribute('aria-pressed', String(peeked));
  $('#arrival-text').textContent = peeked ? `You’ll get off at ${trip.dest}, ${plural(trip.numStops, 'stop')} in.`
                                          : 'We’ll tell you when to get off.';
  $$('#shortlist .chip-stop').forEach(c => c.classList.toggle('is-it', peeked && c.dataset.station === trip.dest));
  if (peeked) tripTimeline?.reveal?.(trip.dest); else tripTimeline?.unreveal?.();
}

/* ---- mystery helpers: the shortlist is the only distance a mystery trip shows ---- */
const NB = ' ';
const candidatesOf = t => t.candidates?.length ? t.candidates : [t.dest];
const isMystery = t => t.mystery && candidatesOf(t).length > 1;      // a one-stop shortlist can't be a secret
const stopsAway = (t, s) => { const st = lineByName(t.line).stations; return Math.abs(st.indexOf(s) - st.indexOf(t.start)); };
const minutesTo = (t, s) => rideMinutes(rideStops(t.line, t.start, s), coordsOf);

function renderShortlist(t) {
  const box = $('#shortlist'), cands = candidatesOf(t);
  box.hidden = !isMystery(t);
  if (box.hidden) return;
  box.innerHTML = cands.length <= 6
    ? `<p>It’s one of these:</p>${cands.map(s => `<span class="chip-stop" data-station="${escapeHTML(s)}">${escapeHTML(shortName(s))}</span>`).join('')}`
    : `<p>It’s one of the ${cands.length} stops from <b>${escapeHTML(shortName(cands[0]))}</b> to <b>${escapeHTML(shortName(cands.at(-1)))}</b>.</p>`;
}

function tripNote(t) {
  const notes = [];
  const word = CATEGORY_WORD[t.mood];
  const band = DISTANCES[t.distance];
  const way = band && t.numStops > band.max ? 'longer' : 'shorter';
  if (t.relaxed === 'distance')
    notes.push(word ? `Nothing with ${word} at that distance, so this ride is a little ${way} than you asked.`
                    : `There aren’t enough stops left on the line for that, so this ride is a little ${way}.`);
  if (t.relaxed === 'mood' || t.relaxed === 'both') notes.push(`No ${word} spots along this line from here, so you get a surprise instead.`);
  if (t.daily) notes.push(`Today’s ride is the same for everyone. Board at ${shortName(t.start)}.`);
  else if (t.fromShare) notes.push(`A friend sent you this ride. Start at ${shortName(t.start)}.`);
  else if (t.chosenLine && t.chosenLine !== t.line)
    notes.push(`${t.lineChoices.join(' and ')} trains share this platform, and the first one in was ${t.line}.`);
  else if (!t.chosenLine && t.lineChoices.length > 1) notes.push(`Fate picked the ${t.line} Line.`);
  return notes.join(' ');
}

async function runTrip(t, { animate = true } = {}) {
  const token = Symbol();                                // guards against restarts mid-animation
  runTrip.token = token;
  ticketFor = t.id;
  const live = () => runTrip.token === token;
  let fast = !animate || reducedMotion;
  let wake = null;
  const sleep = s => new Promise(r => { const id = setTimeout(r, s * 1000); wake = () => { clearTimeout(id); r(); }; });
  const play = tl => { if (fast) tl.progress(1); return tl; };
  let active = [];
  skipNow = () => { fast = true; wake?.(); active.forEach(tl => tl.progress(1)); };

  const screen   = $('#trip-screen');
  const card     = $('#result-card', screen);
  const btns     = $('.trip-buttons', screen);
  const arrival  = $('#arrival-text', screen);
  const pill     = $('#ticket-line', screen);
  const dir      = $('#ticket-dir', screen);
  const svg      = $('#trip-map', screen);
  const line     = lineByName(t.line);

  /* reset */
  tripTimeline?.kill(); tripTimeline = null;
  card.hidden = true; card.classList.remove('active');
  btns.hidden = true; btns.classList.remove('fade-in');
  arrival.textContent = ''; gsap.set(arrival, { opacity: 0, y: 12 });
  svg.innerHTML = '';
  $('#peek-row').hidden = true;
  $('#skip-hint').hidden = false;
  const note = tripNote(t);
  $('#trip-note').textContent = note; $('#trip-note').hidden = !note;
  const secret = isMystery(t), cands = candidatesOf(t);
  $('#stop-number', screen).textContent = '?';
  $('#stops-word', screen).textContent = 'stops';
  $('#trip-origin', screen).innerHTML = secret
    ? `from ${escapeHTML(shortName(t.start))}<br>${stopsAway(t, cands[0])}–${stopsAway(t, cands.at(-1))} stops out · ${minutesTo(t, cands[0])}–${minutesTo(t, cands.at(-1))}${NB}min`
    : `from ${escapeHTML(shortName(t.start))}<br>about ${t.minutes}${NB}min on the train`;
  $('#shortlist').hidden = true;
  pill.innerHTML = `<b class="pill-code" style="color:${line.name === 'Red' ? line.color : '#1d1d1f'}">${line.code}</b>${t.line} Line`;
  pill.style.background = line.color; pill.style.color = line.text;
  dir.textContent = `toward ${shortName(t.terminal)}`;
  gsap.set(pill, { scaleX: 0 }); gsap.set(dir, { opacity: 0, x: -8 });

  if (current !== 'trip') go('trip');

  /* 1. the departure board finds your train */
  const board = renderBoard(t, fast);
  if (!fast) await sleep(1.4);
  if (!live()) return;
  board.boarding();

  /* 2. ticket shell + line/direction */
  card.hidden = false;
  reflow(card);
  card.classList.add('active');
  const head = gsap.timeline({ delay: 0.25 })
    .to(pill, { scaleX: 1, duration: 0.4, ease: 'power2.out' })
    .to(dir,  { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }, '-=0.1');
  active = [head]; await play(head);
  if (!live()) return;

  /* 3. stop counter */
  const counter = $('#stop-number', screen);
  const final = secret ? '?' : `${t.numStops}`;
  const slot = gsapSlot(counter, Array.from({ length: 15 }, (_, i) => `${i + 1}`), final, 22);
  active = [slot]; await play(slot);
  if (!live()) return;
  counter.textContent = final;
  $('#stops-word', screen).textContent = secret ? `Your stop is one of ${cands.length}` : t.numStops === 1 ? 'stop' : 'stops';
  board.ticker(secret ? `${t.line.toUpperCase()} LINE · STAY ON TILL WE SAY`
                      : `${t.line.toUpperCase()} LINE · ${t.numStops} STOP${t.numStops === 1 ? '' : 'S'}`);

  /* 4. the map */
  tripTimeline = animateTrip(svg, { line: t.line, from: t.start, to: t.dest, labelFor: shortName,
                                    mystery: secret, toward: t.terminal, candidates: cands });
  active = [tripTimeline]; await play(tripTimeline);
  if (!live()) return;
  $('#skip-hint').hidden = true;
  skipNow = null;

  /* 5. arrival line + buttons */
  if (secret) {
    renderShortlist(t);
    $('#peek-row').hidden = false;
    showPeek();
  } else {
    arrival.textContent = `You’ll get off at ${t.dest}.`;
  }
  gsap.to(arrival, { opacity: 1, y: 0, duration: fast ? 0 : 0.5, ease: 'power2.out' });
  btns.hidden = false;
  reflow(btns);
  btns.classList.add('fade-in');
}

/* WMATA's arrival boards abbreviate terminals to fit */
const PIDS_DEST = {
  "Shady Grove": "Shady Grv", "New Carrollton": "NewCrltn", "Downtown Largo": "Largo",
  "Franconia–Springfield": "Frnconia", "Huntington": "Huntingtn", "Mount Vernon Square": "Mt Vernon", "Branch Ave": "Branch Av"
};
const LED = { Red: '#FF5252', Orange: '#FFAA45', Silver: '#E3E8E8', Blue: '#5CC8FF', Yellow: '#FFE45C', Green: '#55E07F' };

function renderBoard(t, fast) {
  const ours = lineByName(t.line);
  const others = [];
  for (const l of linesServing(t.start)) {
    const i = l.stations.indexOf(t.start);
    for (const end of [i > 0 && l.stations[0], i < l.stations.length - 1 && l.stations.at(-1)]) {
      if (end && !(l === ours && end === t.terminal)) others.push({ l, end });
    }
  }
  others.sort(() => Math.random() - 0.5).splice(2);
  let m = 1;
  const rows = [{ l: ours, end: t.terminal, cars: 8, min: 'ARR', mine: true },
                ...others.map(o => ({ ...o, cars: pick([6, 8]), min: (m += 2 + (Math.random() * 5 | 0)) }))];

  const box = $('#pids');
  $('#pids-rows').innerHTML = rows.map((r, i) =>
    `<div class="pids-row${r.mine ? ' mine' : ''}" style="animation-delay:${fast ? 0 : i * 0.18}s">
       <span style="color:${LED[r.l.name]}">${r.l.code}</span><span>${r.cars}</span>
       <span>${PIDS_DEST[r.end] ?? shortName(r.end)}</span><span class="min">${r.min}</span></div>`).join('');
  const ticker = $('#pids-ticker');
  ticker.textContent = 'FINDING YOUR TRAIN…';
  box.classList.toggle('instant', fast);
  box.hidden = false;
  return {
    boarding() { const min = $('.pids-row.mine .min', box); min.textContent = 'BRD'; min.classList.add('blink'); },
    ticker(text) { ticker.textContent = text; }
  };
}

function board() {
  trip.phase = 'ride';
  store.updateTrip({ phase: 'ride' });
  go('ride');
}

/* ------------------------------------------------------------------
   RIDE mode — count the stops with the player
   ------------------------------------------------------------------ */
let abandonArmed = null;

function wireRide() {
  $('#doors-btn').addEventListener('click', () => moveTrain(+1));
  $$('.undo-btn').forEach(b => b.addEventListener('click', () => moveTrain(-1)));
  $('#arrived-btn').addEventListener('click', arrive);
  $('#ride-quit').addEventListener('click', () => {
    const b = $('#ride-quit');
    if (abandonArmed) { clearTimeout(abandonArmed); abandonArmed = null; restart(); return; }
    b.textContent = 'Tap again to abandon this ride';
    abandonArmed = setTimeout(() => { abandonArmed = null; b.textContent = 'Abandon this ride'; }, 3000);
  });
}

function moveTrain(step) {
  const passed = Math.max(0, Math.min(trip.numStops, trip.passed + step));
  if (passed === trip.passed) return;
  trip.passed = passed;
  store.updateTrip({ passed });
  const left = trip.numStops - passed;
  if (step > 0 && left <= 1) navigator.vibrate?.(left ? [180, 80, 180] : 320);
  renderRide();
}

function renderRide() {
  if (!trip) return;
  /* Mystery: we know where you get off; you don't. The strip runs to the last stop it
     could be, every stop is named (you can read the signs anyway), and the stops that
     could be yours carry a "?" until the train passes them. We say when to get off. */
  const secret = isMystery(trip) && !trip.peeked;
  const cands = candidatesOf(trip);
  const stops = rideStops(trip.line, trip.start, secret ? cands.at(-1) : trip.dest);
  const total = trip.numStops, passed = trip.passed, left = total - passed;
  const line = lineByName(trip.line);
  const here = stops[passed], next = stops[passed + 1];
  const stillPossible = cands.filter(s => stops.indexOf(s) > passed).length;
  const justRuledOut = secret && passed > 0 && left > 0 && cands.includes(here);
  const toGo = `about ${rideMinutes(stops.slice(passed, total + 1), coordsOf)}${NB}min`;

  $('#ride-number').textContent = left === 0 ? '' : secret && left > 1 ? '?' : left;
  $('#ride-number').hidden = left === 0;
  $('#ride-title').textContent =
      left === 0 ? 'This is your stop.'
    : left === 1 ? (secret ? 'Get off at the next stop!' : 'Your stop is next')
    : secret     ? 'Stay on'
    :              `${left} stops to go`;
  $('#ride-sub').textContent =
      left === 0 ? (secret ? 'Step off, then find out where you are.' : `Welcome to ${shortName(trip.dest)}.`)
    : left === 1 ? `Next: ${shortName(next)}. Head for the doors.`
    : secret     ? `${justRuledOut ? `Not ${shortName(here)}. ` : ''}${stillPossible} stops could still be yours.`
    :              `${trip.line} Line toward ${shortName(trip.terminal)} · ${toGo}`;
  $('#doors-btn').textContent = next ? `Doors opened at ${shortName(next)}` : 'Doors opened';

  const strip = $('#ride-strip');
  strip.style.setProperty('--line-color', line.color);
  strip.innerHTML = stops.map((name, i) => {
    const short = shortName(name);
    const possible = secret && cands.includes(name);
    const isHere = i === passed, isNext = i === passed + 1;
    const ruledOut = possible && (i < passed || (isHere && left > 0) || (left === 0 && i > passed));
    const isDest = !secret && i === total;
    const state = isHere ? 'here' : isNext ? 'next' : i < passed || (left === 0 && i > passed) ? 'passed' : 'upcoming';
    let label = short;
    if (isHere && i === 0) label = `${short} · start`;
    else if (isNext) label = `Next: ${short}${left === 1 && secret ? ' <small>get off here</small>' : ''}`;
    if (ruledOut) label += ' <small>not this one</small>';
    if (isDest && i > passed + 1) label = `${short} · your stop`;
    const cls = [state, possible && !ruledOut && 'maybe', ruledOut && 'out', isDest && 'final'].filter(Boolean).join(' ');
    const marker = isHere ? '<span class="train"><i></i><i></i></span>'
                 : ruledOut ? '<span class="x">✕</span>'
                 : possible || isDest ? '<span class="q">?</span>' : '<span class="pt"></span>';
    return `<li class="${cls}"><span class="mark">${marker}</span><span class="label">${label}</span></li>`;
  }).join('');
  const focusRow = $('.next', strip) ?? $('.here', strip);
  if (focusRow) strip.scrollTo({ top: focusRow.offsetTop - strip.clientHeight / 2 + focusRow.offsetHeight / 2,
                                 behavior: reducedMotion ? 'auto' : 'smooth' });

  $('#ride-actions').hidden = left === 0;
  $('#ride-done').hidden = left > 0;
  $('.undo-wrap').hidden = passed === 0;
  $('#platform-edge').classList.toggle('lit', left <= 1);
}

/* Keep the screen on while riding (re-requested when the tab comes back) */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch { /* not supported or denied — no harm */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && current === 'ride') keepAwake(true);
});

/* ------------------------------------------------------------------
   ARRIVAL — the station sign + passport stamp
   ------------------------------------------------------------------ */
function arrive() {
  trip.phase = 'arrived'; trip.passed = trip.numStops;
  store.updateTrip({ phase: 'arrived', passed: trip.numStops });
  trip.stamp ??= store.stamp(trip);                      // remember the result, so a revisit doesn't say "back again"
  store.updateTrip({ stamp: trip.stamp });
  renderArrival(trip.stamp);
  go('arrival');
}

function renderArrival({ isNew, visits }) {
  arrivalFor = trip.id;
  const here = linesServing(trip.dest), line = lineByName(trip.line);
  const name = shortName(trip.dest);
  $('#sign-name').textContent = name;
  $('#sign-name').classList.toggle('long', name.length > 14);
  $('#sign-stripe').style.background = line.color;
  $('#pylon-stripes').innerHTML = here.map(l => `<i style="background:${l.color}"></i>`).join('');
  $('#sign-bullets').innerHTML = here.map(l => `<i style="background:${l.color};color:${l.text}">${l.code}</i>`).join('');
  $('#arrival-sub').textContent = `${plural(trip.numStops, 'stop')} on the ${trip.line} Line from ${shortName(trip.start)}, about ${trip.minutes} minutes on the train.`;
  $('#stamp-note').textContent = isNew ? `New stamp · ${store.stampCount()} of ${TOTAL_STATIONS} stations` : `Back again · visit #${visits}`;

  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  const ring = `${name.toUpperCase()} · ${trip.line.toUpperCase()} LINE · `;
  $('#stamp').innerHTML = `<svg viewBox="0 0 116 116">
      <defs><path id="stamp-ring" d="M58,58 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0"/></defs>
      <circle cx="58" cy="58" r="55" class="stamp-bg"/><circle cx="58" cy="58" r="31" class="stamp-inner"/>
      <text class="stamp-ring"><textPath href="#stamp-ring" textLength="252">${escapeHTML(ring.repeat(ring.length > 26 ? 1 : 2))}</textPath></text>
      <text x="58" y="55" class="stamp-date">${date}</text><text x="58" y="71" class="stamp-date">${new Date().getFullYear()}</text>
    </svg>`;
  const s = $('#stamp'); s.classList.remove('land'); reflow(s); s.classList.add('land');
}

/* ------------------------------------------------------------------
   VENUE reveal + re-roll + what's near the station
   ------------------------------------------------------------------ */
async function showVenue() {
  try { await loadPlaces(); }
  catch { toast('Couldn’t load the places list. Check your connection and try again.'); return; }
  venue = { tripId: trip.id, mood: trip.mood, order: [], idx: 0, note: '' };
  buildVenueOrder();
  const vs = $('#venue-screen');
  $('#venue-station').innerHTML = `${dots(linesServing(trip.dest))}<span>Near ${shortName(trip.dest)}</span>`;
  populateVenue(vs);
  renderRoster();
  $('#new-place-btn').onclick = () => {
    venue.idx = (venue.idx + 1) % venue.order.length;
    animateVenueSwap(vs);
  };
  go('venue');
}

function buildVenueOrder() {
  const list = placesAt(trip.dest);
  let order = venueOrder(list, venue.mood);
  venue.note = '';
  if (!order.length && list.length) {
    venue.note = `No ${CATEGORY_WORD[venue.mood]} spots in our guide near ${shortName(trip.dest)}, so here’s something else.`;
    order = venueOrder(list, 'Surprise');
  }
  venue.order = order;
  venue.idx = 0;
}

function animateVenueSwap(vs) {
  const lines = $$('.vline', vs);
  if (reducedMotion) { populateVenue(vs); return; }
  gsap.timeline()
    .to(lines, { x: -260, opacity: 0, duration: 0.26, stagger: 0.04, ease: 'power1.in' })
    .add(() => populateVenue(vs))
    .fromTo(lines, { x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, stagger: 0.04, ease: 'power1.out' });
}

function populateVenue(vs) {
  const nameEl = $('#venue-name', vs), meta = $('#venue-meta', vs), addr = $('#venue-address', vs),
        note = $('#venue-note', vs), msg = $('#venue-message', vs), maps = $('#venue-maps', vs),
        again = $('#new-place-btn', vs), count = $('#venue-count', vs);
  const dest = trip.dest, short = shortName(dest), here = coordsOf(dest);
  const v = venue.order[venue.idx];

  if (!v) {
    msg.textContent = 'Uncharted territory.';
    nameEl.textContent = short;
    meta.innerHTML = '';
    addr.textContent = '';
    note.textContent = `We don’t have any places listed near ${short} yet. Explore on your own, or start a new trip.`;
    maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`things to do near ${dest} Metro station`)}`;
    maps.textContent = 'Explore on Google Maps';
    again.hidden = true; count.textContent = '';
    return;
  }

  msg.textContent = 'You’re going to…';
  nameEl.textContent = v.name;
  addr.textContent = v.address ?? '';
  note.textContent = venue.note;

  const tags = [];
  const cat = (venue.mood && venue.mood !== 'Surprise' && v.categories.includes(venue.mood)) ? venue.mood : v.categories[0];
  if (cat) tags.push(`<span class="tag cat">${cat}</span>`);
  if (v.rating) {
    const n = v.user_ratings_total ? ` · ${new Intl.NumberFormat('en', { notation: 'compact' }).format(v.user_ratings_total)}` : '';
    tags.push(`<span class="tag">★ ${v.rating.toFixed(1)}${n}</span>`);
  }
  if (v.price_level > 0) tags.push(`<span class="tag">${'$'.repeat(v.price_level)}</span>`);
  const walk = walkInfo(v, here);
  if (walk.minutes) tags.push(`<span class="tag">${walk.minutes} min walk${walk.direction ? ` ${walk.direction}` : ''}</span>`);
  meta.innerHTML = tags.join('');

  const destQ = encodeURIComponent(`${v.name} ${v.address ?? ''}`.trim());
  maps.href = `https://www.google.com/maps/dir/?api=1${here ? `&origin=${here[0]},${here[1]}` : ''}&destination=${destQ}`
            + `${v.place_id ? `&destination_place_id=${v.place_id}` : ''}&travelmode=walking`;
  maps.textContent = 'Walk there';

  /* how many places this stop really has */
  const n = venue.order.length;
  const phrase = venue.note ? null : SPOTS[venue.mood];
  again.hidden = n < 2;
  count.textContent = !phrase ? `${venue.idx + 1} of ${plural(n, 'place')} near ${short}`
                    : n === 1 ? `The only ${phrase[0]} near ${short}`
                    :           `${venue.idx + 1} of ${n} ${phrase[1]} near ${short}`;
}
const SPOTS = {
  Coffee: ['coffee spot', 'coffee spots'], Drinks: ['place for a drink', 'places for a drink'],
  Food: ['place to eat', 'places to eat'], Activity: ['thing to do', 'things to do'], Shopping: ['place to shop', 'places to shop']
};

function renderRoster() {
  const list = placesAt(trip.dest), r = roster(list);
  const box = $('#roster');
  box.hidden = !list.length;
  if (!list.length) return;
  $('#roster-title').textContent = `What’s near ${shortName(trip.dest)}`;
  $('#roster-total').textContent = `${plural(r.total, 'place')} in our guide`;
  const active = venue.note ? null : venue.mood;
  $('#roster-grid').innerHTML = CATEGORIES.map(c =>
    `<button type="button" data-cat="${c}" aria-pressed="${c === active}" ${r.counts[c] ? '' : 'disabled'}>
       <b>${r.counts[c]}</b><span>${c}</span></button>`).join('');
  $('#roster-grid').onclick = e => {
    const b = e.target.closest('button[data-cat]');
    if (!b || b.disabled) return;
    venue.mood = b.dataset.cat;
    buildVenueOrder();
    renderRoster();
    animateVenueSwap($('#venue-screen'));
  };
}

/* ------------------------------------------------------------------
   PASSPORT
   ------------------------------------------------------------------ */
const scaleAbout = ({ x, y }, k) => `translate(${x * UNIT} ${y * UNIT}) scale(${k}) translate(${-x * UNIT} ${-y * UNIT})`;

function renderPassport() {
  const p = store.passport(), visited = new Set(Object.keys(p.stations));
  const latest = p.trips[0]?.dest;
  const svg = $('#passport-map');
  $('#passport-count').innerHTML = visited.size
    ? `<b>${visited.size}</b> of ${TOTAL_STATIONS} stations stamped`
    : 'No stamps yet. Finish a ride and you’ll get your first.';

  const map = renderSystemMap(svg, { stroke: 0.3 });
  for (const g of [...map.layers.stations.children]) {
    const s = g.dataset.station;
    if (!visited.has(s)) continue;
    g.classList.add('visited');
    g.setAttribute('transform', scaleAbout(map.markers[s].c, 2.2));   // gold stamps a size up, on top
    map.layers.stations.appendChild(g);
    if (s === latest) {
      const { c, r } = map.markers[s];
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('class', 'latest-ring');
      ring.setAttribute('cx', c.x * UNIT); ring.setAttribute('cy', c.y * UNIT); ring.setAttribute('r', r * UNIT * 2.2);
      map.layers.stations.appendChild(ring);
    }
  }

  $('#passport-lines').innerHTML = metroLines.map(l => {
    const n = l.stations.filter(s => visited.has(s)).length;
    return `<div class="pl-row"><span class="pl-bullet" style="background:${l.color};color:${l.text}">${l.code}</span>
            <span class="pl-bar"><i style="width:${(100 * n / l.stations.length).toFixed(1)}%"></i></span>
            <span class="pl-count">${n}/${l.stations.length}</span></div>`;
  }).join('');

  $('#passport-trips').innerHTML = p.trips.slice(0, 8).map(t => {
    const when = new Date(t.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<li><span class="pt-dot" style="background:${LINE_COLORS[t.line]}"></span>
            <span class="pt-dest">${escapeHTML(shortName(t.dest))}</span>
            <span class="pt-meta">${plural(t.stops, 'stop')} from ${escapeHTML(shortName(t.start))} · ${when}</span></li>`;
  }).join('');
  $('#passport-share').hidden = !visited.size;
}

/* ------------------------------------------------------------------
   Sharing — a link that replays the same trip for a friend
   ------------------------------------------------------------------ */
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const rideLink = t => `${location.origin}${location.pathname}#ride=${b64url(JSON.stringify([t.line, t.start, t.dest]))}`;

function openSharedRide() {
  const m = location.hash.match(/^#ride=([\w-]+)$/);
  if (!m) return;
  history.replaceState({ screen: 'intro' }, '', location.pathname + location.search);
  try {
    const [lineName, start, dest] = JSON.parse(unb64url(m[1]));
    const line = lineByName(lineName);
    const a = line?.stations.indexOf(start), b = line?.stations.indexOf(dest);
    if (!line || a < 0 || b < 0 || a === b) return;
    const prefs = store.prefs();
    trip = makeTrip({ line: lineName, start, dest, numStops: Math.abs(a - b),
                      terminal: b < a ? line.stations[0] : line.stations.at(-1),
                      relaxed: null, lineChoices: [lineName], candidates: shortlist(lineName, start, dest) },
                    { mood: 'Surprise', distance: prefs.distance, mystery: prefs.mystery, chosenLine: lineName, fromShare: true });
    document.body.classList.add('started');
    runTrip(trip);
  } catch { /* a mangled link just opens the game */ }
}

async function share(text, url) {
  if (navigator.share) {
    try { await navigator.share({ title: 'The Metro Game', text, url }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Copied. Paste it anywhere.'); }
  catch { toast(url); }
}
function shareRide() {
  const v = venue?.order[venue.idx];
  const text = v
    ? `I rode ${plural(trip.numStops, 'mystery stop')} on the ${trip.line} Line and ended up at ${v.name}. Take the same ride:`
    : `I rode ${plural(trip.numStops, 'mystery stop')} on the ${trip.line} Line. Take the same ride:`;
  share(text, rideLink(trip));
}
function sharePassport() {
  share(`I’ve stamped ${store.stampCount()} of ${TOTAL_STATIONS} Metro stations on The Metro Game.`, `${location.origin}${location.pathname}`);
}

/* ------------------------------------------------------------------
   Bits
   ------------------------------------------------------------------ */
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  reflow(t); t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 300); }, 3200);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ------------------------------------------------------------------
   Restart (no page reload) — ends the current trip
   ------------------------------------------------------------------ */
function restart() {
  runTrip.token = null;
  skipNow = null;
  tripTimeline?.kill();
  store.clearTrip();
  trip = null; venue = null;
  sel.line = null; sel.start = null; sel.mood = null; sel.fromHub = false;
  go('intro');
}
