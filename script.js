/* ==================================================================
   The Metro Game — app logic
   ================================================================== */
import { metroLines, shortName } from './metro-lines.js';
import { renderSystemMap, animateTrip } from './metro-map.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = s => new Promise(r => setTimeout(r, s * 1000));
const pick = arr => arr[Math.random() * arr.length | 0];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------
   WMATA spellings → Google/GTFS spellings used inside places.json
   ------------------------------------------------------------------ */
const stationAlias = {
  "Addison Road–Seat Pleasant": "Addison Road-Seat Pleasant",
  "Archives"                  : "Archives-Navy Memorial-Penn Quarter",
  "Ballston–MU"               : "Ballston-MU",
  "Brookland–CUA"             : "Brookland-CUA",
  "College Park–U of Md"      : "College Park-U of Md",
  "Courthouse"                : "Court House",
  "Dunn Loring"               : "Dunn Loring-Merrifield",
  "Foggy Bottom–GWU"          : "Foggy Bottom-GWU",
  "Franconia–Springfield"     : "Franconia-Springfield",
  "Gallery Place"             : "Gallery Pl-Chinatown",
  "Georgia Ave–Petworth"      : "Georgia Ave-Petworth",
  "Grosvenor–Strathmore"      : "Grosvenor-Strathmore",
  "King Street–Old Town"      : "King St-Old Town",
  "Mount Vernon Square"       : "Mt Vernon Sq 7th St-Convention Center",
  "Navy Yard–Ballpark"        : "Navy Yard-Ballpark",
  "NoMa–Gallaudet U"          : "NoMa-Gallaudet U",
  "Potomac Yard–VT"           : "Potomac Yard",
  "Rhode Island Ave"          : "Rhode Island Ave-Brentwood",
  "Shaw–Howard U"             : "Shaw-Howard U",
  "Southern Ave"              : "Southern Avenue",
  "Stadium–Armory"            : "Stadium-Armory",
  "Tenleytown–AU"             : "Tenleytown-AU",
  "U Street"                  : "U Street/African-Amer Civil War Memorial/Cardozo",
  "Van Ness–UDC"              : "Van Ness-UDC",
  "Vienna"                    : "Vienna/Fairfax-GMU",
  "Virginia Square–GMU"       : "Virginia Square-GMU",
  "Wiehle–Reston East"        : "Wiehle-Reston East",
  "Woodley Park"              : "Woodley Park-Zoo/Adams Morgan"
};

/* Google "types" → six high-level buckets */
const typeToCategory = {
  bar: "Drinks", night_club: "Drinks", liquor_store: "Drinks",
  cafe: "Coffee", coffee_shop: "Coffee",
  restaurant: "Food", meal_takeaway: "Food", meal_delivery: "Food", bakery: "Food",
  park: "Activity", museum: "Activity", art_gallery: "Activity", tourist_attraction: "Activity",
  landmark: "Activity", movie_theater: "Activity", spa: "Activity", stadium: "Activity", zoo: "Activity",
  bowling_alley: "Activity", library: "Activity",
  clothing_store: "Shopping", book_store: "Shopping", shoe_store: "Shopping", electronics_store: "Shopping",
  shopping_mall: "Shopping", bicycle_store: "Shopping", jewelry_store: "Shopping", florist: "Shopping",
  furniture_store: "Shopping", hardware_store: "Shopping", pet_store: "Shopping"
};
const CATEGORY_WORD = { Coffee:"coffee", Drinks:"drinks", Food:"food", Activity:"activity", Shopping:"shopping" };

/* Transfer hubs offered as a quick start (line is picked at random) */
const HUBS = ["Metro Center", "Gallery Place", "L'Enfant Plaza", "Fort Totten", "Rosslyn", "Pentagon"];

/* ------------------------------------------------------------------
   State
   ------------------------------------------------------------------ */
let places = {};                 // station → [place, …]
let selectedLine = null;         // metroLines[x]
let chosenStartStation = null;
let preferredCategory = null;
let currentTrip = null;          // { line, startStation, numStops, destStation, terminal }
let cameFromHub = false;
let tripTimeline = null;

const linesServing = station => metroLines.filter(l => l.stations.includes(station));

/* ------------------------------------------------------------------
   Data
   ------------------------------------------------------------------ */
async function loadPlaces() {
  const resp = await fetch('./places.json');
  if (!resp.ok) throw new Error(`Couldn't load places (${resp.status})`);
  const raw = await resp.json();
  const rows = Array.isArray(raw) ? raw : Object.values(raw).flat();

  places = rows.reduce((acc, row) => {
    row.categories = [...new Set((row.types ?? []).map(t => typeToCategory[t]).filter(Boolean))];
    if (row.categories.length === 0) row.categories = ['Surprise'];
    (acc[row.station] ??= []).push(row);
    return acc;
  }, {});
}

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  renderSystemMap($('#intro-map'));                       // ghosted map behind the intro

  $('#start-btn').addEventListener('click', () => {
    document.body.classList.add('started');
    renderLineSelection();
    showScreen('line-screen');
  });
  $('#retry-btn').addEventListener('click', boot);
  $('#home-btn').addEventListener('click', restart);
  $('#play-again').addEventListener('click', restart);
  $('#start-over-btn').addEventListener('click', restart);
  $('#arrived-btn').addEventListener('click', handleArrival);
  wireCategoryScreen();

  boot();
});

async function boot() {
  const btn = $('#start-btn'), label = $('.btn-label', btn), err = $('#load-error');
  btn.disabled = true; label.textContent = 'Loading stations…'; err.hidden = true;
  try {
    await loadPlaces();
    btn.disabled = false; label.textContent = 'Board the Unknown';
  } catch (e) {
    console.error(e);
    label.textContent = 'Unavailable'; err.hidden = false;
  }
}

/* ------------------------------------------------------------------
   Screen transitions
   ------------------------------------------------------------------ */
function showScreen(id) {
  const next = document.getElementById(id);
  if (next.classList.contains('active')) return;

  $$('.screen.active').forEach(el => {
    el.classList.add('slide-out');
    el.classList.remove('active');
    const done = () => { el.hidden = true; el.classList.remove('slide-out'); };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 500);                                // safety net
  });

  next.hidden = false;
  next.scrollTop = 0;
  next.classList.add('slide-in');
  reflow(next);                                          // commit the start state, then transition
  next.classList.remove('slide-in');
  next.classList.add('active');
}

/* Forces style recalculation so a class swap animates instead of snapping */
const reflow = el => void el.offsetHeight;

/* ------------------------------------------------------------------
   Slot-machine counter (GSAP)
   ------------------------------------------------------------------ */
function gsapSlot(el, items, finalText, hops = 30) {
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    const minHop = 0.04, maxHop = 0.18, ease = t => t * t;
    for (let i = 0; i < hops; i++) {
      const progress = i / (hops - 1);
      const dur = gsap.utils.interpolate(minHop, maxHop, ease(progress));
      const text = (i === hops - 1) ? finalText : items[i % items.length];
      tl.to({}, { duration: dur, onStart: () => (el.textContent = text) });
    }
  });
}

/* ------------------------------------------------------------------
   LINE picker
   ------------------------------------------------------------------ */
function renderLineSelection() {
  const screen = $('#line-screen');
  screen.innerHTML = `
    <div class="screen-body">
      <h2 class="screen-title">Where are you starting?</h2>
      <p class="subtitle">Pick your line</p>
      <div id="line-picker" class="line-grid" role="list"></div>
      <p class="subtitle hub-heading">…or start at a transfer hub and let fate pick the line</p>
      <div id="hub-picker" class="hub-grid"></div>
    </div>`;

  const lp = $('#line-picker', screen);
  metroLines.forEach((line, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'line-btn';
    btn.dataset.idx = idx;
    btn.innerHTML = `<span class="chip" style="background:${line.color};color:${line.text}">${line.name[0]}</span>
                     <span>${line.name} Line</span>`;
    lp.appendChild(btn);
  });
  lp.addEventListener('click', e => {
    const t = e.target.closest('.line-btn');
    if (!t) return;
    selectedLine = metroLines[Number(t.dataset.idx)];
    cameFromHub = false;
    renderStationSelection();
    showScreen('station-screen');
  });

  const hp = $('#hub-picker', screen);
  HUBS.forEach(hub => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-btn';
    btn.dataset.hub = hub;
    btn.innerHTML = `<span>${hub}</span>
                     <span class="dots">${linesServing(hub).map(l => `<i style="background:${l.color}"></i>`).join('')}</span>`;
    hp.appendChild(btn);
  });
  hp.addEventListener('click', e => {
    const t = e.target.closest('.hub-btn');
    if (!t) return;
    const hub = t.dataset.hub;
    selectedLine = pick(linesServing(hub));
    chosenStartStation = hub;
    cameFromHub = true;
    showScreen('category-screen');
  });
}

/* ------------------------------------------------------------------
   STATION picker (strip map)
   ------------------------------------------------------------------ */
function renderStationSelection() {
  const screen = $('#station-screen');
  const line = selectedLine;
  screen.innerHTML = `
    <div class="screen-body">
      <h2 class="screen-title line-title"><span class="chip" style="background:${line.color};color:${line.text}">${line.name[0]}</span><span>${line.name} Line</span></h2>
      <p class="subtitle">Choose your starting station</p>
      <input id="station-search" class="station-search" type="search" placeholder="Search stations…" autocomplete="off" aria-label="Search stations">
      <div id="station-picker" class="strip" style="--line-color:${line.color}" role="list"></div>
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
    chosenStartStation = station;
    showScreen('category-screen');
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

  $('#back-btn', screen).addEventListener('click', () => showScreen('line-screen'));
}

/* ------------------------------------------------------------------
   CATEGORY picker
   ------------------------------------------------------------------ */
function wireCategoryScreen() {
  $('#cat-back-btn').addEventListener('click', () => {
    if (cameFromHub) { showScreen('line-screen'); return; }
    renderStationSelection();
    showScreen('station-screen');
  });

  $('#category-grid').addEventListener('click', e => {
    const b = e.target.closest('.cat-btn');
    if (!b) return;
    preferredCategory = b.dataset.cat;

    /* at shared stations, any line serving the platform is fair game */
    selectedLine = pickLineForStation(chosenStartStation, selectedLine);
    const trip = getTrip(selectedLine, selectedLine.stations.indexOf(chosenStartStation));
    runTrip(selectedLine, chosenStartStation, trip);
  });
}

function pickLineForStation(station, currentLine) {
  if (HUBS.includes(station)) return currentLine;        // hubs were randomised already
  const here = linesServing(station);
  return here.length > 1 ? pick(here) : currentLine;
}

/* ------------------------------------------------------------------
   TRIP maths
   ------------------------------------------------------------------ */
function getTrip(line, startIdx) {
  const last    = line.stations.length - 1;
  const toFirst = startIdx;
  const toLast  = last - startIdx;
  const direction = (toFirst && toLast) ? (Math.random() < 0.5 ? 'first' : 'last')
                                        : (toFirst ? 'first' : 'last');
  const maxStops = direction === 'first' ? toFirst : toLast;
  const numStops = Math.floor(Math.random() * maxStops) + 1;
  const destIdx  = direction === 'first' ? startIdx - numStops : startIdx + numStops;
  return {
    numStops,
    destStation: line.stations[destIdx],
    terminal:    direction === 'first' ? line.stations[0] : line.stations[last]
  };
}

/* ------------------------------------------------------------------
   TRIP reveal
   ------------------------------------------------------------------ */
async function runTrip(line, startStation, trip) {
  currentTrip = { line, startStation, ...trip };
  const token = Symbol();                                // guards against restarts mid-animation
  runTrip.token = token;
  const live = () => runTrip.token === token;

  const screen   = $('#trip-screen');
  const thinking = $('#thinking-box', screen);
  const card     = $('#result-card', screen);
  const btns     = $('.trip-buttons', screen);
  const arrival  = $('#arrival-text', screen);
  const pill     = $('#ticket-line', screen);
  const dir      = $('#ticket-dir', screen);
  const svg      = $('#trip-map', screen);

  /* reset */
  tripTimeline?.kill();
  card.hidden = true; card.classList.remove('active');
  btns.hidden = true; btns.classList.remove('fade-in');
  arrival.textContent = ''; gsap.set(arrival, { opacity: 0, y: 12 });
  svg.innerHTML = '';
  $('#stop-number', screen).textContent = '?';
  $('#stops-word', screen).textContent = 'stops';
  $('#trip-origin', screen).textContent = `from ${shortName(startStation)}`;
  pill.textContent = `${line.name} Line`;
  pill.style.background = line.color; pill.style.color = line.text;
  dir.textContent = `toward ${shortName(trip.terminal)}`;
  gsap.set(pill, { scaleX: 0 }); gsap.set(dir, { opacity: 0, x: -8 });

  /* 1. thinking… */
  thinking.style.setProperty('--line-color', line.color);
  $('#thinking-text', thinking).textContent = pick(['Finding your train…', 'Checking the map…', 'Listening for the chime…', 'Doors closing…']);
  thinking.hidden = false;
  showScreen('trip-screen');
  await wait(reducedMotion ? 0.3 : 1.1);
  if (!live()) return;
  thinking.hidden = true;

  /* 2. ticket shell + line/direction */
  card.hidden = false;
  reflow(card);
  card.classList.add('active');
  await gsap.timeline({ delay: 0.25 })
    .to(pill, { scaleX: 1, duration: 0.4, ease: 'power2.out' })
    .to(dir,  { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }, '-=0.1');
  if (!live()) return;

  /* 3. stop counter */
  await gsapSlot($('#stop-number', screen),
                 Array.from({ length: 15 }, (_, i) => `${i + 1}`),
                 `${trip.numStops}`,
                 reducedMotion ? 6 : 22);
  if (!live()) return;
  $('#stops-word', screen).textContent = trip.numStops === 1 ? 'stop' : 'stops';

  /* 4. the map */
  tripTimeline = animateTrip(svg, { line: line.name, from: startStation, to: trip.destStation, labelFor: shortName });
  if (reducedMotion) tripTimeline.timeScale(4);
  await tripTimeline;
  if (!live()) return;

  /* 5. arrival + buttons */
  arrival.textContent = `You’ll arrive at ${trip.destStation}.`;
  gsap.to(arrival, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
  btns.hidden = false;
  reflow(btns);
  btns.classList.add('fade-in');
}

/* ------------------------------------------------------------------
   VENUE reveal + re-roll
   ------------------------------------------------------------------ */
function handleArrival() {
  const dest      = currentTrip.destStation;
  const canonical = stationAlias[dest] ?? dest;
  const all       = places[canonical] ?? [];

  const pickVenue = (excludeName = null) => {
    let pool = all, note = '';
    if (preferredCategory && preferredCategory !== 'Surprise') {
      const filtered = all.filter(p => p.categories.includes(preferredCategory));
      if (filtered.length) pool = filtered;
      else if (all.length) note = `No ${CATEGORY_WORD[preferredCategory]} spots in our list near ${shortName(dest)} — here’s something else.`;
    }
    if (!pool.length) return null;
    let v, tries = 0;
    do { v = pool[Math.random() * pool.length | 0]; }
    while (excludeName && v.name === excludeName && pool.length > 1 && ++tries < 25);
    return { venue: v, note };
  };

  const vs = $('#venue-screen');
  populateVenue(vs, pickVenue(), dest);

  const again = $('#new-place-btn', vs);
  again.hidden = all.length < 2;
  again.onclick = () => {
    const fresh = pickVenue($('#venue-name', vs).textContent);
    animateVenueSwap(vs, fresh, dest);
  };

  showScreen('venue-screen');
}

function animateVenueSwap(vs, picked, dest) {
  const lines = $$('.vline', vs);
  gsap.timeline()
    .to(lines, { x: -260, opacity: 0, duration: 0.26, stagger: 0.04, ease: 'power1.in' })
    .add(() => populateVenue(vs, picked, dest))
    .fromTo(lines, { x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, stagger: 0.04, ease: 'power1.out' });
}

function populateVenue(vs, picked, dest) {
  const nameEl = $('#venue-name', vs), meta = $('#venue-meta', vs), addr = $('#venue-address', vs),
        note = $('#venue-note', vs), msg = $('#venue-message', vs), maps = $('#venue-maps', vs);

  if (!picked) {
    msg.textContent = 'Uncharted territory.';
    nameEl.textContent = shortName(dest);
    meta.innerHTML = '';
    addr.textContent = '';
    note.textContent = `We don’t have any places listed near ${shortName(dest)} yet — explore on your own, or start over.`;
    maps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`things to do near ${dest} Metro station`)}`;
    maps.textContent = 'Explore on Google Maps';
    return;
  }

  const v = picked.venue;
  msg.textContent = 'You’re going to…';
  nameEl.textContent = v.name;
  addr.textContent = v.address ?? '';
  note.textContent = picked.note || '';

  const tags = [];
  const cat = (preferredCategory && preferredCategory !== 'Surprise' && v.categories.includes(preferredCategory))
              ? preferredCategory : v.categories[0];
  if (cat && cat !== 'Surprise') tags.push(`<span class="tag cat">${cat}</span>`);
  if (v.rating) {
    const n = v.user_ratings_total ? ` · ${new Intl.NumberFormat('en', { notation: 'compact' }).format(v.user_ratings_total)}` : '';
    tags.push(`<span class="tag">★ ${v.rating.toFixed(1)}${n}</span>`);
  }
  if (v.price_level > 0) tags.push(`<span class="tag">${'$'.repeat(v.price_level)}</span>`);
  if (v.distance_m) tags.push(`<span class="tag">${Math.max(1, Math.round(v.distance_m / 80))} min walk</span>`);
  meta.innerHTML = tags.join('');

  const q = encodeURIComponent(`${v.name} ${v.address ?? ''}`.trim());
  maps.href = `https://www.google.com/maps/search/?api=1&query=${q}${v.place_id ? `&query_place_id=${v.place_id}` : ''}`;
  maps.textContent = 'Open in Google Maps';
}

/* ------------------------------------------------------------------
   Restart (no page reload)
   ------------------------------------------------------------------ */
function restart() {
  runTrip.token = null;
  tripTimeline?.kill();
  selectedLine = null; chosenStartStation = null; preferredCategory = null; currentTrip = null; cameFromHub = false;
  document.body.classList.remove('started');
  showScreen('intro-screen');
}
