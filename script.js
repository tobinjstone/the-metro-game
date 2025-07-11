/* ---------- GLOBAL STATE ---------- */
let selectedLine = null;

/* ---------- STEP 0 ---------- */
function startGame() {
  // hide intro, show game container
  document.getElementById('intro').hidden = true;
  document.getElementById('game-area').hidden = false;

  renderLineSelection();
}

/* ---------- STEP 1: PICK A LINE ---------- */
function renderLineSelection() {
  const container = document.getElementById('game-area');
  container.innerHTML = `
    <h2>I’m starting from…</h2>
    <p>Select a Metro line:</p>
    <div id="line-picker"></div>
  `;

  const picker = document.getElementById('line-picker');

  metroLines.forEach((line, index) => {
    const btn = document.createElement('button');
    btn.className = 'line-circle';
    btn.style.background = line.color;
    btn.title = `${line.name} Line`;
    btn.dataset.index = index;          // store which line this is
    picker.appendChild(btn);
  });

  // click handler (event delegation so we only add one listener)
  picker.addEventListener('click', (e) => {
    if (e.target.classList.contains('line-circle')) {
      const idx = Number(e.target.dataset.index);
      selectedLine = metroLines[idx];
      renderStationSelection();
    }
  });
}

/* ---------- STEP 2: PICK A STATION ---------- */
function renderStationSelection() {
  const container = document.getElementById('game-area');
  container.innerHTML = `
    <h2>${selectedLine.name} Line</h2>
    <p>Choose your starting station:</p>
    <div id="station-picker"></div>
    <button id="back-btn">⬅ Back</button>
  `;

  const picker = document.getElementById('station-picker');

  selectedLine.stations.forEach((stop) => {
    const btn = document.createElement('button');
    btn.className = 'station-btn';
    btn.textContent = stop;
    picker.appendChild(btn);
  });

  // station click
  picker.addEventListener('click', (e) => {
    if (e.target.classList.contains('station-btn')) {
      const chosenStation = e.target.textContent;
      console.log(`Line: ${selectedLine.name}, Station: ${chosenStation}`);
      // TODO → proceed to next game step here
      alert(`You picked ${chosenStation} on the ${selectedLine.name} Line`);
    }
  });

  // back button
  document.getElementById('back-btn').addEventListener('click', renderLineSelection);
}

/* ---------- KICK OFF ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start-btn')
          .addEventListener('click', startGame);
});
