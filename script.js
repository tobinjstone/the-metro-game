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

  const hp = area.querySelector('#hub-picker');
  hp.onclick = e => {
    if (!e.target.classList.contains('hub-btn')) return;
    const hub  = e.target.dataset.hub;
    const rnd  = hubLines[hub][Math.floor(Math.random()*hubLines[hub].length)];
    const line = metroLines.find(l => l.name === rnd);

    const startIdx = line.stations.indexOf(hub);
    const trip     = getTrip(line, startIdx);
    animateMysteryTrip(line, hub, trip);
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
    animateMysteryTrip(selectedLine, start, trip);
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
// ─── GSAP text-swap “slot” helper ────────────────────────────────────
function gsapSlot(el, items, finalText, spins = 40) {
  // timeline lets us reuse/await later
  const tl = gsap.timeline({
    onComplete: () => (el.textContent = finalText)
  });

  const base = 0.04;              // 40 ms per frame at full speed

  for (let i = 0; i < spins; i++) {
    tl.to({}, {                   // dummy tween just controls timing
      duration: base,
      onStart: () => (el.textContent = items[i % items.length])
    });
  }

  // one long tail that eases to a stop
  tl.to({}, { duration: 0.8, ease: "power3.out" });
  return tl;
}

/* ---------- trip animation reveal ---------------------------------- */
function animateMysteryTrip(line, start, trip) {
  currentTrip = { line, start, ...trip };

  const screen = document.getElementById('trip-screen');
  const lightbulb = screen.querySelector('#thinking-box');
  lightbulb?.classList.remove('hidden');
  lightbulb.style.display = 'flex';

  // Step 1: Hide bulb after a delay
  setTimeout(() => {
    lightbulb.style.display = 'none';

  const lineBox = screen.querySelector('#line-box');
gsapSlot(
  lineBox,
  ['Red Line','Blue Line','Orange Line','Silver Line','Green Line','Yellow Line'],
  `${line.name} Line`
);   // now uses GSAP

    setTimeout(() => {
      const dirBox = screen.querySelector('#direction-box');
      slotMachineEffect(dirBox, ['Shady Grove', 'New Carrollton', 'Franconia', 'Largo Town Center', 'Ashburn'], `toward ${trip.terminal}`);

      setTimeout(() => {
        const resultCard = screen.querySelector('#result-card');
        resultCard.querySelector('#stop-number').textContent = trip.numStops;
        resultCard.querySelector('#trip-line').textContent = line.name + ' Line';
        resultCard.querySelector('#trip-destination').textContent = trip.terminal;
        resultCard.querySelector('#trip-subtext').textContent = `${trip.numStops} stop${trip.numStops > 1 ? 's' : ''}`;
        resultCard.classList.remove('hidden');
        requestAnimationFrame(() => resultCard.classList.add('active'));

        setTimeout(() => {
          const btns = screen.querySelector('.trip-buttons');
          btns.classList.remove('hidden');
          requestAnimationFrame(() => btns.classList.add('fade-in'));

          btns.querySelector('#arrived-btn').onclick = handleArrival;
          btns.querySelector('#play-again').onclick = () => {
            selectedLine = null;
            currentTrip = null;
            renderLineSelection();
            showScreen('line-screen');
          };
        }, 500);

      }, 1500);
    }, 1500);
  }, 2000);
}

function slotMachineEffect(el, options, finalText) {
  let i = 0;
  const spin = setInterval(() => {
    el.textContent = options[i % options.length];
    i++;
  }, 75);

  setTimeout(() => {
    clearInterval(spin);
    el.textContent = finalText;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('active'));
  }, 1000);
}

function handleArrival() {
  alert(`Welcome to ${currentTrip.destStation}! (Attractions coming soon.)`);
}
