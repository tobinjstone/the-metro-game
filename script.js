/* script.js (very top) */
import { metroLines } from './metro-lines.js';
gsap.registerPlugin(TextPlugin);

/* ------------------------------------------------------------------
   One-time patch: map WMATA spellings to the Google/GTFS spellings
   used inside places.json
   ------------------------------------------------------------------ */
const stationAlias = {
  "Addison Road–Seat Pleasant": "Addison Road-Seat Pleasant",
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
  // (Prince George’s Plaza isn’t in places.json yet, so no alias)
};

const TIMING = {
  suspense : 1.7,   // bulb delay (s)
  boxFade  : 0.4,   // reveal-box CSS (s)
  paper    : 0.60,  // ticket unroll (s)
  slotHop  : 0.04,  // each hop
  slotSpin : 30,    // total hops
  txtStag  : 0.14,  // header/origin/sub stagger (s)
  route    : 1.2,   // SVG sweep (s)
  dotPop   : 0.9  // SVG dot pop (s)
};



/* Google “types” → six high-level buckets */
const typeToCategory = {
  // Drinks
  bar: "Drinks", night_club: "Drinks", liquor_store: "Drinks",

  // Coffee
  cafe: "Coffee", coffee_shop: "Coffee",

  // Food
  restaurant: "Food", meal_takeaway: "Food",
  meal_delivery: "Food", bakery: "Food",

  // Activity
  park: "Activity", museum: "Activity", art_gallery: "Activity",
  tourist_attraction: "Activity", landmark: "Activity", movie_theater: "Activity", spa: "Activity",
  stadium: "Activity", zoo: "Activity", bowling_alley: "Activity", 
  library: "Activity", point_of_interest: "Activity",

  // Shopping
  store: "Shopping", clothing_store: "Shopping", book_store: "Shopping",
  shoe_store: "Shopping", electronics_store: "Shopping", shopping_mall: "Shopping",
  bicycle_store: "Shopping", jewelry_store: "Shopping", florist: "Shopping", furniture_store: "Shopping",
  hardware_store: "Shopping", pet_store: "Shopping", 
};


let places = {};                            // station → [place, …]
let chosenStartStation = null;   // temp until we create the trip


async function loadPlaces () {
  const resp = await fetch('./places.json');
  if (!resp.ok) throw new Error(`Couldn't load places (${resp.status})`);

  const raw = await resp.json();          // could be []  or  {station:[…]}

  // If raw is already an array, keep it; otherwise flatten the object’s values
  const rows = Array.isArray(raw) ? raw : Object.values(raw).flat();

  // Build station-centric lookup table:  station → [place, …]
  places = rows.reduce((acc, row) => {
    row.categories = [...new Set(
      row.types.map(t => typeToCategory[t]).filter(Boolean)
    )];
    if (row.categories.length === 0) row.categories = ['Surprise'];
    (acc[row.station] ??= []).push(row);
    return acc;
  }, {});
}   // ← closes loadPlaces



/* wait for the dataset, THEN wire up the Start button */
/* wait for the dataset, THEN wire up the Start button */
document.addEventListener('DOMContentLoaded', async () => {
  await loadPlaces();                        // places[] is now ready

  const startBtn = document.getElementById('start-btn');
  startBtn.onclick = () => {
    pinLogo();
    renderLineSelection();
    showScreen('line-screen');
  };
});




/* ------------------------------ view helpers ----------------------------- */
function showScreen(id) {
  // slide current screen out
  document.querySelectorAll(".screen.active").forEach(el => {
    el.classList.add("slide-out");
    el.classList.remove("active");
    el.addEventListener("transitionend", () => (el.hidden = true), { once: true });
  });

  // bring next screen in
  const next = document.getElementById(id);
  next.hidden = false;
  next.classList.add("slide-in");
  requestAnimationFrame(() => {
    next.classList.remove("slide-in");
    next.classList.add("active");
  });
}

/* ------------------------------ global state ----------------------------- */
let selectedLine   = null;           // metroLines[x]
let currentTrip    = null;           // { line, startStation, numStops, destStation, terminal }
let preferredCategory = null;        // reserved for future activity picker

// handy map of big hubs so users can quick‑start from transfer points
const hubLines = {
  "Metro Center"  : ["Red","Orange","Silver","Blue"],
  "Gallery Place" : ["Red","Green","Yellow"],
  "L'Enfant Plaza": ["Green","Yellow","Blue","Silver","Orange"]
};

/* ------------------------------ logo helper ------------------------------ */
function pinLogo() {
  const logo = document.getElementById("logo");
  if (!logo || logo.classList.contains("sticky")) return; // only once

  document.body.appendChild(logo);               // move out of intro container
  requestAnimationFrame(() => logo.classList.add("sticky"));
}

/* ------------------------------ GSAP slot helper ------------------------- */
// (CDN already loaded in index.html)
/* ------------------------------ GSAP slot helper (smooth decel) --------- */
/* Usage:
     await gsapSlot(el,
                    Array.from({length: 15}, (_,i)=>`${i+1}`),
                    `${trip.numStops}`,
                    40);                  // hops
*/
export function gsapSlot (el, items, finalText, hops = 40) {
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('active'));

  return new Promise(resolve => {

    const tl = gsap.timeline({ onComplete: resolve });

    /* CONFIGURE THE RAMP -------------------------------------------------- */
    const minHop = 0.04;   // seconds – initial blur-fast speed
    const maxHop = 0.18;   // seconds – final click-click speed
    const ease   = t => t*t;   // quadratic → smooth deceleration curve
                               // 0 → 0   and   1 → 1   (feel free to tweak)

    for (let i = 0; i < hops; i++) {
      const progress = i / (hops - 1);          // 0 … 1
      const dur      = gsap.utils.interpolate(minHop, maxHop, ease(progress));

      /* For every hop *except* the last, cycle through the reel array.
         The very last hop sets the actual finalText, so there’s no jump. */
      const text = (i === hops - 1) ? finalText
                                    : items[i % items.length];

      tl.to({}, { duration: dur,
                  onStart: () => (el.textContent = text) });
    }
  });
}


/* ------------------------------ LINE picker ------------------------------ */
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

  /* create line circles */
  const lp = screen.querySelector("#line-picker");
  metroLines.forEach((line, idx) => {
    const btn = document.createElement("button");
    btn.className        = "line-circle";
    btn.style.background = line.color;
    btn.textContent      = line.name[0];
    btn.title            = `${line.name} Line`;
    btn.dataset.idx      = idx;
    if (line.name === "Yellow") btn.style.color = "#000"; // contrast
    lp.appendChild(btn);
  });

  // delegated click
  lp.onclick = e => {
    const t = e.target.closest(".line-circle");
    if (!t) return;
    selectedLine = metroLines[Number(t.dataset.idx)];
    renderStationSelection();
    showScreen("station-screen");
  };

  /* hub quick‑start */
/* hub quick-start --------------------------------------------------- */
const hp = screen.querySelector("#hub-picker");
hp.onclick = e => {
  const t = e.target.closest(".hub-btn");
  if (!t) return;

  const hub = t.dataset.hub;                    // “Metro Center”, etc.

  // pick a random line that serves that hub
  const randomLineName = hubLines[hub][
    Math.floor(Math.random() * hubLines[hub].length)
  ];
  selectedLine = metroLines.find(l => l.name === randomLineName);

  // save the start-station just like the normal flow does
  chosenStartStation = hub;

  // now show the same category picker everyone else sees
  renderCategorySelection();
  showScreen("category-screen");
};

}

/* ------------------------------ STATION picker --------------------------- */
function renderStationSelection() {
  const screen = document.getElementById("station-screen");
  screen.innerHTML = `
    <h2 class="screen-title">${selectedLine.name} Line</h2>
    <p class="subtitle">Choose your starting station:</p>
    <input id="station-search" class="station-search" type="text" placeholder="Type a station…">
    <div id="station-picker" class="station-picker"></div>
    <button id="back-btn" class="text-link">⬅ Back</button>`;

  const sp = screen.querySelector("#station-picker");
  selectedLine.stations.forEach(stop => {
    const b = document.createElement("button");
    b.className   = "station-btn";
    b.textContent = stop;
    sp.appendChild(b);
  });

  // pick station
sp.onclick = e => {
  const t = e.target.closest(".station-btn");
  if (!t) return;
  chosenStartStation = t.textContent;
  renderCategorySelection();
  showScreen("category-screen");
};

  /* live search */
  const search = screen.querySelector("#station-search");
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    sp.querySelectorAll(".station-btn").forEach(btn => {
      btn.style.display = btn.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
  search.focus();

  /* back */
  screen.querySelector("#back-btn").onclick = () => {
    renderLineSelection();
    showScreen("line-screen");
  };
}

function renderCategorySelection() {
  let screen = document.getElementById('category-screen');

  // First visit → build the DOM
  if (!screen) {
    screen = document.createElement('section');
    screen.id = 'category-screen';
    screen.className = 'screen';
    screen.hidden = true;
    screen.innerHTML = `
      <h2 class="screen-title">Pick a vibe</h2>
      <div id="category-grid" class="category-grid">
        <button class="cat-btn" data-cat="Drinks"><img src="images/drinks.svg"><span>Drinks</span></button>
        <button class="cat-btn" data-cat="Coffee"><img src="images/coffee.svg"><span>Coffee</span></button>
        <button class="cat-btn" data-cat="Activity"><img src="images/activity.svg"><span>Activity</span></button>
        <button class="cat-btn" data-cat="Food"><img src="images/food.svg"><span>Food</span></button>
        <button class="cat-btn" data-cat="Shopping"><img src="images/shopping.svg"><span>Shopping</span></button>
        <button class="cat-btn" data-cat="Surprise"><img src="images/random.svg"><span>Surprise me</span></button>
      </div>
      <button id="cat-back-btn" class="text-link">⬅ Back</button>`;
    document.body.appendChild(screen);
  }

  /* back button */
  screen.querySelector('#cat-back-btn').onclick = () => {
    renderStationSelection();
    showScreen('station-screen');
  };

  /* click on a category */
  screen.querySelector('#category-grid').onclick = e => {
    const b = e.target.closest('.cat-btn');
    if (!b) return;
    preferredCategory = b.dataset.cat;
    const trip = getTrip(
      selectedLine,
      selectedLine.stations.indexOf(chosenStartStation)
    );
    animateMysteryTrip(selectedLine, chosenStartStation, trip);
    showScreen('trip-screen');
  };
}


/* ------------------------------ TRIP helper ------------------------------ */
function getTrip(line, startIdx) {
  const last     = line.stations.length - 1;
  const toFirst  = startIdx;          // stops to index 0
  const toLast   = last - startIdx;   // stops to terminus
  const direction = (toFirst && toLast) ? (Math.random() < 0.5 ? "first" : "last")
                                        : (toFirst ? "first" : "last");
  const maxStops  = direction === "first" ? toFirst : toLast;
  const numStops  = Math.floor(Math.random() * maxStops) + 1; // 1 … max
  const destIdx   = direction === "first" ? startIdx - numStops : startIdx + numStops;

  return {
    numStops,
    destStation : line.stations[destIdx],
    terminal    : direction === "first" ? line.stations[0] : line.stations[last]
  };
}

/* ------------------------------------------------- SVG builder */
function buildRouteSVG(lineColor, numStops){
  const spacing   = 36;                           // px between station dots
  const radius    = 7;                            // dot radius
  const width     = (numStops * spacing) + radius*2;
  const strokeW   = 6;

  // horizontal path from left edge to last dot
  const pathD = `M ${radius} ${27} H ${width - radius}`;

  // make tick marks (small circles) for each intermediate stop
  const ticks = Array.from({length:numStops-1},(_,i)=>{
    const x = radius + (i+1)*spacing;
    return `<circle cx="${x}" cy="27" r="5" fill="${lineColor}" opacity="0.5"/>`;
  }).join("");

  return `
  <svg viewBox="0 0 ${width} 54" id="route-svg">
    <path id="route-path" d="${pathD}"
          stroke="${lineColor}" stroke-width="${strokeW}"
          stroke-linecap="round" fill="none"/>
    ${ticks}
    <circle id="dest-dot" cx="${width-radius}" cy="27" r="${radius}"
            fill="${lineColor}"/>
  </svg>`;
}

/* ------------------------------------------------- animation */
function animateRouteSVG(){
  const path = document.getElementById("route-path");
  const len  = path.getTotalLength();

  // prep: hide the line & dot
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  gsap.set("#dest-dot", { scale: 1.7, transformOrigin:"center" });

  // animate sweep + pop
  gsap.to(path, { strokeDashoffset: 0, duration:1.2, ease:"power2.out" });
  gsap.to("#dest-dot", { scale:1.3, duration:0.45, ease:"back.out(2)", delay:1.05 });
}


/* Ticket printer: paper unrolls, text types */
function printTicket(boxEl, newText, delay = 0){
  const paperWrap = boxEl.parentElement;   // .ticket-wrap
  const baseDur   = 0.5;                   // typing duration

  // prep: collapse the paper strip
  gsap.set(paperWrap, { scaleX:0 });

  return gsap.timeline({ delay })
    // grow paper out of the slot
    .to(paperWrap, { scaleX:1, duration:0.35, ease:"none" })
    // type the label
    .to(boxEl, { text:newText, duration:baseDur, ease:"none" }, "<");
}


/* ------------------------------ TRIP animation --------------------------- */
function animateMysteryTrip(line, startStation, trip) {
  /* customise these pauses */
  const DELAY_START         = 0.40;  // after card reveal → ticket strip
  const DELAY_ROUTE         = 0.50;  // after slot spin   → SVG route
  const DELAY_ARRIVAL_EXTRA = 0.20;  // after SVG route   → arrival text

  /* keep a copy so the venue screen can reuse details later */
  currentTrip = { line, startStation, ...trip };

  const screen = document.getElementById("trip-screen");

  /* ── 1. “thinking” animation ─────────────────────────────────────────── */
  const bulb = screen.querySelector("#thinking-box");
  bulb.classList.remove("hidden");
  bulb.style.display = "flex";

  /* little suspense pause (TIMING.suspense = 0.7 s) */
  setTimeout(async () => {
    bulb.style.display = "none";

    /* ── 2. show the result card shell ─────────────────────────────────── */
    const card = screen.querySelector("#result-card");
    card.classList.remove("hidden");
    requestAnimationFrame(() => card.classList.add("active"));

    /* key elements ------------------------------------------------------- */
    const lineBox   = screen.querySelector("#line-box");   // ticket strip
    const stopNum   = card.querySelector("#stop-number");  // slot number
    const paperWrap = lineBox.parentElement;               // .ticket-wrap

    /* reveal the outer box and trigger its fade-in */
    const revealBox = paperWrap.closest(".reveal-box");
    revealBox.classList.remove("hidden");
    requestAnimationFrame(() => revealBox.classList.add("active"));

    /* ── 3. prep the ticket strip (dot + arrow + terminal) --------------- */
const dotHTML = `<span class="line-dot ${line.name==="Silver"?"silver":""}"
                  style="background:${line.color}"></span>`;
lineBox.innerHTML = `${dotHTML}<span class="arrow">⮕  </span> ${trip.terminal}`;

    /* collapse the paper so nothing shows yet */
    paperWrap.classList.remove("hidden");
    gsap.set(paperWrap, { scaleX: 0 });

    /* ensure the number’s paper is always visible */
    gsap.set(stopNum.parentElement, { scaleX: 1 });

    /* ── A. pause, then unroll the ticket strip ------------------------- */
    await gsap.to({}, { duration: DELAY_START });          // extra wait
    await gsap.to(paperWrap, {
      scaleX   : 1,
      duration : TIMING.paper,      // 0.35 s
      ease     : "none"
    });

    /* ── B. classic slot-machine spin for the stop total ---------------- */
    await gsapSlot(
      stopNum,
      Array.from({ length: 15 }, (_, i) => `${i + 1}`), // 1 … 15 scrolling
      `${trip.numStops}`,                                // final value
      TIMING.slotSpin                                    // 14 hops
    );

    /* ── C. fill in static details -------------------------------------- */
    stopNum.textContent = trip.numStops;
    card.querySelector("#trip-origin").textContent  = `Depart: ${startStation}`;
    card.querySelector("#trip-subtext").textContent =
      `${trip.numStops} stop${trip.numStops !== 1 ? "s" : ""}`;

    /* header, origin, subtext fade-in */
    ["trip-header", "trip-origin", "trip-subtext"].forEach((id, i) => {
      const el = card.querySelector("#" + id);
      if (!el) return;
      el.classList.remove("fade-in");
      void el.offsetWidth;
      setTimeout(() => el.classList.add("fade-in"), i * 140);
    });

    /* ── D. pause, then draw & animate the route diagram ---------------- */
    await gsap.to({}, { duration: DELAY_ROUTE });

    const routeVis = card.querySelector("#route-vis");
    routeVis.innerHTML = buildRouteSVG(line.color, trip.numStops);
    animateRouteSVG();                                 // 1.2 s sweep + 0.45 s dot-pop

    /* ── E. arrival sentence *last* ------------------------------------- */
const arrival = card.querySelector("#arrival-text");
arrival.textContent = `You’ll arrive at ${trip.destStation}.`;
arrival.classList.remove("hidden");

/* Optional extra delay so it runs *after* the route animation */
const EXTRA_WAIT = 0.20;  // seconds  (match what you used earlier)

gsap.fromTo(
  arrival,
  { opacity: 0, y: 16, scale: 0.95 },   // *** starting values ***
  {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.6,
    ease: "power2.out",
    delay: EXTRA_WAIT                    // <-- shift the whole tween
  }
);


    /* ── F. action buttons ---------------------------------------------- */
    const btnWrap = screen.querySelector(".trip-buttons");
    btnWrap.classList.remove("hidden");
    requestAnimationFrame(() => btnWrap.classList.add("fade-in"));

    btnWrap.querySelector("#arrived-btn").onclick = handleArrival;
    btnWrap.querySelector("#play-again").onclick  = restart;
  }, TIMING.suspense * 1000);   // 0.7 s bulb delay
}


/* ------------ VENUE reveal + reroll -------------------------------------- */
/* ------------ VENUE reveal + animated reroll ------------------------------ */
function handleArrival () {
  const canonical = stationAlias[currentTrip.destStation] ?? currentTrip.destStation;

  const pickVenue = (excludeName = null) => {
    let pool = places[canonical] ?? [];

    if (preferredCategory && preferredCategory !== "Surprise") {
      const filtered = pool.filter(p => p.categories.includes(preferredCategory));
      if (filtered.length) pool = filtered;           // fall back if empty
    }

    // draw until different (when possible)
    let v;
    do { v = pool[Math.random() * pool.length | 0]; }
    while (excludeName && v.name === excludeName && pool.length > 1);
    return v;
  };

  const vs = document.getElementById("venue-screen");
  populateVenue(vs, pickVenue());        // initial details

  /* animated re-roll */
  vs.querySelector("#new-place-btn").onclick = () => {
    const oldName = vs.querySelector("#venue-name").textContent;
    const fresh   = pickVenue(oldName);
    animateVenueSwap(vs, fresh);
  };

  vs.querySelector("#start-over-btn").onclick = restart;
  showScreen("venue-screen");
}

/* swaps the text with a quick slide-out / slide-in */
function animateVenueSwap (vs, venue) {
  const lines = vs.querySelectorAll(".vline");

  gsap.timeline()
    .to(lines, { x:-280, opacity:0, duration:0.28, stagger:0.04, ease:"power1.in" })
    .add(() => populateVenue(vs, venue))          // change the text
    .fromTo(lines, { x:320, opacity:0 },
                    { x:0,  opacity:1, duration:0.32, stagger:0.04, ease:"power1.out" });
}

/* small helper to fill the three text fields */
function populateVenue (vs, v) {
  vs.querySelector("#venue-name").textContent    = v.name;
  vs.querySelector("#venue-address").textContent = v.address;
  vs.querySelector("#venue-note").textContent    = v.note ?? "";
}


/* ------------------------------ restart helper --------------------------- */
/* ------------------------------ HARD RESET ------------------------------ */
/* call this from  #play-again  and  #start-over  */
function restart () {
window.location.reload();
}

/* ------------------------------ bootstrap -------------------------------*/
