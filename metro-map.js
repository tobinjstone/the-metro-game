/* ------------------------------------------------------------------
   metro-map.js — schematic DC Metro map (octilinear, WMATA-style)
   + the animated "your trip" reveal used on the trip screen.
   ------------------------------------------------------------------
   Coordinates are in grid units (x → east, y → south). One unit is
   roughly one downtown station step. The renderer scales by UNIT.
   ------------------------------------------------------------------ */

export const UNIT = 30;           // SVG px per grid unit

/* Official WMATA line colours (GTFS) */
export const LINE_COLORS = {
  Red: "#BF0D3E", Orange: "#ED8B00", Silver: "#919D9D",
  Blue: "#009CDE", Yellow: "#FFD100", Green: "#00B140"
};

/* ---------------- station positions ---------------- */
export const STATIONS = {
  /* Red – west arm (vertical, then 45° into downtown) */
  "Shady Grove":[2,-4.6], "Rockville":[2,-3.5], "Twinbrook":[2,-2.4], "North Bethesda":[2,-1.3],
  "Grosvenor–Strathmore":[2,-0.2], "Medical Center":[2,0.9], "Bethesda":[2,2],
  "Friendship Heights":[3,3], "Tenleytown–AU":[4,4], "Van Ness–UDC":[5,5], "Cleveland Park":[6,6],
  "Woodley Park":[7,7], "Dupont Circle":[8,8], "Farragut North":[9,9],
  /* Red – downtown + east arm */
  "Metro Center":[10,10], "Gallery Place":[11.5,10], "Judiciary Square":[13,10], "Union Station":[14.5,10],
  "NoMa–Gallaudet U":[15.5,8.5], "Rhode Island Ave":[15.5,7], "Brookland–CUA":[15.5,5.5], "Fort Totten":[15.5,4],
  "Takoma":[15.5,2.5], "Silver Spring":[15.5,1], "Forest Glen":[15.5,-0.5], "Wheaton":[15.5,-2], "Glenmont":[15.5,-3.5],

  /* Orange / Silver / Blue trunk */
  "Rosslyn":[4.5,10], "Foggy Bottom–GWU":[6,10], "Farragut West":[7.4,10], "McPherson Square":[8.7,10],
  "Federal Triangle":[10,11.25], "Smithsonian":[10,12.5], "L'Enfant Plaza":[11.5,13.75],
  "Federal Center SW":[12.75,13.75], "Capitol South":[14,13.75], "Eastern Market":[15.25,13.75],
  "Potomac Ave":[16.5,13.75], "Stadium–Armory":[17.75,13.75],

  /* Orange west */
  "Courthouse":[3.25,10], "Clarendon":[2,10], "Virginia Square–GMU":[0.75,10], "Ballston–MU":[-0.5,10],
  "East Falls Church":[-2,10], "West Falls Church":[-3.5,10], "Dunn Loring":[-5,10], "Vienna":[-6.5,10],
  /* Orange east */
  "Minnesota Ave":[19.25,12.25], "Deanwood":[20.5,11], "Cheverly":[21.75,9.75], "Landover":[23,8.5], "New Carrollton":[24.25,7.25],

  /* Silver west */
  "McLean":[-3,9], "Tysons":[-4,8], "Greensboro":[-5,7], "Spring Hill":[-6,6],
  "Wiehle–Reston East":[-7.25,6], "Reston Town Center":[-8.5,6], "Herndon":[-9.75,6], "Innovation Center":[-11,6],
  "Washington Dulles International Airport":[-12.25,6], "Loudoun Gateway":[-13.5,6], "Ashburn":[-14.75,6],
  /* Blue / Silver east */
  "Benning Road":[19.25,13.75], "Capitol Heights":[20.5,13.75], "Addison Road–Seat Pleasant":[21.75,13.75],
  "Morgan Boulevard":[23,13.75], "Downtown Largo":[24.25,13.75],

  /* Blue south + Blue/Yellow */
  "Arlington Cemetery":[4.5,12.25], "Pentagon":[8.5,16.75], "Pentagon City":[8.5,17.85], "Crystal City":[8.5,18.95],
  "Ronald Reagan Washington National Airport":[8.5,20.05], "Potomac Yard–VT":[8.5,21.15], "Braddock Road":[8.5,22.25],
  "King Street–Old Town":[8.5,23.35], "Van Dorn Street":[7,24.85], "Franconia–Springfield":[5.5,26.35],
  "Eisenhower Avenue":[9.5,24.35], "Huntington":[10.5,25.35],

  /* Green / Yellow core + Green branches */
  "Archives":[11.5,11.9], "Mount Vernon Square":[11.5,9], "Shaw–Howard U":[11.5,8], "U Street":[12.5,7],
  "Columbia Heights":[13.5,6], "Georgia Ave–Petworth":[14.5,5],
  "West Hyattsville":[16.5,3], "Hyattsville Crossing":[17.5,2], "College Park–U of Md":[18.5,1], "Greenbelt":[19.5,0],
  "Waterfront":[12.5,14.75], "Navy Yard–Ballpark":[13.5,15.75], "Anacostia":[14.5,16.75], "Congress Heights":[15.5,17.75],
  "Southern Ave":[16.5,18.75], "Naylor Road":[17.5,19.75], "Suitland":[18.5,20.75], "Branch Ave":[19.5,21.75]
};

/* Stations drawn with the big transfer symbol */
export const TRANSFER = new Set([
  "Metro Center","Gallery Place","L'Enfant Plaza","Fort Totten","Rosslyn","Pentagon",
  "King Street–Old Town","Stadium–Armory","East Falls Church"
]);

/* ---------------- line geometry ----------------
   Each path is a list of station names, or [x,y] corner points.   */
export const LINE_PATHS = {
  Red: [
    "Shady Grove","Rockville","Twinbrook","North Bethesda","Grosvenor–Strathmore","Medical Center","Bethesda",
    "Friendship Heights","Tenleytown–AU","Van Ness–UDC","Cleveland Park","Woodley Park","Dupont Circle",
    "Farragut North","Metro Center","Gallery Place","Judiciary Square","Union Station",[15.5,10],
    "NoMa–Gallaudet U","Rhode Island Ave","Brookland–CUA","Fort Totten","Takoma","Silver Spring",
    "Forest Glen","Wheaton","Glenmont"
  ],
  Orange: [
    "Vienna","Dunn Loring","West Falls Church","East Falls Church","Ballston–MU","Virginia Square–GMU","Clarendon",
    "Courthouse","Rosslyn","Foggy Bottom–GWU","Farragut West","McPherson Square","Metro Center","Federal Triangle",
    "Smithsonian",[10,13.75],"L'Enfant Plaza","Federal Center SW","Capitol South","Eastern Market","Potomac Ave",
    "Stadium–Armory","Minnesota Ave","Deanwood","Cheverly","Landover","New Carrollton"
  ],
  Silver: [
    "Ashburn","Loudoun Gateway","Washington Dulles International Airport","Innovation Center","Herndon",
    "Reston Town Center","Wiehle–Reston East","Spring Hill","Greensboro","Tysons","McLean","East Falls Church",
    "Ballston–MU","Virginia Square–GMU","Clarendon","Courthouse","Rosslyn","Foggy Bottom–GWU","Farragut West",
    "McPherson Square","Metro Center","Federal Triangle","Smithsonian",[10,13.75],"L'Enfant Plaza","Federal Center SW",
    "Capitol South","Eastern Market","Potomac Ave","Stadium–Armory","Benning Road","Capitol Heights",
    "Addison Road–Seat Pleasant","Morgan Boulevard","Downtown Largo"
  ],
  Blue: [
    "Franconia–Springfield","Van Dorn Street","King Street–Old Town","Braddock Road","Potomac Yard–VT",
    "Ronald Reagan Washington National Airport","Crystal City","Pentagon City","Pentagon",[4.5,12.75],
    "Arlington Cemetery","Rosslyn","Foggy Bottom–GWU","Farragut West","McPherson Square","Metro Center",
    "Federal Triangle","Smithsonian",[10,13.75],"L'Enfant Plaza","Federal Center SW","Capitol South","Eastern Market",
    "Potomac Ave","Stadium–Armory","Benning Road","Capitol Heights","Addison Road–Seat Pleasant","Morgan Boulevard",
    "Downtown Largo"
  ],
  Yellow: [
    "Huntington","Eisenhower Avenue","King Street–Old Town","Braddock Road","Potomac Yard–VT",
    "Ronald Reagan Washington National Airport","Crystal City","Pentagon City","Pentagon","L'Enfant Plaza",
    "Archives","Gallery Place","Mount Vernon Square"
  ],
  Green: [
    "Branch Ave","Suitland","Naylor Road","Southern Ave","Congress Heights","Anacostia","Navy Yard–Ballpark",
    "Waterfront","L'Enfant Plaza","Archives","Gallery Place","Mount Vernon Square","Shaw–Howard U","U Street",
    "Columbia Heights","Georgia Ave–Petworth","Fort Totten","West Hyattsville","Hyattsville Crossing",
    "College Park–U of Md","Greenbelt"
  ]
};

/* Lane order when lines share track.
   Horizontal track: first = top.  Vertical track: first = east.
   (Chosen so lines peel off without crossing each other.) */
const LANE_ORDER_H = ["Orange","Silver","Blue","Yellow","Green","Red"];
const LANE_ORDER_V = ["Orange","Silver","Green","Yellow","Blue","Red"];

/* Rivers (light-blue bands, grid units) */
export const RIVERS = [
  /* Potomac */
  [[-0.6,-1.2],[1,2.6],[3.2,6.6],[5.25,10],[5.6,12.2],[7.9,14.4],[10.2,17],[11.3,20.8],[12.2,27.5]],
  /* Anacostia */
  [[11.2,19.6],[14,16.3],[16.4,15.2],[18.5,14.1],[18.6,12.3],[19,10.4]]
];
const RIVER_WIDTH = 0.95;

/* ---------------- geometry helpers ---------------- */
const pt   = p => Array.isArray(p) ? { x:p[0], y:p[1] } : { x:STATIONS[p][0], y:STATIONS[p][1], st:p };
const sub  = (a,b) => ({ x:a.x-b.x, y:a.y-b.y });
const len  = v => Math.hypot(v.x, v.y);
const unit = v => { const l = len(v) || 1; return { x:v.x/l, y:v.y/l }; };
const perp = v => ({ x:-v.y, y:v.x });
const add  = (a,b,k=1) => ({ x:a.x+b.x*k, y:a.y+b.y*k });

const before = (a,b) => a.x < b.x - 1e-9 || (Math.abs(a.x-b.x) < 1e-9 && a.y < b.y);
function segKey(a, b) {
  const [p,q] = before(a,b) ? [a,b] : [b,a];
  return `${p.x},${p.y}|${q.x},${q.y}`;
}
/* canonical direction: from the west-most (then north-most) end */
const canonicalDir = (a, b) => before(a,b) ? unit(sub(b,a)) : unit(sub(a,b));

/* Build offset polylines so shared track renders as parallel stripes */
export function buildLaneGeometry(laneWidth = 0.24) {
  const raw = {};
  for (const [name, path] of Object.entries(LINE_PATHS)) raw[name] = path.map(pt);

  /* which lines share each segment */
  const members = {};
  for (const [name, pts] of Object.entries(raw)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const k = segKey(pts[i], pts[i+1]);
      (members[k] ??= new Set()).add(name);
    }
  }

  const out = {};
  for (const [name, pts] of Object.entries(raw)) {
    /* per-segment signed offset, relative to this line's direction of travel */
    const offs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const k    = segKey(pts[i], pts[i+1]);
      const cd   = canonicalDir(pts[i], pts[i+1]);
      const vertical = Math.abs(cd.x) < 1e-6;
      const order = vertical ? LANE_ORDER_V : LANE_ORDER_H;
      const list  = order.filter(l => members[k].has(l));
      const idx   = list.indexOf(name);
      let o = (idx - (list.length - 1) / 2) * laneWidth;
      const d = unit(sub(pts[i+1], pts[i]));
      if (d.x * cd.x + d.y * cd.y < 0) o = -o;      // travelling against canonical dir
      offs.push(o);
    }

    const res = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const P = pts[i];
      if (i === 0) {
        const d = unit(sub(pts[1], P));
        res.push({ ...add(P, perp(d), offs[0]), st:P.st, o:offs[0] });
      } else if (i === n - 1) {
        const d = unit(sub(P, pts[n-2]));
        res.push({ ...add(P, perp(d), offs[n-2]), st:P.st, o:offs[n-2] });
      } else {
        const d1 = unit(sub(P, pts[i-1])), d2 = unit(sub(pts[i+1], P));
        const o1 = offs[i-1], o2 = offs[i];
        const cross = d1.x*d2.y - d1.y*d2.x;
        if (Math.abs(cross) < 1e-6) {                       // straight through
          res.push({ ...add(P, perp(d1), o1), st:P.st, o:o1 });
          if (Math.abs(o1 - o2) > 1e-6)                     // lane change → short jog
            res.push({ ...add(add(P, d2, 0.45), perp(d2), o2), o:o2 });
        } else {                                            // corner → intersect offset lines
          const A = add(P, perp(d1), o1), B = add(P, perp(d2), o2);
          const w = sub(B, A);
          const t = (w.x*d2.y - w.y*d2.x) / cross;
          res.push({ ...add(A, d1, t), st:P.st, o:o1 });
        }
      }
    }
    out[name] = res;
  }
  return out;
}

/* Polyline → SVG path with rounded corners (quadratic curves).
   Corner radius is adjusted by lane offset so stacked lanes stay concentric. */
export function roundedPath(pts, scale = UNIT, radius = 0.8, stationRadius = 0.3) {
  const P = i => ({ x: pts[i].x * scale, y: pts[i].y * scale });
  const f = n => n.toFixed(2);
  let d = `M ${f(P(0).x)} ${f(P(0).y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = P(i-1), cur = P(i), next = P(i+1);
    const v1 = sub(prev, cur), v2 = sub(next, cur);
    const l1 = len(v1), l2 = len(v2);
    const cross = v1.x*v2.y - v1.y*v2.x;
    if (Math.abs(cross) < 1e-6) { d += ` L ${f(cur.x)} ${f(cur.y)}`; continue; }
    const turn = -Math.sign(cross);                       // +1 right turn, -1 left turn
    const base = (pts[i].st ? stationRadius : radius) - (pts[i].o ?? 0) * turn;
    const r = Math.max(0, Math.min(base * scale, l1 * 0.5, l2 * 0.5));
    const a = add(cur, unit(v1), r), b = add(cur, unit(v2), r);
    d += ` L ${f(a.x)} ${f(a.y)} Q ${f(cur.x)} ${f(cur.y)} ${f(b.x)} ${f(b.y)}`;
  }
  const last = P(pts.length - 1);
  d += ` L ${f(last.x)} ${f(last.y)}`;
  return d;
}

/* Bounding box (SVG px) of every station */
export function mapBounds(pad = 1.2) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x,y] of Object.values(STATIONS)) {
    minX = Math.min(minX,x); maxX = Math.max(maxX,x); minY = Math.min(minY,y); maxY = Math.max(maxY,y);
  }
  return { x:(minX-pad)*UNIT, y:(minY-pad)*UNIT, w:(maxX-minX+pad*2)*UNIT, h:(maxY-minY+pad*2)*UNIT };
}

/* Sub-path of one line between two stations (ordered from → to) */
export function routePoints(lanes, lineName, from, to) {
  const pts = lanes[lineName];
  const ia = pts.findIndex(p => p.st === from);
  const ib = pts.findIndex(p => p.st === to);
  if (ia < 0 || ib < 0) return null;
  return ia < ib ? pts.slice(ia, ib + 1) : pts.slice(ib, ia + 1).reverse();
}

/* ---------------- renderer ---------------- */
const SVG_NS = "http://www.w3.org/2000/svg";
export const svgEl = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

/**
 * Render the whole system map into an <svg>.
 * Returns { svg, lanes, bounds, layers } for further animation.
 */
export function renderSystemMap(svg, opts = {}) {
  const laneWidth = opts.laneWidth ?? 0.24;
  const stroke    = (opts.stroke ?? 0.22) * UNIT;
  const lanes     = buildLaneGeometry(laneWidth);
  const b         = mapBounds();

  svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.innerHTML = "";

  const gRivers = svgEl("g", { class:"map-rivers" }, svg);
  const gLines  = svgEl("g", { class:"map-lines" }, svg);
  const gStops  = svgEl("g", { class:"map-stations" }, svg);

  for (const r of RIVERS) {
    const d = roundedPath(r.map(p => ({x:p[0], y:p[1]})), UNIT, 1.6);
    svgEl("path", { d, class:"river", fill:"none", "stroke-linecap":"round", "stroke-linejoin":"round",
                    "stroke-width": RIVER_WIDTH * UNIT }, gRivers);
  }

  const drawOrder = ["Red","Green","Yellow","Blue","Silver","Orange"];
  for (const name of drawOrder) {
    const d = roundedPath(lanes[name]);
    svgEl("path", { d, class:`line line-${name}`, "data-line":name, stroke:LINE_COLORS[name], fill:"none",
                    "stroke-width":stroke, "stroke-linecap":"round", "stroke-linejoin":"round" }, gLines);
  }

  for (const [name, [x,y]] of Object.entries(STATIONS)) {
    const big = TRANSFER.has(name);
    svgEl("circle", { cx:x*UNIT, cy:y*UNIT, r:(big ? 0.34 : 0.19) * UNIT,
                      class:`station ${big ? "transfer" : ""}`, "data-station":name,
                      "stroke-width":(big ? 0.09 : 0.06) * UNIT }, gStops);
  }

  return { svg, lanes, bounds:b, layers:{ rivers:gRivers, lines:gLines, stations:gStops } };
}

/* ------------------------------------------------------------------
   Trip animation
   ------------------------------------------------------------------
   animateTrip(svg, { line, from, to, labelFor })
     line      – "Red" … "Green"
     from / to – station names (as in STATIONS)
     labelFor  – optional fn(name) → display name
   Renders the full map, then: dims the rest of the network, glides the
   camera to the trip, draws the route station by station with a little
   train, and pops the destination. Returns the GSAP timeline.
   ------------------------------------------------------------------ */
export function animateTrip(svg, { line, from, to, labelFor = s => s, onDrawStart } = {}) {
  const gsap = window.gsap;
  const map  = renderSystemMap(svg);
  const { lanes, bounds } = map;
  const color = LINE_COLORS[line];

  /* ---- route geometry ---- */
  const pts = routePoints(lanes, line, from, to);
  if (!pts) throw new Error(`No route on ${line} from ${from} to ${to}`);
  const d = roundedPath(pts);

  const gRoute = svgEl("g", { class:"map-route" }, svg);
  const casing = svgEl("path", { d, class:"route-casing", fill:"none", stroke:"#fff",
                                 "stroke-width":0.46*UNIT, "stroke-linecap":"round", "stroke-linejoin":"round" }, gRoute);
  const route  = svgEl("path", { d, class:"route", fill:"none", stroke:color,
                                 "stroke-width":0.3*UNIT, "stroke-linecap":"round", "stroke-linejoin":"round" }, gRoute);
  const total = route.getTotalLength();
  gsap.set([casing, route], { strokeDasharray: total, strokeDashoffset: total });

  /* stations along the route (in travel order) */
  const stops = pts.filter(p => p.st).map(p => p.st);
  const stopEls = stops.map(s => svg.querySelector(`[data-station="${CSS.escape(s)}"]`));
  const [ox, oy] = STATIONS[from], [dx, dy] = STATIONS[to];

  /* origin marker + pulse ring + train + destination marker */
  svgEl("circle", { cx:ox*UNIT, cy:oy*UNIT, r:0.24*UNIT, fill:"#1d1d1f", stroke:"#fff",
                    "stroke-width":0.08*UNIT, class:"origin-marker" }, gRoute);
  const ring  = svgEl("circle", { cx:ox*UNIT, cy:oy*UNIT, r:0.5*UNIT, fill:"none", stroke:color,
                                  "stroke-width":0.1*UNIT, class:"origin-ring", opacity:0 }, gRoute);
  const train = svgEl("circle", { cx:ox*UNIT, cy:oy*UNIT, r:0.3*UNIT, fill:"#1d1d1f", stroke:"#fff",
                                  "stroke-width":0.08*UNIT, class:"train", opacity:0 }, gRoute);
  const dest  = svgEl("circle", { cx:dx*UNIT, cy:dy*UNIT, r:0.42*UNIT, fill:"#fff", stroke:"#1d1d1f",
                                  "stroke-width":0.1*UNIT, class:"dest-marker", opacity:0 }, gRoute);
  const destIn = svgEl("circle", { cx:dx*UNIT, cy:dy*UNIT, r:0.18*UNIT, fill:color, class:"dest-marker-inner", opacity:0 }, gRoute);

  /* ---- camera ---- */
  const W = svg.clientWidth || 300, H = svg.clientHeight || 225;
  const aspect = W / H;
  const bb = route.getBBox();
  const fit = (pad) => {
    let x = bb.x - pad*UNIT, y = bb.y - pad*UNIT, w = bb.width + 2*pad*UNIT, h = bb.height + 2*pad*UNIT;
    /* keep a sane zoom range: never closer than ~9 grid units across the view */
    const minW = Math.max(9 * UNIT, (W / 64) * UNIT);
    if (w < minW) { x -= (minW - w) / 2; w = minW; }
    if (h < minW / aspect) { y -= (minW / aspect - h) / 2; h = minW / aspect; }
    if (w / h > aspect) { const nh = w / aspect; y -= (nh - h) / 2; h = nh; }
    else                { const nw = h * aspect; x -= (nw - w) / 2; w = nw; }
    return { x, y, w, h };
  };
  let view = fit(1.4);
  const pxPerUnit = () => (W / view.w) * UNIT;

  /* ---- labels (sized for the final zoom) ----
     Each label is placed on the side of the station that is furthest
     from every line passing through it, and that fits inside the view. */
  const gLabels = svgEl("g", { class:"map-labels", opacity:0 }, svg);
  const segmentDirs = station => {
    const dirs = [];
    for (const path of Object.values(LINE_PATHS)) {
      const p = path.map(pt);
      const i = p.findIndex(q => q.st === station);
      if (i < 0) continue;
      if (i > 0)            dirs.push(unit(sub(p[i-1], p[i])));
      if (i < p.length - 1) dirs.push(unit(sub(p[i+1], p[i])));
    }
    return dirs;
  };
  const R2 = Math.SQRT1_2;
  const SIDES = {
    E:{x:1,y:0}, W:{x:-1,y:0}, N:{x:0,y:-1}, S:{x:0,y:1},
    NE:{x:R2,y:-R2}, NW:{x:-R2,y:-R2}, SE:{x:R2,y:R2}, SW:{x:-R2,y:R2}
  };
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y)));

  const makeLabel = (station, text, role) => {
    const [x, y] = STATIONS[station];
    const fs = (role === "mid" ? 10.5 : 13) * (view.w / W);   // px → svg units
    const t = svgEl("text", { class:`map-label ${role}`, "font-size":fs, "paint-order":"stroke",
                              stroke:"#fff", "stroke-width":fs*0.28, "stroke-linejoin":"round" }, gLabels);
    t.textContent = text;

    const dirs  = segmentDirs(station);
    const textW = text.length * 0.58 * fs;
    const px = x*UNIT, py = y*UNIT;
    const roomE = (view.x + view.w) - (px + 0.5*UNIT);
    const roomW = (px - 0.5*UNIT) - view.x;
    let best = "E", bestScore = -Infinity;
    for (const [side, v] of Object.entries(SIDES)) {
      let s = dirs.length ? Math.min(...dirs.map(d => angle(v, d))) : Math.PI;
      if (/E/.test(side) && roomE < textW) s -= Math.PI;         // would run off the right edge
      if (/W/.test(side) && roomW < textW) s -= Math.PI;         // …or the left edge
      if (side === "E") s += 0.05;                                // mild preferences
      if (side.length === 1) s += 0.03;                           // cardinal over diagonal
      if (side === "N" && role === "to")  s -= 0.02;
      if (side === "S" && role !== "to")  s -= 0.02;
      if (s > bestScore) { bestScore = s; best = side; }
    }

    const rel = (px - view.x) / view.w;                          // 0..1 across the view
    const set = (lx, ly, anchor) => { t.setAttribute("x", lx); t.setAttribute("y", ly); t.setAttribute("text-anchor", anchor); };
    switch (best) {
      case "E":  set(px + 0.5*UNIT, py + fs*0.35, "start"); break;
      case "W":  set(px - 0.5*UNIT, py + fs*0.35, "end");   break;
      case "NE": set(px + 0.38*UNIT, py - 0.3*UNIT, "start"); break;
      case "NW": set(px - 0.38*UNIT, py - 0.3*UNIT, "end");   break;
      case "SE": set(px + 0.38*UNIT, py + 0.3*UNIT + fs*0.8, "start"); break;
      case "SW": set(px - 0.38*UNIT, py + 0.3*UNIT + fs*0.8, "end");   break;
      default: {                                                 // N / S: centred, edge-aware
        const anchor = rel < 0.22 ? "start" : rel > 0.78 ? "end" : "middle";
        const dx = anchor === "start" ? -0.3*UNIT : anchor === "end" ? 0.3*UNIT : 0;
        set(px + dx, best === "N" ? py - 0.55*UNIT : py + 0.55*UNIT + fs*0.8, anchor);
      }
    }
    return t;
  };
  /* extra room for label text: widen the view, then re-fit */
  const longest = Math.max(labelFor(from).length, labelFor(to).length);
  const labelUnits = (longest * 0.6 * 13 * (view.w / W)) / UNIT + 0.8;
  view = fit(Math.max(1.4, Math.min(labelUnits, 3.2)));

  makeLabel(from, labelFor(from), "from");
  makeLabel(to,   labelFor(to),   "to");
  if (stops.length <= 7 && pxPerUnit() >= 34)
    stops.slice(1, -1).forEach(s => makeLabel(s, labelFor(s), "mid"));

  /* ---- station dots: hidden at overview, on the route they pop as the train passes ---- */
  const allStations = [...map.layers.stations.children];
  gsap.set(allStations, { opacity:0, transformOrigin:"center" });
  stopEls.forEach(el => el.classList.add("on-route"));

  const otherLines = [...map.layers.lines.children].filter(p => p.dataset.line !== line);
  const thisLine   = map.layers.lines.querySelector(`[data-line="${line}"]`);

  const vb = v => `${v.x} ${v.y} ${v.w} ${v.h}`;
  svg.setAttribute("viewBox", vb(bounds));

  /* ---- timeline ---- */
  const drawDur = gsap.utils.clamp(0.9, 2.6, 0.22 * (stops.length - 1) + 0.5);
  const tl = gsap.timeline();

  tl.addLabel("overview")
    .to(otherLines,         { opacity:0.18, duration:0.6, ease:"power1.out" }, 0.45)
    .to(map.layers.rivers,  { opacity:0.55, duration:0.6 }, 0.45)
    .to(thisLine,           { opacity:0.55, duration:0.6 }, 0.45)
    .to(ring, { opacity:1, duration:0.3 }, 0.25)
    .fromTo(ring, { attr:{ r:0.2*UNIT } }, { attr:{ r:0.9*UNIT }, opacity:0, duration:1.0, ease:"power2.out", repeat:1 }, 0.25)
    .to(svg, { attr:{ viewBox: vb(view) }, duration:1.3, ease:"power2.inOut" }, 0.6)
    .to(allStations, { opacity:1, duration:0.5, stagger:0 }, 1.1)
    .addLabel("draw", 1.9)
    .add(() => onDrawStart && onDrawStart(), "draw")
    .to(train, { opacity:1, duration:0.2 }, "draw")
    .to([casing, route], { strokeDashoffset:0, duration:drawDur, ease:"power1.inOut",
        onUpdate() {
          const p = route.getPointAtLength(total * this.progress());
          train.setAttribute("cx", p.x); train.setAttribute("cy", p.y);
        } }, "draw");

  /* pop each stop when the train reaches it */
  stops.forEach((s, i) => {
    if (i === 0) return;
    const at = i / (stops.length - 1);
    tl.fromTo(stopEls[i], { scale:0.6 }, { scale:1.35, duration:0.18, ease:"back.out(3)", yoyo:true, repeat:1 },
              `draw+=${drawDur * at - 0.05}`);
  });

  tl.to(train, { opacity:0, duration:0.25 }, `draw+=${drawDur}`)
    .fromTo([dest, destIn], { opacity:0, scale:0.4, transformOrigin:"center" },
            { opacity:1, scale:1, duration:0.5, ease:"back.out(2.5)", stagger:0.05 }, `draw+=${drawDur - 0.05}`)
    .to(gLabels, { opacity:1, duration:0.45 }, `draw+=${Math.max(0.35, drawDur * 0.6)}`);

  return tl;
}
