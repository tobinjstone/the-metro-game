let currentTrip  = null;   // holds { line, startStation, numStops, terminal, destStation }
let mysteryShown = false;  // whether the user is on the mystery screen

/* ---------------- Major transfer hubs ---------------- */
const hubLines = {
  "Metro Center":  ["Red", "Orange", "Silver", "Blue"],
  "Gallery Place": ["Red", "Green", "Yellow"],
  "L'Enfant Plaza":["Green", "Yellow", "Blue", "Silver", "Orange"]
};

/* ===== Metro data (sample) ===== */
import { metroLines } from './metro-lines.js';


/* ============================== */

let selectedLine = null;

/* STEP 0 – intro → line select */
function startGame() {
  document.getElementById("intro").hidden = true;
  document.getElementById("game-area").hidden = false;
  renderLineSelection();
}
/* ---------- TRIP CALC HELPERS ---------- */

/** Pick a direction (toward a terminal) & how many stops you can ride */
function getTrip(line, startIndex) {
  const lastIndex = line.stations.length - 1;

  // distance to each terminal
  const distToFirst = startIndex;        // toward index 0
  const distToLast  = lastIndex - startIndex; // toward the end

  // build an array of “available directions”
  const choices = [];
  if (distToFirst > 0) choices.push({ dir: "first", max: distToFirst });
  if (distToLast  > 0) choices.push({ dir: "last",  max: distToLast  });

  // randomly pick one of the possible directions
  const pick = choices[Math.floor(Math.random() * choices.length)];

  // randomly pick # of stops within the allowed range (1 … max)
  const numStops = Math.floor(Math.random() * pick.max) + 1;

  // calculate destination index
  const destIndex =
    pick.dir === "first" ? startIndex - numStops : startIndex + numStops;

  return {
    numStops,
    destStation: line.stations[destIndex],
    terminal:    pick.dir === "first" ? line.stations[0] : line.stations[lastIndex]
  };
}

/** Render the result screen */
/** Render the mystery trip card (keeps destination secret) */
function showMysteryTrip(line, startStation, trip) {
  currentTrip  = { line, startStation, ...trip };   // store for later
  mysteryShown = true;

  document.getElementById("game-area").innerHTML = `
    <h2>Your Journey</h2>
    <p>Start at <strong>${startStation}</strong> on the ${line.name} Line.</p>
    <p>Ride <strong>${trip.numStops}</strong> stop${trip.numStops > 1 ? "s" : ""}</p>
    <p><em>toward ${trip.terminal}</em>.</p>

    <button id="arrived-btn">I’ve arrived</button>
    <button id="play-again">Restart</button>
  `;

  document.getElementById("arrived-btn").onclick = handleArrival;
  document.getElementById("play-again").onclick  = () => {
    selectedLine = null;
    currentTrip  = null;
    mysteryShown = false;
    renderLineSelection();
  };
}
function handleArrival() {
  // For now: just reveal where they ended up
  alert(
    `Welcome to ${currentTrip.destStation}!\n\n` +
    "(This is where we’ll soon list nearby bars/cafés.)"
  );

  // TODO: replace alert with renderActivityOptions(currentTrip)
}


/* STEP 1 – pick a line */
function renderLineSelection() {
  const el = document.getElementById("game-area");
  el.innerHTML = `
   <h2>I’m starting from…</h2>
  <p>Select a Metro line:</p>
  <div id="line-picker"></div>

  <h3 class="hub-heading">…or start at a transfer hub:</h3>
  <div id="hub-picker">
    ${Object.keys(hubLines)
        .map(h => `<button class="hub-btn" data-hub="${h}">${h}</button>`)
        .join("")}
  </div>
`;

  const picker = document.getElementById("line-picker");
  picker.innerHTML = ""; // clear just in case

  metroLines.forEach((line, i) => {
    const btn = document.createElement("button");
    btn.className = "line-circle";
    btn.style.background = line.color;
    btn.title = `${line.name} Line`;
    btn.dataset.index = i;
    picker.appendChild(btn);
  });

  picker.onclick = (e) => {
    if (!e.target.classList.contains("line-circle")) return;
    selectedLine = metroLines[Number(e.target.dataset.index)];
    renderStationSelection();
  };
}
/* ----- hub buttons ----- */
document.getElementById("hub-picker").onclick = e => {
  if (!e.target.classList.contains("hub-btn")) return;

  const hubName      = e.target.dataset.hub;
  const linesAtHub   = hubLines[hubName];
  const chosenName   = linesAtHub[Math.floor(Math.random() * linesAtHub.length)];
  const lineObj      = metroLines.find(l => l.name === chosenName);

  // Proceed straight to the mystery-trip step
  const startIndex   = lineObj.stations.indexOf(hubName);
  const trip         = getTrip(lineObj, startIndex);
  showMysteryTrip(lineObj, hubName, trip);
};

/* STEP 2 – pick a station */
function renderStationSelection() {
  const el = document.getElementById("game-area");
  el.innerHTML = `
    <h2>${selectedLine.name} Line</h2>
    <p>Choose your starting station:</p>
    <div id="station-picker"></div>
    <button id="back-btn">⬅ Back</button>
  `;

  const picker = document.getElementById("station-picker");

  selectedLine.stations.forEach((stop) => {
    const btn = document.createElement("button");
    btn.className = "station-btn";
    btn.textContent = stop;
    picker.appendChild(btn);
  });

picker.onclick = e => {
  if (!e.target.classList.contains("station-btn")) return;

  const startStation = e.target.textContent;
  const startIndex   = selectedLine.stations.indexOf(startStation);

const trip = getTrip(selectedLine, startIndex);
showMysteryTrip(selectedLine, startStation, trip);   // ← WAS showTripResult

};


  document.getElementById("back-btn").onclick = renderLineSelection;
}

/* wire up Start button */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").onclick = startGame;
});
