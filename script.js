/* ===== Metro data (sample) ===== */
import { metroLines } from "./metro-lines.js";   // if you made it an ES module

/* ============================== */

let selectedLine = null;

/* STEP 0 – intro → line select */
function startGame() {
  document.getElementById("intro").hidden = true;
  document.getElementById("game-area").hidden = false;
  renderLineSelection();
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

  picker.onclick = (e) => {
    if (!e.target.classList.contains("station-btn")) return;
    const station = e.target.textContent;
    console.log(`Line: ${selectedLine.name}, Station: ${station}`);
    alert(`You picked ${station} on the ${selectedLine.name} Line`);
    // TODO: next game phase here
  };

  document.getElementById("back-btn").onclick = renderLineSelection;
}

/* wire up Start button */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").onclick = startGame;
});
