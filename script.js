// script.js  – ES-module entry point
import { metroLines } from './metro-lines.js';

function showScreen(id) {
  // hide any currently active screen
  document.querySelectorAll('.screen.active').forEach(el => {
    el.classList.add('slide-out');
    el.classList.remove('active');
    // when the animation ends, actually hide it
    el.addEventListener('transitionend', () => el.hidden = true, { once:true });
  });

  // reveal & slide in the requested screen
  const target = document.getElementById(id);
  target.hidden = false;                // make it part of flow
  target.classList.add('slide-in');     // start below viewport

  // allow one frame so the browser registers the start position
  requestAnimationFrame(() => {
    target.classList.remove('slide-in');
    target.classList.add('active');     // animate into place
  });
}

/* ----------------- global state ----------------- */
let selectedLine = null;
let currentTrip  = null;   // { line, startStation, numStops, terminal, destStation }

/* ---------------- transfer hubs ----------------- */
const hubLines = {
  "Metro Center":  ["Red", "Orange", "Silver", "Blue"],
  "Gallery Place": ["Red", "Green", "Yellow"],
  "L'Enfant Plaza":["Green", "Yellow", "Blue", "Silver", "Orange"]
};

/* ============= bootstrap ============= */
document.getElementById('start-btn').onclick = () => {
  showScreen('line-screen');      // <— NEW
  renderLineSelection();          // rebuild the circles + hub buttons
};


/* ============= start screen ============= */
function startGame() {
  renderLineSelection();
}

/* ============= line / hub picker ============= */
function renderLineSelection() {
  const area = document.getElementById('game-area');
  area.innerHTML = `
    <h2>I’m starting from…</h2>
    <p>Select a Metro line:</p>
    <div id="line-picker"></div>

    <h3 class="hub-heading">…or start at a transfer hub:</h3>
    <div id="hub-picker">
      ${Object.keys(hubLines)
        .map(h => `<button class="hub-btn" data-hub="${h}">${h}</button>`)
        .join('')}
    </div>
  `;

  /* --- line circles --- */
  const linePicker = document.getElementById('line-picker');
  metroLines.forEach((line, idx) => {
    const btn = document.createElement('button');
    btn.className       = 'line-circle';
    btn.style.background = line.color;
    btn.title           = `${line.name} Line`;
    btn.dataset.index   = idx;
    linePicker.appendChild(btn);
  });
  linePicker.onclick = e => {
  if (!e.target.classList.contains('line-circle')) return;
  selectedLine = metroLines[Number(e.target.dataset.index)];
  renderStationSelection();          // keep this
  showScreen('station-screen');      // <— ADD this
};


  /* --- hub buttons --- */
  const hubPicker = document.getElementById('hub-picker');
  hubPicker.onclick = e => {
    if (!e.target.classList.contains('hub-btn')) return;

    const hubName    = e.target.dataset.hub;
    const linesAtHub = hubLines[hubName];
    const chosenName = linesAtHub[Math.floor(Math.random() * linesAtHub.length)];
    const lineObj    = metroLines.find(l => l.name === chosenName);

    const startIndex = lineObj.stations.indexOf(hubName);
    const trip = getTrip(lineObj, startIndex);
showMysteryTrip(lineObj, hubName, trip);
showScreen('trip-screen');           // <— NEW

  };
}

/* ============= station picker ============= */
function renderStationSelection() {
  const area = document.getElementById('game-area');
  area.innerHTML = `
    <h2>${selectedLine.name} Line</h2>
    <p>Choose your starting station:</p>
    <div id="station-picker"></div>
    <button id="back-btn">⬅ Back</button>
  `;

  const picker = document.getElementById('station-picker');
  selectedLine.stations.forEach(stop => {
    const btn = document.createElement('button');
    btn.className   = 'station-btn';
    btn.textContent = stop;
    picker.appendChild(btn);
  });

picker.onclick = e => {
  if (!e.target.classList.contains('station-btn')) return;

  const startStation = e.target.textContent;
  const startIndex   = selectedLine.stations.indexOf(startStation);
  const trip         = getTrip(selectedLine, startIndex);

  showMysteryTrip(selectedLine, startStation, trip);
  showScreen('trip-screen');         // <— NEW
};


document.getElementById('back-btn').onclick = () => {
  showScreen('line-screen');
  renderLineSelection();
};


/* ============= trip logic helpers ============= */
function getTrip(line, startIndex) {
  const lastIndex   = line.stations.length - 1;
  const distToFirst = startIndex;
  const distToLast  = lastIndex - startIndex;

  const choices = [];
  if (distToFirst > 0) choices.push({ dir: 'first', max: distToFirst });
  if (distToLast  > 0) choices.push({ dir: 'last',  max: distToLast  });

  const pick     = choices[Math.floor(Math.random() * choices.length)];
  const numStops = Math.floor(Math.random() * pick.max) + 1;

  const destIndex = pick.dir === 'first'
    ? startIndex - numStops
    : startIndex + numStops;

  return {
    numStops,
    destStation: line.stations[destIndex],
    terminal:    pick.dir === 'first' ? line.stations[0] : line.stations[lastIndex]
  };
}

/* ============= mystery trip screen ============= */
function showMysteryTrip(line, startStation, trip) {
  currentTrip = { line, startStation, ...trip };

  document.getElementById('game-area').innerHTML = `
    <h2>Your Journey</h2>
    <p>Start at <strong>${startStation}</strong> on the ${line.name} Line.</p>
    <p>Ride <strong>${trip.numStops}</strong> stop${trip.numStops > 1 ? 's' : ''}</p>
    <p><em>toward ${trip.terminal}</em>.</p>

    <button id="arrived-btn">I’ve arrived</button>
    <button id="play-again">Restart</button>
  `;

  document.getElementById('arrived-btn').onclick = handleArrival;
document.getElementById('play-again').onclick = () => {
  selectedLine = null;
  currentTrip  = null;
  renderLineSelection();
  showScreen('line-screen');         // <— NEW
};

}

function handleArrival() {
  // Placeholder: reveal destination
  alert(`Welcome to ${currentTrip.destStation}! (Attractions coming soon.)`);
}}
