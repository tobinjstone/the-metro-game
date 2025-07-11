// ------------------------------ imports ----------------------------------
import { metroLines } from "./metro-lines.js";
import { venues }     from "./venues.js";

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
export function gsapSlot(el, items, finalText, spins = 40) {
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("active"));

  return new Promise(resolve => {
    const tl = gsap.timeline({
      onComplete: () => {
        el.textContent = finalText;
        resolve();
      }
    });

    const base = 0.04; // 40 ms per hop
    for (let i = 0; i < spins; i++) {
      tl.to({}, {
        duration: base,
        onStart: () => (el.textContent = items[i % items.length])
      });
    }
    tl.to({}, { duration: 0.8, ease: "power3.out" });
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
  const hp = screen.querySelector("#hub-picker");
  hp.onclick = e => {
    const t = e.target.closest(".hub-btn");
    if (!t) return;
    const hub = t.dataset.hub;
    const randomLineName = hubLines[hub][Math.floor(Math.random()*hubLines[hub].length)];
    const line = metroLines.find(l => l.name === randomLineName);
    const startIdx = line.stations.indexOf(hub);
    const trip = getTrip(line, startIdx);
    animateMysteryTrip(line, hub, trip);
    showScreen("trip-screen");
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
    const start = t.textContent;
    const trip  = getTrip(selectedLine, selectedLine.stations.indexOf(start));
    animateMysteryTrip(selectedLine, start, trip);
    showScreen("trip-screen");
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

/* ------------------------------ TRIP animation --------------------------- */
function animateMysteryTrip(line, startStation, trip) {
  currentTrip = { line, startStation, ...trip };
  const screen = document.getElementById("trip-screen");

  // show thinking
  const bulb = screen.querySelector("#thinking-box");
  bulb.classList.remove("hidden");
  bulb.style.display = "flex";

  setTimeout(async () => {
    bulb.style.display = "none";

  

    const card = screen.querySelector("#result-card");
    card.classList.remove("hidden");
    requestAnimationFrame(() => card.classList.add("active"));

    // spin!
    const lineBox = screen.querySelector("#line-box");
    const dirBox  = screen.querySelector("#direction-box");
    const stopNum = card.querySelector("#stop-number");

    const spinLine = gsapSlot(lineBox,
      ["Red Line","Blue Line","Orange Line","Silver Line","Green Line","Yellow Line"],
      `${line.name} Line`);

    const spinDir  = gsapSlot(dirBox,
      ["⮕ Shady Grove","⮕ Glenmont","⮕ New Carrollton","⮕ Largo Town Center","⮕ Franconia","⮕ Huntington","⮕ Branch Ave","⮕ Ashburn"],
      `⮕ ${trip.terminal}`);

    const spinStop = gsapSlot(stopNum,
      Array.from({length:15},(_,i)=>`${i+1}`), `${trip.numStops}`);

    await Promise.all([spinLine, spinDir, spinStop]);

    // populate final details
    stopNum.textContent = trip.numStops;
    const dot = `<span class="line-dot ${line.name === "Silver" ? "silver" : ""}" style="background:${line.color}"></span>`;
    card.querySelector("#trip-route").innerHTML =
  `${dot}${line.name} Line towards ${trip.terminal}`;
    lineBox.innerHTML = `${dot}${line.name} Line`;
    card.querySelector("#trip-origin").textContent =
  `Depart: ${startStation}`;
    card.querySelector("#trip-subtext").textContent =
  `${trip.numStops} stop${trip.numStops !== 1 ? "s" : ""}`;
  
    const arrival = card.querySelector("#arrival-text");
    arrival.textContent = `You’ll arrive at ${trip.destStation}.`;
    arrival.classList.remove("hidden");
    requestAnimationFrame(() => arrival.classList.add("fade-in"));

    // buttons visible
    const btnWrap = screen.querySelector(".trip-buttons");
btnWrap.classList.remove("hidden");
requestAnimationFrame(() => btnWrap.classList.add("fade-in")); // <— add this

    btnWrap.querySelector("#arrived-btn").onclick = handleArrival;
    btnWrap.querySelector("#play-again").onclick = restart;
  }, 700); // thinking pause
}

/* ------------------------------ VENUE reveal ----------------------------- */
function handleArrival() {
  const list  = venues[currentTrip.destStation] || [];
  const venue = list.length
      ? list[Math.floor(Math.random() * list.length)]
      : { name: "…no curated spot yet 😅",
          address: "",
          note: "Explore & tell us what you find!" };

  const vs = document.getElementById("venue-screen");
  vs.querySelector("#venue-name").textContent    = venue.name;
  vs.querySelector("#venue-address").textContent = venue.address;   // NEW
  vs.querySelector("#venue-note").textContent    = venue.note;
  vs.querySelector("#play-again-2").onclick      = restart;

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

/* ------------------------------ bootstrap -------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").onclick = () => {
    pinLogo();
    renderLineSelection();
    showScreen("line-screen");
  };
});
