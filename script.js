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
function showTripResult(line, startStation, trip) {
  document.getElementById("game-area").innerHTML = `
    <h2>Your Journey</h2>
    <p>Start at <strong>${startStation}</strong> on the ${line.name} Line.</p>
    <p>Ride <strong>${trip.numStops}</strong> stop${trip.numStops > 1 ? "s" : ""}</p>
    <p><em>toward ${trip.terminal}</em>.</p>
    <p>You’ll get off at <strong>${trip.destStation}</strong>.</p>
    <button id="play-again">Play Again</button>
  `;

  document.getElementById("play-again").onclick = () => {
    // restart at the line-selection step
    selectedLine = null;
    renderLineSelection();
  };
}

/* STEP 1 – pick a line */
function renderLineSelection() {
  const el = document.getElementById("game-area");
  el.innerHTML = `
    <h2>I’m starting from…</h2>
    <p>Select a Metro line:</p>
    <div id="line-picker"></div>
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
  showTripResult(selectedLine, startStation, trip);
};


  document.getElementById("back-btn").onclick = renderLineSelection;
}

/* wire up Start button */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").onclick = startGame;
});
