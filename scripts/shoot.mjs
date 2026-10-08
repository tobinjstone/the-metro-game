// Walks the whole game in headless Edge and saves a screenshot of each screen.
//   python -m http.server 8765            (from the repo root, in another terminal)
//   node scripts/shoot.mjs [outDir] [width] [height]
// Needs Node 22+ (built-in WebSocket) and Microsoft Edge. Console errors are printed.
// Headless Chromium starves requestAnimationFrame, so GSAP's lag smoothing is turned off.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT = path.resolve(process.argv[2] ?? 'shots');
const W = +(process.argv[3] ?? 390), H = +(process.argv[4] ?? 844);
const BASE = process.env.BASE ?? 'http://127.0.0.1:8765/';
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const tag = `${W}x${H}`;
fs.mkdirSync(OUT, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'metro-shoot-'));
/* headless Edge sometimes treats the page as backgrounded and stops producing frames;
   these flags keep requestAnimationFrame (and so GSAP) running */
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run',
                          '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
                          '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
                          `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let targets;
for (let i = 0; i < 150 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0; const pending = {}; const errors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(`${expr}\n→ ${r.result.exceptionDetails.exception?.description}`);
  return r.result?.result?.value;
};
const click = sel => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('no ${sel}'); el.click(); })()`);
const waitFor = async (expr, ms = 15000) => { for (let t = 0; t < ms; t += 150) { if (await ev(expr)) return; await sleep(150); } throw new Error(`timed out: ${expr}`); };
let n = 0;
const shot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, `${tag}-${String(++n).padStart(2, '0')}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
};

try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 });
  await send('Page.navigate', { url: BASE });
  await waitFor(`!!window.gsap && document.readyState === 'complete'`);
  await ev(`gsap.ticker.lagSmoothing(0); localStorage.clear()`);
  await sleep(3200);                                      // let the map finish drawing in
  await shot('intro');

  await click('#start-btn'); await sleep(700); await shot('lines');
  await click('.line-row[data-idx="0"]'); await sleep(700); await shot('stations');
  await click('.station-btn[data-station="Gallery Place"]'); await sleep(700);
  await click('.cat-btn[data-cat="Coffee"]'); await sleep(200);
  if (process.env.MYSTERY === '0') await click('#mystery-toggle');
  await shot('mood');
  await click('#go-btn'); await sleep(1500); await shot('ticket-counting');
  if (process.env.SKIP) {                                 // tap Skip mid-map: should land on the finished ticket
    await sleep(3500); await click('#skip-hint'); await sleep(600);
    const labels = await ev(`[...document.querySelectorAll('#trip-map .map-label')].map(t => +getComputedStyle(t).opacity)`);
    const done = await ev(`!document.querySelector('.trip-buttons').hidden`);
    if (!done || labels.some(o => o < 1)) errors.push(`skip left the ticket unfinished: buttons ${done}, label opacity ${labels}`);
    await shot('ticket-skipped');
  }
  await waitFor(`!document.querySelector('.trip-buttons').hidden`, 20000); await sleep(700); await shot('ticket-mystery');
  if (await ev(`!document.querySelector('#peek-row').hidden`)) {
    await click('#peek-btn'); await sleep(700); await shot('ticket-peek');
    await click('#peek-btn'); await sleep(300);
  }

  await click('#board-btn'); await sleep(700); await shot('ride-start');
  const stops = await ev(`JSON.parse(localStorage.getItem('metro-game:v1')).trip.numStops`);
  for (let i = 0; i < stops - 1; i++) { await click('#doors-btn'); await sleep(60); }
  await sleep(600); await shot('ride-next-stop');
  await click('#doors-btn'); await sleep(500); await shot('ride-here');

  await click('#arrived-btn'); await sleep(1600); await shot('arrival');
  await click('#venue-btn'); await waitFor(`document.querySelector('#venue-screen').classList.contains('active')`); await sleep(900); await shot('venue');
  await ev(`document.querySelector('#roster-grid button:not([disabled]):not([aria-pressed="true"])')?.click()`); await sleep(1100); await shot('venue-other-mood');

  /* reload mid-trip → resume card → resume → walk Back through the old history: never a blank screen */
  await send('Page.reload'); await waitFor(`document.readyState === 'complete' && !!window.gsap`); await sleep(700); await shot('intro-resume');
  await click('#resume-btn'); await waitFor(`document.querySelector('#venue-screen').classList.contains('active')`);
  const visited = [];
  for (let i = 0; i < 8; i++) {
    await send('Runtime.evaluate', { expression: 'history.back()' }); await sleep(900);
    const s = await ev(`(() => { const el = document.querySelector('.screen.active');
      const blank = el.innerText.trim().length < 20 || (el.id === 'trip-screen' && document.querySelector('#result-card').hidden);
      return { id: el.id, blank }; })()`);
    visited.push(s.id.replace('-screen', ''));
    if (s.blank) { errors.push(`blank ${s.id} after Back #${i + 1}`); await shot(`blank-${s.id}`); }
  }
  console.log(`Back walk: ${visited.join(' → ')}`);
  await click('#passport-link'); await sleep(900); await shot('passport');
  await send('Runtime.evaluate', { expression: 'history.back()' }); await sleep(800);
  const where = await ev(`document.querySelector('.screen.active')?.id`);
  if (where !== 'intro-screen') errors.push(`Back from passport landed on ${where}`);
} catch (e) {
  errors.push(String(e.message ?? e));
  await shot('failure').catch(() => {});
} finally {
  console.log(`${n} screenshots → ${OUT}`);
  console.log(errors.length ? `ERRORS:\n  ${errors.join('\n  ')}` : 'no console errors');
  ws.close(); edge.kill();
  /* Edge holds files for a moment after exit on Windows; tidy up when it lets go */
  edge.once('exit', () => { try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {} });
  process.exitCode = errors.length ? 1 : 0;
}
