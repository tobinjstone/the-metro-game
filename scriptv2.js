/* script.js */
import { metroLines } from "./metro-lines.js";

/* global GSAP + TextPlugin already pulled in by <script> tags */
gsap.registerPlugin(TextPlugin);

/* ------------------------------------------------------------------
   Map WMATA spellings → Google/GTFS spellings found in places.json
   ------------------------------------------------------------------ */
const stationAlias = {
  "Addison Road–Seat Pleasant": "Addison Road-Seat Pleasant",
  "Ballston–MU": "Ballston-MU",
  "Brookland–CUA": "Brookland-CUA",
  "College Park–U of Md": "College Park-U of Md",
  "Courthouse": "Court House",
  "Dunn Loring": "Dunn Loring-Merrifield",
  "Foggy Bottom–GWU": "Foggy Bottom-GWU",
  "Franconia–Springfield": "Franconia-Springfield",
  "Gallery Place": "Gallery Pl-Chinatown",
  "Georgia Ave–Petworth": "Georgia Ave-Petworth",
  "Grosvenor–Strathmore": "Grosvenor-Strathmore",
  "King Street–Old Town": "King St-Old Town",
  "Mount Vernon Square": "Mt Vernon Sq 7th St-Convention Center",
  "Navy Yard–Ballpark": "Navy Yard-Ballpark",
  "NoMa–Gallaudet U": "NoMa-Gallaudet U",
  "Potomac Yard–VT": "Potomac Yard",
  "Rhode Island Ave": "Rhode Island Ave-Brentwood",
  "Shaw–Howard U": "Shaw-Howard U",
  "Southern Ave": "Southern Avenue",
  "Stadium–Armory": "Stadium-Armory",
  "Tenleytown–AU": "Tenleytown-AU",
  "U Street": "U Street/African-Amer Civil War Memorial/Cardozo",
  "Van Ness–UDC": "Van Ness-UDC",
  "Vienna": "Vienna/Fairfax-GMU",
  "Virginia Square–GMU": "Virginia Square-GMU",
  "Wiehle–Reston East": "Wiehle-Reston East",
  "Woodley Park": "Woodley Park-Zoo/Adams Morgan"
};

/* ------------------------------------------------------------------
   Timing knobs – ONE source of truth for every animation duration
   ------------------------------------------------------------------ */
const TIMING = {
  suspense: 0.7,      // "thinking" light‑bulb (s)
  boxFade: 0.4,       // reveal‑box CSS fade (s)
  paper: 0.35,        // ticket unroll (s)
  slotHop: 0.04,      // each hop inside slot machine (s)
  slotSpin: 14,       // hops before settling
  txtStag: 0.14,      // header / origin / subtext stagger (s)
  route: 1.2,         // SVG sweep (s)
  dotPop: 0.45,       // destination dot pop (s)
  typeWriter: 0.5     // label typing (s)
};

/* Push timing values to CSS custom properties */
for (const [k, v] of Object.entries(TIMING)) {
  document.documentElement.style.setProperty(`--${k}`, `${v}s`);
}

/* ------------------------------------------------------------------
   Google "types" → 5 high‑level categories (plus Surprise fallback)
   ------------------------------------------------------------------ */
const typeToCategory = {
  // Drinks
  bar: "Drinks", night_club: "Drinks", liquor_store: "Drinks",
  // Coffee
  cafe: "Coffee", coffee_shop: "Coffee",
  // Food
  restaurant: "Food", meal_takeaway: "Food", meal_delivery: "Food", bakery: "Food",
  // Activity
  park: "Activity", museum: "Activity", art_gallery: "Activity", tourist_attraction: "Activity",
  landmark: "Activity", movie_theater: "Activity", spa: "Activity", stadium: "Activity",
  zoo: "Activity", bowling_alley: "Activity", library: "Activity", point_of_interest: "Activity",
  // Shopping
  store: "Shopping", clothing_store: "Shopping", book_store: "Shopping", shoe_store: "Shopping",
  electronics_store: "Shopping", shopping_mall: "Shopping", bicycle_store: "Shopping",
  jewelry_store: "Shopping", florist: "Shopping", furniture_store: "Shopping",
  hardware_store: "Shopping", pet_store: "Shopping"
};

/* ------------------------------------------------------------------
   Data holders
   ------------------------------------------------------------------ */
let places = {};                  // station → [place, …]
let chosenStartStation = null;
let selectedLine = null;          // metroLines[idx]
let currentTrip = null;           // full trip object once generated
let preferredCategory = null;     // Drinks / Coffee / …

/* ------------------------------------------------------------------
   Bootstrapping – load dataset, then enable the Start button
   ------------------------------------------------------------------ */
async function loadPlaces() {
  const resp = await fetch("./places.json");
  if (!resp.ok) throw new Error(`Couldn't load places (${resp.status})`);

  const raw = await resp.json();
  const rows = Array.isArray(raw) ? raw : Object.values(raw).flat();

  places = rows.reduce((acc, row) => {
    row.categories = [...new Set(row.types.map(t => typeToCategory[t]).filter(Boolean))];
    if (row.categories.length === 0) row.categories = ["Surprise"];
    (acc[row.station] ??= []).push(row);
    return acc;
  }, {});
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadPlaces();
  document.getElementById("start-btn").onclick = () => {
    pinLogo();
    renderLineSelection();
    showScreen("line-screen");
  };
});

/* ------------------------------------------------------------------
   View helpers
   ------------------------------------------------------------------ */
function showScreen(id) {
  document.querySelectorAll(".screen.active").forEach(el => {
    el.classList.add("slide-out");
    el.classList.remove("active");
    el.addEventListener("transitionend", () => (el.hidden = true), { once: true });
  });

  const next = document.getElementById(id);
  next.hidden = false;
  next.classList.add("slide-in");
  requestAnimationFrame(() => {
    next.classList.remove("slide-in");
    next.classList.add("active");
  });
}

function pinLogo() {
  const logo = document.getElementById("logo");
  if (!logo || logo.classList.contains("sticky")) return;
  document.body.appendChild(logo);
  requestAnimationFrame(() => logo.classList.add("sticky"));
}

/* ------------------------------------------------------------------
   GSAP slot‑machine helper
   ------------------------------------------------------------------ */
function gsapSlot(el, items, finalText, spins = TIMING.slotSpin) {
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("active"));

  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: () => { el.textContent = finalText; resolve(); } });

    for (let i = 0; i < spins; i++) {
      tl.to({}, { duration: TIMING.slotHop, onStart: () => { el.textContent = items[i % items.length]; } });
    }

    tl.to({}, { duration: TIMING.boxFade, ease: "power3.out" });
  });
}

/* ------------------------------------------------------------------
   Quick‑start hub lookup
   ------------------------------------------------------------------ */
const hubLines = {
  "Metro Center":  ["Red", "Orange", "Silver", "Blue"],
  "Gallery Place": ["Red", "Green", "Yellow"],
  "L'Enfant Plaza": ["Green", "Yellow", "Blue", "Silver", "Orange"]
};

/* ------------------------------------------------------------------
   LINE picker screen
   ------------------------------------------------------------------ */
function renderLineSelection() {
  const screen = document.getElementById("line-screen");
  screen.innerHTML = `
    <h2 class="screen-title">I’m starting from…</h2>
    <p class="subtitle">Select a Metro line:</p>
    <div id="line-picker" class="line-picker"></div>
    <p class="subtitle">…or start at a transfer hub:</p>
    <div id="hub-picker" class="hub-picker">
      ${Object.keys(hubLines).map(h => `<button class="hub-btn" data-hub="${h}">${h}</button>`).join("")}
    </div>`;

  /* build line circles */
  const lp = screen.querySelector("#line-picker");
  metroLines.forEach((line, idx) => {
    const btn = document.createElement("button");
    btn.className = "line-circle";
    btn.style.background = line.color;
    btn.textContent = line.name[0];
    btn.title = `${line.name} Line`;
    btn.dataset.idx = idx;
    if (line.name === "Yellow") btn.style.color = "#000";
    lp.appendChild(btn);
  });

  lp.onclick = e => {
    const t = e.target.closest(".line-circle");
    if (!t) return;
    selectedLine = metroLines[Number(t.dataset.idx)];
    renderStationSelection();
    showScreen("station-screen");
  };

  /* hub quick‑start */
  const hp = screen.querySelector("#hub-picker");
  hp.onclick = e => {
    const t = e.target.closest(".hub-btn");
    if (!t) return;

    const hub = t.dataset.hub;
    const lineName = hubLines[hub][Math.floor(Math.random() * hubLines[hub].length)];
    selectedLine = metroLines.find(l => l.name === lineName);
    chosenStartStation = hub;

    renderCategorySelection();
    showScreen("category-screen");
  };
}

/* ------------------------------ STATION picker --------------------------- */
function renderStationSelection() {
  /** Screen bootstrap (create once, then reuse) */
  let screen = document.getElementById("station-screen");
  const firstVisit = !screen;

  if (firstVisit) {
    screen = document.createElement("section");
    screen.id = "station-screen";
    screen.className = "screen";
    screen.hidden = true;                 // let showScreen() fade it in later

    screen.innerHTML = `
      <h2 id="station-title" class="screen-title"></h2>
      <p class="subtitle">Choose your starting station:</p>

      <input id="station-search"
             class="station-search"
             type="text"
             placeholder="Type a station…">

      <div id="station-picker" class="station-picker"></div>

      <button id="station-back-btn" class="text-link">⬅ Back</button>`;
    document.body.appendChild(screen);
  }

  /* ----- (re)populate dynamic bits ------------------------------------ */
  screen.querySelector("#station-title").textContent = `${selectedLine.name} Line`;

  const picker = screen.querySelector("#station-picker");
  picker.textContent = "";                           // clear previous buttons

  // Use a fragment for zero-reflow bulk insert
  const frag = document.createDocumentFragment();
  selectedLine.stations.forEach(station => {
    const b = document.createElement("button");
    b.className   = "station-btn";
    b.textContent = station;
    frag.appendChild(b);
  });
  picker.appendChild(frag);

  /* ----- one-time event wiring (delegated) ----------------------------- */
  if (firstVisit) {
    /* choose a station */
    picker.addEventListener("click", e => {
      const btn = e.target.closest(".station-btn");
      if (!btn) return;
      chosenStartStation = btn.textContent;
      renderCategorySelection();
      showScreen("category-screen");
    });

    /* live search filter */
    const search = screen.querySelector("#station-search");
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      picker.querySelectorAll(".station-btn").forEach(b => {
        b.classList.toggle("hidden", !b.textContent.toLowerCase().includes(q));
      });
    });

    /* back to line picker */
    screen.querySelector("#station-back-btn").addEventListener("click", () => {
      renderLineSelection();
      showScreen("line-screen");
    });
  } else {
    // reset search box on revisit
    screen.querySelector("#station-search").value = "";
  }

  /* reveal the screen */
  showScreen("station-screen");
}

/* --------------------------- CATEGORY selection -------------------------- */
const CATEGORIES = ["Drinks", "Coffee", "Food", "Activity", "Shopping", "Surprise"];

function renderCategorySelection() {
  let screen = document.getElementById("category-screen");
  const firstVisit = !screen;

  /* ── build DOM once ─────────────────────────────────────────────────── */
  if (firstVisit) {
    screen = document.createElement("section");
    screen.id = "category-screen";
    screen.className = "screen";
    screen.hidden = true;

    screen.innerHTML = `
      <h2 class="screen-title">Pick a vibe</h2>
      <p class="subtitle">What are you in the mood for?</p>

      <div id="category-grid" class="category-grid"></div>

      <button id="cat-back-btn" class="text-link">⬅ Back</button>`;
    document.body.appendChild(screen);

    /* build the grid just once */
    const gridFrag = document.createDocumentFragment();
    CATEGORIES.forEach(cat => {
      const b = document.createElement("button");
      b.className   = "cat-btn";
      b.dataset.cat = cat;
      b.innerHTML   = `<span>${cat}</span>`;       // keep icons optional
      gridFrag.appendChild(b);
    });
    screen.querySelector("#category-grid").appendChild(gridFrag);

    /* delegated click → start trip */
    screen.querySelector("#category-grid").addEventListener("click", e => {
      const btn = e.target.closest(".cat-btn");
      if (!btn) return;

      preferredCategory = btn.dataset.cat;
      const trip = getTrip(selectedLine,
                           selectedLine.stations.indexOf(chosenStartStation));

      animateMysteryTrip(selectedLine, chosenStartStation, trip);
      showScreen("trip-screen");
    });

    /* back → station picker */
    screen.querySelector("#cat-back-btn").addEventListener("click", () => {
      renderStationSelection();
      showScreen("station-screen");
    });
  }

  /* show the screen */
  showScreen("category-screen");
}
/* ------------------------------ TRIP helper ------------------------------ */
/**
 * Returns an object that fully describes a random journey
 *   – direction (terminal), number of stops, every station on the way
 * Centralising it here makes later tweaks (e.g. max stops) a one-liner.
 *
 * @param  {Object} line       The line object from metroLines[]
 * @param  {Number} startIdx   Index of the user-chosen start station
 * @param  {Function} [rng]    Injectable RNG for tests (defaults to Math.random)
 * @return {Object}            { numStops, terminal, destStation, pathStations[] }
 */
function getTrip(line, startIdx, rng = Math.random) {
  // Decide direction
  const dir       = rng() < 0.5 ? -1 : 1;
  const maxSteps  = dir === 1
        ? line.stations.length - 1 - startIdx
        : startIdx;                       // how many stops are available that way
  const numStops  = Math.max(1,          // at least one stop
        Math.min(maxSteps,               // never overshoot the line
        2 + Math.floor(rng() * 4)));     // default 2-5 stops feels “playable”

  const destIdx   = startIdx + dir * numStops;
  const terminal  = dir === 1
        ? line.stations[line.stations.length - 1]
        : line.stations[0];

  const pathStations = dir === 1
        ? line.stations.slice(startIdx, destIdx + 1)
        : line.stations.slice(destIdx,  startIdx + 1).reverse();

  return {
    numStops,
    terminal,
    destStation : line.stations[destIdx],
    pathStations
  };
}

/* ------------------------------ SVG builder ------------------------------ */
/**
 * Builds a mini line diagram (<svg>) showing each stop on this journey.
 * Width auto-scales to the # of stations; styling lives in CSS (.trip-svg).
 *
 * @param  {Object} line   The same line object (needs .color)
 * @param  {Object} trip   Object returned by getTrip()
 * @return {SVGElement}    Ready-to-insert <svg>
 */
function buildTripSVG(line, trip) {
  const DOT      = 14;          // diameter of stop circles
  const GAP      = 30;          // px between stops
  const ns       = "http://www.w3.org/2000/svg";
  const width    = DOT + (trip.pathStations.length - 1) * GAP;
  const half     = DOT / 2;

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width",  width);
  svg.setAttribute("height", DOT);
  svg.setAttribute("viewBox", `0 0 ${width} ${DOT}`);
  svg.classList.add("trip-svg");

  /* track */
  const track = document.createElementNS(ns, "line");
  track.setAttribute("x1", half);
  track.setAttribute("y1", half);
  track.setAttribute("x2", width - half);
  track.setAttribute("y2", half);
  track.setAttribute("stroke", line.color);
  track.setAttribute("stroke-width", 4);
  svg.appendChild(track);

  /* stops */
  trip.pathStations.forEach((_, i) => {
    const cx = half + i * GAP;
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx",  cx);
    dot.setAttribute("cy",  half);
    dot.setAttribute("r",   half);
    dot.setAttribute("fill", line.color);
    svg.appendChild(dot);
  });

  return svg;
}

/* ===========================  ANIMATION CONSTANTS  =========================== */

const EASE = "power2.out";

/* ==========================  SCREEN TRANSITIONS  ============================ */
/**
 * Slides the current screen off the top and the target screen up from the bottom.
 * Relies purely on GSAP so adjusting TIMING.screen is enough to speed/slow all pages.
 */
let currentScreen = null;

function showScreen(id) {
  const next = document.getElementById(id);
  if (!next || next === currentScreen) return;

  const tl = gsap.timeline({ defaults: { ease: EASE, duration: TIMING.screen }});

  /* slide current out */
  if (currentScreen) {
    tl.to(currentScreen, {
      yPercent: -100,
      opacity: 0,
      onComplete: () => {
        currentScreen.hidden = true;
        currentScreen.classList.remove("active");
      }
    }, 0);
  }

  /* prepare & slide next in */
  next.hidden = false;
  next.style.opacity = 0;
  next.style.transform = "translateY(100%)";
  tl.to(next, {
    yPercent: 0,
    opacity: 1,
    onStart: () => next.classList.add("active")
  }, currentScreen ? ">-0.1" : 0);

  currentScreen = next;
}

/* =============================  LOGO PINNING  ============================== */
/**
 * On first use, slides the splash-screen logo up and converts it into a fixed header.
 * Call once, right after the user hits “Start Game”.
 */
function pinLogo() {
  const logo = document.getElementById("main-logo");
  if (!logo || logo.dataset.pinned) return;      // guard: run once

  gsap.to(logo, {
    y: -window.innerHeight / 2 + 60,
    scale: 0.8,
    duration: TIMING.logoSlide,
    ease: EASE,
    onComplete: () => {
      Object.assign(logo.style, {
        position: "fixed",
        top      : "1rem",
        left     : "50%",
        transform: "translateX(-50%)"
      });
      logo.dataset.pinned = "true";
    }
  });
}

/* ========================  RESULT-CARD ANIMATION  ========================= */
/**
 * Builds the minimap SVG, injects all trip details (you already have populateTripDetails),
 * and animates the card + sub-elements in sequence.
 */
function animateMysteryTrip(line, startStation, trip) {
  const card      = document.getElementById("result-card");
  const stopsBox  = card.querySelector("#stops-box");
  const details   = card.querySelector("#trip-details");
  const minimapBx = card.querySelector("#minimap-box");

  /* 1. Populate the UI */
  populateTripDetails(card, line, trip);           // your existing helper
  minimapBx.replaceChildren(buildTripSVG(line, trip));

  /* 2. Animate */
  const tl = gsap.timeline({ defaults: { ease: EASE }});

  card.classList.remove("hidden");
  tl.from(card,      { scale: 0.85, opacity: 0, duration: TIMING.cardPop })
    .from(stopsBox,  { y: 30,  opacity: 0, duration: TIMING.boxFade }, "-=0.25")
    .from(details,   { y: 30,  opacity: 0, duration: TIMING.boxFade }, "-=0.30")
    /* draw track */
    .from(minimapBx.querySelector("line"), {
      strokeDasharray : function() { return this.getAttribute("x2") - this.getAttribute("x1"); },
      strokeDashoffset: function() { return this.getAttribute("x2") - this.getAttribute("x1"); },
      duration: TIMING.minimap
    }, "-=0.20")
    /* pop dots */
    .from(minimapBx.querySelectorAll("circle"), {
      opacity: 0,
      scale  : 0,
      duration: TIMING.minimap * 0.6,
      stagger : TIMING.minimap / (trip.pathStations.length * 1.5)
    }, "-=" + TIMING.minimap * 0.9);
}

/* ---------------------------- VENUE picker ----------------------------- */
/**  Map the six UI categories → keyword lists found in your JSON “types”. */
const CATEGORY_MAP = {
  Drinks   : ["bar", "pub", "brewery", "wine"],
  Coffee   : ["coffee"],
  Food     : ["restaurant", "diner", "eatery", "food"],
  Activity : ["museum", "park", "gallery", "theater", "arcade"],
  Shopping : ["shop", "store", "market"],
  Surprise : []                     // special: accept anything
};

/**
 * Returns a random venue object close to `station`, matching `category`.
 * Falls back to *any* venue at that station if none match the vibe.
 *
 * @param {String} station   Metro station name (exact key in `places`)
 * @param {String} category  One of the UI categories – may be "Surprise"
 * @param {Function} rng     Optional RNG (for tests)
 * @return {Object|null}     Venue ( {name, address, category, rating…} )
 */
function pickVenue(station, category, rng = Math.random) {
  const pool = places[station] || [];
  if (!pool.length) return null;

  const keywords = CATEGORY_MAP[category] || [];
  let options = pool;

  if (keywords.length) {
    options = pool.filter(v => {
      const tagStr = (v.category || v.types || "").toLowerCase();
      return keywords.some(k => tagStr.includes(k));
    });
    if (!options.length) options = pool;   // fallback: anything goes
  }

  return options[Math.floor(rng() * options.length)] || null;
}

/* --------------------------- VENUE reveal UI --------------------------- */
let venueScreenBuilt = false;

function renderVenueReveal(trip) {
  /* ---- build DOM once ---- */
  let screen = document.getElementById("venue-screen");
  if (!venueScreenBuilt) {
    screen = document.createElement("section");
    screen.id = "venue-screen";
    screen.className = "screen";
    screen.hidden = true;

    screen.innerHTML = `
      <h2 class="screen-title">You’ve arrived!</h2>

      <div id="venue-card" class="venue-card hidden">
        <h3 id="venue-name"></h3>
        <p  id="venue-address" class="venue-address"></p>
        <p  id="venue-extra"   class="venue-extra"></p>
        <button id="new-trip-btn" class="primary-btn">Play Again</button>
      </div>

      <button id="venue-back-btn" class="text-link">⬅ Back to Trip</button>`;
    document.body.appendChild(screen);

    /* one-time listeners */
    screen.querySelector("#new-trip-btn").onclick = () => {
      renderLineSelection();
      showScreen("line-screen");
    };
    screen.querySelector("#venue-back-btn").onclick = () =>
      showScreen("trip-screen");

    venueScreenBuilt = true;
  }

  /* ---- pick & display venue ---- */
  const venue  = pickVenue(trip.destStation, preferredCategory);
  const card   = screen.querySelector("#venue-card");
  const nameEl = screen.querySelector("#venue-name");
  const addrEl = screen.querySelector("#venue-address");
  const extraEl= screen.querySelector("#venue-extra");

  if (venue) {
    nameEl.textContent  = venue.name;
    addrEl.textContent  = venue.address || "";
    extraEl.textContent = venue.category ? venue.category : "";
  } else {
    nameEl.textContent  = "No spot found 😕";
    addrEl.textContent  = "We’ll add more venues soon!";
    extraEl.textContent = "";
  }

  /* ---- animate card ---- */
  card.classList.remove("hidden");
  gsap.fromTo(card, { scale: 0.85, opacity: 0 },
                    { scale: 1,  opacity: 1, duration: TIMING.cardPop, ease: EASE });

  showScreen("venue-screen");
}


/* ------------------------------ restart helper --------------------------- */
function restart() {
  selectedLine = null;
  currentTrip  = null;
  preferredCategory = null;
  renderLineSelection();
  showScreen("line-screen");
}
