// ---------- imports ---------------------------------------------------
import { metroLines } from './metro-lines.js';

/* ---------- slide-transition helper --------------------------------- */
function showScreen(id) {
  document.querySelectorAll('.screen.active').forEach(el => {
    el.classList.add('slide-out');
    el.classList.remove('active');
    el.addEventListener('transitionend', () => (el.hidden = true), { once: true });
  });

  const target = document.getElementById(id);
  target.hidden = false;
  target.classList.add('slide-in');
  requestAnimationFrame(() => {
    target.classList.remove('slide-in');
    target.classList.add('active');
  });
}

/* ---------- global state -------------------------------------------- */
let selectedLine = null;
let currentTrip  = null;

const hubLines = {
  'Metro Center':  ['Red','Orange','Silver','Blue'],
  'Gallery Place': ['Red','Green','Yellow'],
  "L'Enfant Plaza":['Green','Yellow','Blue','Silver','Orange']
};

/* ---------- bootstrap ------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').onclick = () => {
    renderLineSelection();
    showScreen('line-screen');
  };
});

/* ---------- line / hub picker --------------------------------------- */
function renderLineSelection() {
  const area = document.getElementById('line-screen');
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

  /* line circles */
  const lp = area.querySelector('#line-picker');
  metroLines.forEach((line, i) => {
    const b = document.createElement('button');
    b.className = 'line-circle';
    b.style.background = line.color;
    b.title = `${line.name} Line`;
    b.dataset.idx = i;
    lp.appendChild(b);
  });

  lp.onclick = e => {
    if (!e.target.classList.contains('line-circle')) return;
    selectedLine = metroLines[Number(e.target.dataset.idx)];
    renderStationSelection();
    showScreen('station-screen');
  };

  /* hub buttons */
  const hp = area.querySelector('#hub-picker');
  hp.onclick = e => {
    if (!e.target.classList.contains('hub-btn')) return;
    const hub  = e.target.dataset.hub;
    const rnd  = hubLines[hub][Math.floor(Math.random()*hubLines[hub].length)];
    const line = metroLines.find(l => l.name === rnd);

    const startIdx = line.stations.indexOf(hub);
    const trip     = getTrip(line, startIdx);
    showMysteryTrip(line, hub, trip);
    showScreen('trip-screen');
  };
}

/* ---------- station picker ------------------------------------------ */
function renderStationSelection() {
  const area = document.getElementById('station-screen');
  area.innerHTML = `
    <h2>${selectedLine.name} Line</h2>
    <p>Choose your starting station:</p>
    <div id="station-picker"></div>
    <button id="back-btn">⬅ Back</button>
  `;

  const sp = area.querySelector('#station-picker');
  selectedLine.stations.forEach(stop => {
    const b = document.createElement('button');
    b.className = 'station-btn';
    b.textContent = stop;
    sp.appendChild(b);
  });

  sp.onclick = e => {
    if (!e.target.classList.contains('station-btn')) return;
    const start   = e.target.textContent;
    const trip    = getTrip(selectedLine, selectedLine.stations.indexOf(start));
    showMysteryTrip(selectedLine, start, trip);
    showScreen('trip-screen');
  };

  area.querySelector('#back-btn').onclick = () => {
    renderLineSelection();
    showScreen('line-screen');
  };
}

/* ---------- trip calc helper ---------------------------------------- */
function getTrip(line, startIdx) {
  const last    = line.stations.length - 1;
  const toFirst = startIdx;
  const toLast  = last - startIdx;

  const choice  = (toFirst && toLast)
    ? (Math.random() < 0.5 ? 'first' : 'last')
    : (toFirst ? 'first' : 'last');

  const max     = choice === 'first' ? toFirst : toLast;
  const stops   = Math.floor(Math.random()*max) + 1;
  const destIdx = choice === 'first' ? startIdx - stops : startIdx + stops;

  return {
    numStops: stops,
    destStation: line.stations[destIdx],
    terminal: choice === 'first' ? line.stations[0] : line.stations[last]
  };
}

/* ---------- mystery trip screen ------------------------------------- */
function showMysteryTrip(line, start, trip) {
  currentTrip = { line, start, ...trip };

  const area = document.getElementById('trip-screen');
  area.innerHTML = `
    <h2>Your Journey</h2>
    <p>Start at <strong>${start}</strong> on the ${line.name} Line.</p>
    <p>Ride <strong>${trip.numStops}</strong> stop${trip.numStops>1?'s':''}</p>
    <p><em>toward ${trip.terminal}</em>.</p>
    <button id="arrived-btn">I’ve arrived</button>
    <button id="play-again">Restart</button>
  `;

  area.querySelector('#arrived-btn').onclick = handleArrival;
  area.querySelector('#play-again').onclick  = () => {
    selectedLine = null;
    currentTrip  = null;
    renderLineSelection();
    showScreen('line-screen');
  };
}

function handleArrival() {
  alert(`Welcome to ${currentTrip.destStation}! (Attractions coming soon.)`);
}
