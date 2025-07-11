// ------------------------------ imports ----------------------------------
import { metroLines } from './metro-lines.js';

/* ------------------------------ view helpers ----------------------------- */
function showScreen(id) {
  // slide the current "active" screen out and bring the new one in
  document.querySelectorAll('.screen.active').forEach(el => {
    el.classList.add('slide-out');
    el.classList.remove('active');
    el.addEventListener('transitionend', () => (el.hidden = true), { once: true });
  });

  const next = document.getElementById(id);
  next.hidden = false;
  next.classList.add('slide-in');
  requestAnimationFrame(() => {
    next.classList.remove('slide-in');
    next.classList.add('active');
  });
}

/* ------------------------------ global state ----------------------------- */
let selectedLine = null;   // the Metro line the user picked
let currentTrip  = null;   // cached trip once generated

// quick map of the three big transfer hubs so we can offer a fast-start
const hubLines = {
  'Metro Center'   : ['Red','Orange','Silver','Blue'],
  'Gallery Place'  : ['Red','Green','Yellow'],
  "L'Enfant Plaza": ['Green','Yellow','Blue','Silver','Orange']
};

/* ------------------------------ bootstrap -------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn').onclick = () => {
    renderLineSelection();
    showScreen('line-screen');
  };
});

/* ------------------------------ GSAP slot helper ------------------------- */
// Injected via CDN in <index.html>: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js"></script>
// This helper animates any element's textContent like a slot reel.
// ─ spins = how many *frames* (not seconds) of random swaps before stopping
export function gsapSlot(el, items, finalText, spins = 40) {
  // ensure the element is visible so the user can see the flicker
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('active'));

  return new Promise(resolve => {
    const tl = gsap.timeline({
      onComplete: () => {
        el.textContent = finalText; // lock the real value
        resolve();
      }
    });

    const base = 0.04; // 40 ms per quick frame
    for (let i = 0; i < spins; i++) {
      tl.to({}, {
        duration: base,
        onStart: () => (el.textContent = items[i % items.length])
      });
    }

    // a single ease‑out tail to mimic the reel slowing down
    tl.to({}, { duration: 0.8, ease: 'power3.out' });
  });
}

/* ------------------------------ line picker ------------------------------ */
function renderLineSelection() {
  const screen = document.getElementById('line-screen');
  screen.innerHTML = `
    <h2 class="screen-title">I’m starting from…</h2>

    <p class="subtitle">Select a Metro line:</p>
    <div id="line-picker" class="line-picker"></div>

    <p class="subtitle">…or start at a transfer hub:</p>
  <div id="hub-picker" class="hub-picker">
    ${Object.keys(hubLines).map(h => `<button class="hub-btn" data-hub="${h}">${h}</button>`).join('')}
  </div>
`;

  /* line circles */
  const lp = screen.querySelector('#line-picker');
 metroLines.forEach((line, idx) => {
  const btn = document.createElement('button');
  btn.className = 'line-circle';
  btn.style.background = line.color;

  /* line circles … (existing code that builds each <button>) */
lp.onclick = e => {
  const btn = e.target.closest('.line-circle');   // <— ignore stray clicks
  if (!btn) return;

  // 1) identify the line
  const idx = Number(btn.dataset.idx);            // 0…5 from dataset
  selectedLine = metroLines[idx];

  // 2) show the station list for that line
  renderStationSelection();
  showScreen('station-screen');
};

  // ✨ add the single-letter label
  btn.textContent = line.name[0];       // “R”, “O”, “S”, “B”, “Y”, “G”
  if (line.name === 'Yellow') btn.style.color = '#000'; // better contrast

  btn.title = `${line.name} Line`;
  btn.dataset.idx = idx;
  lp.appendChild(btn);
});

  /* hub quick‑start */
  const hp = screen.querySelector('#hub-picker');
  hp.onclick = e => {
    if (!e.target.classList.contains('hub-btn')) return;
    const hub = e.target.dataset.hub;
    const randomLineName = hubLines[hub][Math.floor(Math.random() * hubLines[hub].length)];
    const line          = metroLines.find(l => l.name === randomLineName);
    const startIdx      = line.stations.indexOf(hub);
    const trip          = getTrip(line, startIdx);
    animateMysteryTrip(line, hub, trip);
    showScreen('trip-screen');
  };
}

/* ------------------------------ station picker --------------------------- */
function renderStationSelection() {
  const screen = document.getElementById('station-screen');
  screen.innerHTML = `
    <h2 class="screen-title">${selectedLine.name} Line</h2>
    <p class="subtitle">Choose your starting station:</p>
    <div id="station-picker" class="station-picker"></div>
    <button id="back-btn" class="text-link">⬅ Back</button>
  `;

  const sp = screen.querySelector('#station-picker');
  selectedLine.stations.forEach(stop => {
    const b = document.createElement('button');
    b.className = 'station-btn';
    b.textContent = stop;
    sp.appendChild(b);
  });

  sp.onclick = e => {
    if (!e.target.classList.contains('station-btn')) return;
    const start = e.target.textContent;
    const trip  = getTrip(selectedLine, selectedLine.stations.indexOf(start));
    animateMysteryTrip(selectedLine, start, trip);
    showScreen('trip-screen');
  };

  screen.querySelector('#back-btn').onclick = () => {
    renderLineSelection();
    showScreen('line-screen');
  };
}

/* ------------------------------ trip logic helper ------------------------ */
function getTrip(line, startIdx) {
  const last   = line.stations.length - 1;
  const toFirst = startIdx;            // stops to the first station (index 0)
  const toLast  = last - startIdx;     // stops to the terminus at the end

  // randomly decide whether to go "forward" or "backward" as long as both exist
  const direction = (toFirst && toLast)
      ? (Math.random() < 0.5 ? 'first' : 'last')
      : (toFirst ? 'first' : 'last');

  const maxStops = direction === 'first' ? toFirst : toLast;
  const numStops = Math.floor(Math.random() * maxStops) + 1;  // 1 … max
  const destIdx  = direction === 'first' ? startIdx - numStops : startIdx + numStops;

  return {
    numStops,
    destStation: line.stations[destIdx],
    terminal   : direction === 'first' ? line.stations[0] : line.stations[last]
  };
}

/* ------------------------------ trip reveal animation -------------------- */
function animateMysteryTrip(line, startStation, trip) {
  currentTrip = { line, startStation, ...trip };
  const screen = document.getElementById('trip-screen');

  /* thinking light‑bulb */
  const bulb = screen.querySelector('#thinking-box');
  bulb?.classList.remove('hidden');
  bulb.style.display = 'flex';

  /* after a brief pause, hide bulb and begin slot reels */
  setTimeout(async () => {
    bulb.style.display = 'none';

    // 1) bring the card onscreen
    const card = screen.querySelector('#result-card');
    card.classList.remove('hidden');
    requestAnimationFrame(() => card.classList.add('active'));

    // 2) grab the three text targets we want to spin
// 2) grab the three text targets we want to spin
const lineBox  = screen.querySelector('#line-box');      // ⟸ changed
const dirBox   = screen.querySelector('#direction-box'); // ⟸ changed
const stopSpan = card.querySelector('#stop-number');     // stays the same


    // 3) start all three reel animations at once
    const spinLine  = gsapSlot(
      lineBox,
      ['Red Line','Blue Line','Orange Line','Silver Line','Green Line','Yellow Line'],
      `${line.name} Line`
    );

    const spinDir   = gsapSlot(
      dirBox,
      ['⮕ Shady Grove','⮕ Glenmont','⮕ New Carrollton','⮕ Largo Town Center',
       '⮕ Franconia','⮕ Huntington','⮕ Branch Ave','⮕ Ashburn'],
      `⮕ ${trip.terminal}`
    );

    const spinStops = gsapSlot(
      stopSpan,
      Array.from({ length: 15 }, (_, i) => `${i + 1}`),
      `${trip.numStops}`
    );

    // 4) wait for ALL three promises to resolve (every reel stopped)
    await Promise.all([spinLine, spinDir, spinStops]);

    // 5) populate summary text
    stopSpan.textContent = trip.numStops; // already done by gsapSlot, but safe
    const tripLineEl = card.querySelector('#trip-line');
const dotHTML = `<span class="line-dot ${line.name === 'Silver' ? 'silver' : ''}" 
                        style="background:${line.color}"></span>`;
tripLineEl.innerHTML = `${dotHTML}${line.name} Line`;
const dot = `<span class="line-dot ${line.name==='Silver'?'silver':''}" 
                    style="background:${line.color}"></span>`;
lineBox.innerHTML = `${dot}${line.name} Line`;      // replaces plain text
    card.querySelector('#trip-destination').textContent = trip.terminal;
    card.querySelector('#trip-subtext').textContent     = `${trip.numStops} stop${trip.numStops > 1 ? 's' : ''}`;

    // 6) reveal details + buttons
    const details = card.querySelector('.trip-details');
    details.classList.remove('hidden');
    requestAnimationFrame(() => details.classList.add('fade-in'));

    const btns = screen.querySelector('.trip-buttons');
    btns.classList.remove('hidden');
    requestAnimationFrame(() => btns.classList.add('fade-in'));

    btns.querySelector('#arrived-btn').onclick = handleArrival;
    btns.querySelector('#play-again').onclick  = () => {
      selectedLine = null;
      currentTrip  = null;
      renderLineSelection();
      showScreen('line-screen');
    };
  }, 2000); // 2‑second thinking pause
}

/* ------------------------------ arrival handler -------------------------- */
function handleArrival() {
  alert(`Welcome to ${currentTrip.destStation}! (Attractions coming soon.)`);
}
