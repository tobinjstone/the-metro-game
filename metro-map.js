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

/* Rivers (light-blue bands, grid units). `w` is the width at each end;
   an end that stops inside the map tapers to a point instead of a blob. */
export const RIVERS = [
  { name: "Potomac",   w: [0.75, 1.2], taper: [false, false],
    pts: [[-2.7,-7],[-0.6,-1.2],[1,2.6],[3.2,6.6],[5.25,10],[5.6,12.2],[7.9,14.4],[10.2,17],[11.3,20.8],[12.2,27.5],[12.5,30]] },
  { name: "Anacostia", w: [0.8, 0.6], taper: [false, true],
    pts: [[10.9,19.9],[14,16.3],[16.4,15.2],[18.5,14.1],[18.6,12.3],[19,10.4],[19.5,8.6],[20.1,7.2]] }
];

/* Catmull-Rom through the river's points → a filled outline whose width
   eases from w[0] to w[1], pinching to nothing at a tapered end. Pure maths. */
export function riverOutline({ pts, w, taper }, scale = UNIT) {
  const P = pts.map(([x, y]) => ({ x, y }));
  const at = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
  const spine = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < 16; s++) {
      const t = s / 16, t2 = t * t, t3 = t2 * t;
      spine.push({
        x: 0.5 * (2*p1.x + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
        y: 0.5 * (2*p1.y + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3)
      });
    }
  }
  spine.push(P.at(-1));
  let total = 0; const cum = [0];
  for (let i = 1; i < spine.length; i++) cum.push(total += len(sub(spine[i], spine[i - 1])));
  const width = s => {
    const u = s / total, ease = v => v * v * (3 - 2 * v);
    let k = w[0] + (w[1] - w[0]) * u;
    if (taper[0] && u < 0.18) k *= ease(u / 0.18);
    if (taper[1] && u > 0.82) k *= ease((1 - u) / 0.18);
    return k;
  };
  const left = [], right = [];
  spine.forEach((p, i) => {
    const d = unit(sub(spine[Math.min(i + 1, spine.length - 1)], spine[Math.max(i - 1, 0)]));
    const n = perp(d), h = width(cum[i]) / 2;
    left.push(add(p, n, h)); right.push(add(p, n, -h));
  });
  const f = v => (v * scale).toFixed(1);
  const ring = [...left, ...right.reverse()];
  return `M ${ring.map(p => `${f(p.x)} ${f(p.y)}`).join(" L ")} Z`;
}

/* ---------------- station markers ----------------
   Where lines share track, one pill spans the whole bundle (so every
   lane runs through it). Where lines meet at an angle — the transfer
   stations — one circle covers them all. Pure maths; returns grid units. */
const R_STOP = 0.2, R_XFER = 0.34;
export function stationMarkers(lanes) {
  const at = {};                                   // station → [{ line, p, dir }]
  for (const [name, res] of Object.entries(lanes)) {
    const centre = LINE_PATHS[name].map(pt);       // track direction from the centreline, ignoring lane jogs
    res.forEach(p => {
      if (!p.st) return;
      const i = centre.findIndex(q => q.st === p.st);
      const a = centre[Math.max(0, i - 1)], b = centre[Math.min(centre.length - 1, i + 1)];
      (at[p.st] ??= []).push({ line: name, p: { x: p.x, y: p.y }, dir: unit(sub(b, a)) });
    });
  }
  const out = {};
  for (const [st, list] of Object.entries(at)) {
    const transfer = TRANSFER.has(st);
    const parallel = list.every(q => Math.abs(q.dir.x * list[0].dir.y - q.dir.y * list[0].dir.x) < 0.08);
    if (list.length === 1 || (parallel && !transfer)) {
      /* the two lanes furthest apart are the pill's ends */
      let a = list[0].p, b = list[0].p, best = -1;
      for (const q of list) for (const r of list) { const dd = len(sub(q.p, r.p)); if (dd > best) { best = dd; a = q.p; b = r.p; } }
      out[st] = { kind: list.length === 1 || best < 1e-6 ? "dot" : "pill", a, b, c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r: R_STOP, border: 0.065 };
    } else {
      const c = list.reduce((s, q) => ({ x: s.x + q.p.x / list.length, y: s.y + q.p.y / list.length }), { x: 0, y: 0 });
      const reach = Math.max(...list.map(q => len(sub(q.p, c))));
      out[st] = { kind: "dot", a: c, b: c, c, r: Math.max(R_XFER, reach + 0.17), border: 0.09, transfer: true };
    }
  }
  return out;
}

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
 * Returns { svg, lanes, bounds, markers, layers } for further animation.
 *   markers[station] = { c, r, … } in grid units — where its marker sits
 *   layers.casings / layers.lines hold one path per line, keyed by data-line
 */
export function renderSystemMap(svg, opts = {}) {
  const laneWidth = opts.laneWidth ?? 0.24;
  const stroke    = (opts.stroke ?? 0.22) * UNIT;
  const lanes     = buildLaneGeometry(laneWidth);
  const markers   = stationMarkers(lanes);
  const b         = mapBounds();

  svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.innerHTML = "";

  const gRivers  = svgEl("g", { class:"map-rivers" }, svg);
  const gCasings = svgEl("g", { class:"map-casings" }, svg);
  const gLines   = svgEl("g", { class:"map-lines" }, svg);
  const gStops   = svgEl("g", { class:"map-stations" }, svg);

  for (const r of RIVERS) svgEl("path", { d: riverOutline(r), class:"river", "data-river": r.name }, gRivers);

  /* casings first, all of them, so a bundle's lanes still touch — the paper-coloured
     edge only shows where a line crosses something (a river, another line) */
  const drawOrder = ["Red","Green","Yellow","Blue","Silver","Orange"];
  for (const name of drawOrder) {
    const d = roundedPath(lanes[name]);
    svgEl("path", { d, class:"line-casing", "data-line":name, fill:"none",
                    "stroke-width":stroke + 0.14*UNIT, "stroke-linecap":"round", "stroke-linejoin":"round" }, gCasings);
    svgEl("path", { d, class:`line line-${name}`, "data-line":name, stroke:LINE_COLORS[name], fill:"none",
                    "stroke-width":stroke, "stroke-linecap":"round", "stroke-linejoin":"round" }, gLines);
  }

  for (const [name, m] of Object.entries(markers)) {
    const g = svgEl("g", { class:`station${m.transfer ? " transfer" : ""}`, "data-station":name }, gStops);
    const [ax, ay, bx, by] = [m.a.x*UNIT, m.a.y*UNIT, m.b.x*UNIT, m.b.y*UNIT];
    if (m.kind === "pill") {
      svgEl("line", { x1:ax, y1:ay, x2:bx, y2:by, class:"st-outer", "stroke-width":2*m.r*UNIT, "stroke-linecap":"round" }, g);
      svgEl("line", { x1:ax, y1:ay, x2:bx, y2:by, class:"st-inner", "stroke-width":2*(m.r - m.border)*UNIT, "stroke-linecap":"round" }, g);
    } else {
      svgEl("circle", { cx:ax, cy:ay, r:m.r*UNIT, class:"st-outer" }, g);
      svgEl("circle", { cx:ax, cy:ay, r:(m.r - m.border)*UNIT, class:"st-inner" }, g);
    }
  }

  return { svg, lanes, bounds:b, markers,
           layers:{ rivers:gRivers, casings:gCasings, lines:gLines, stations:gStops } };
}

/* Point + heading at a distance along a path element (SVG px, degrees) */
function pose(path, total, l, look = 0.35 * UNIT) {
  const c = Math.max(0, Math.min(total, l));
  const p = path.getPointAtLength(c);
  const a = path.getPointAtLength(Math.max(0, c - look)), b = path.getPointAtLength(Math.min(total, c + look));
  return { x: p.x, y: p.y, deg: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
}

/* A little train, nose pointing along +x. On the trip map it's dark with a
   stripe in the line colour, so it never reads as a station; the ambient
   trains on the intro are simply line-coloured. */
function makeTrain(parent, color, { dark = true } = {}) {
  const g = svgEl("g", { class:"train", opacity:0 }, parent);
  const L = 1.0*UNIT, H = 0.48*UNIT;
  svgEl("rect", { x:-L/2, y:-H/2, width:L, height:H, rx:H/2, fill: dark ? INK : color, stroke:"#fff", "stroke-width":0.08*UNIT }, g);
  if (dark) svgEl("rect", { x:-L/2 + 0.12*UNIT, y:-0.065*UNIT, width:L - 0.42*UNIT, height:0.13*UNIT, rx:0.065*UNIT, fill:color }, g);
  svgEl("rect", { x:L/2 - 0.27*UNIT, y:-H/2 + 0.1*UNIT, width:0.12*UNIT, height:H - 0.2*UNIT, rx:0.05*UNIT, fill:"#fff", opacity:0.92 }, g);
  return g;
}

/**
 * Ambient trains for a decorative map: a few capsules drifting up and
 * down random lines. Returns { play(), pause() }.
 */
export function ambientTrains(map, count = 3) {
  const gsap = window.gsap;
  const paths = [...map.layers.lines.children];
  const g = svgEl("g", { class:"ambient-trains" }, map.svg);
  const tweens = [];
  const picks = [...paths].sort(() => Math.random() - 0.5).slice(0, count);
  picks.forEach((path, i) => {
    const total = path.getTotalLength();
    const train = makeTrain(g, path.getAttribute("stroke"), { dark: false });
    const proxy = { l: 0 };
    const place = () => { const p = pose(path, total, proxy.l); train.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${p.deg})`); };
    /* terminus to terminus and back, easing into each end; each train starts somewhere along its run */
    const run = gsap.fromTo(proxy, { l: 0 }, { l: total, duration: total / (1.6*UNIT), ease:"sine.inOut",
                                               repeat:-1, yoyo:true, onUpdate: place });
    run.time(Math.random() * run.duration());
    tweens.push(run, gsap.to(train, { opacity:1, duration:0.8, delay:2.2 + i * 0.6 }));
  });
  return { play: () => tweens.forEach(t => t.play()), pause: () => tweens.forEach(t => t.pause()) };
}

/* ------------------------------------------------------------------
   Trip animation
   ------------------------------------------------------------------
   animateTrip(svg, { line, from, to, labelFor, mystery, toward })
     line      – "Red" … "Green"
     from / to – station names (as in STATIONS)
     labelFor  – optional fn(name) → display name
     mystery   – keep `to` secret: draw the line on toward the terminal
                 `toward`; a pulse sweeps it evenly, no train, no pin
   The network dims, the camera glides in, and a train runs the route
   stop by stop — easing into each station, which lights up in the line
   colour as it arrives. Long trips get a camera that rides along, then
   pulls back to show the whole journey. Returns the GSAP timeline, with
   tl.reveal(station) / tl.unreveal() to show or hide a destination later.
   ------------------------------------------------------------------ */
const INK = "#1d1d1f";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Distance along `path` of each target point (in order), by sampling */
function locateAlong(path, total, targets) {
  const step = 2, n = Math.ceil(total / step);
  const samples = Array.from({ length: n + 1 }, (_, i) => { const l = Math.min(total, i * step); const p = path.getPointAtLength(l); return { l, x: p.x, y: p.y }; });
  let from = 0;
  return targets.map((t, k) => {
    if (k === 0) return 0;
    if (k === targets.length - 1) return total;
    let best = from, bestD = Infinity;
    for (let i = from; i < samples.length; i++) {
      const d = Math.hypot(samples[i].x - t.x, samples[i].y - t.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    from = best;
    return samples[best].l;
  });
}

/* Does segment pq cross the axis-aligned rect r? (Liang–Barsky) */
function segHitsRect(p, q, r) {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  for (const [pp, qq] of [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]]) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else        { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function animateTrip(svg, { line, from, to, labelFor = s => s, onDrawStart, mystery = false, toward, candidates } = {}) {
  const gsap = window.gsap;
  const map  = renderSystemMap(svg);
  const { lanes, bounds, markers } = map;
  const color = LINE_COLORS[line];
  /* mystery: draw as far as the last stop it could be (else on to the terminal) */
  const shortlist = mystery ? (candidates?.length ? candidates : null) : null;
  const end = mystery ? (shortlist?.at(-1) ?? toward ?? to) : to;

  /* ---- route geometry: drawn under the station markers ---- */
  const pts = routePoints(lanes, line, from, end);
  if (!pts) throw new Error(`No route on ${line} from ${from} to ${end}`);
  const d = roundedPath(pts);
  const gRoute = svgEl("g", { class:"map-route" });
  map.layers.stations.before(gRoute);
  const casing = svgEl("path", { d, class:"route-casing", fill:"none", stroke:"#fff",
                                 "stroke-width":0.46*UNIT, "stroke-linecap":"round", "stroke-linejoin":"round" }, gRoute);
  const route  = svgEl("path", { d, class:"route", fill:"none", stroke:color,
                                 "stroke-width":0.3*UNIT, "stroke-linecap":"round", "stroke-linejoin":"round" }, gRoute);
  const total = route.getTotalLength();
  gsap.set([casing, route], { strokeDasharray: total, strokeDashoffset: total });

  /* pins, train and labels sit above everything */
  const gTop    = svgEl("g", { class:"map-top" }, svg);
  const gLabels = svgEl("g", { class:"map-labels" }, svg);

  /* stops along the route (travel order), and how far along the path each one is */
  const stopPts = pts.filter(p => p.st);
  const stops   = stopPts.map(p => p.st);
  const stopEls = stops.map(s => map.layers.stations.querySelector(`[data-station="${CSS.escape(s)}"]`));
  const stopLen = locateAlong(route, total, stopPts.map(p => ({ x: p.x*UNIT, y: p.y*UNIT })));
  /* pins sit on the middle of a station's marker and cover it, so a pill or a
     transfer ring never peeks out from under one */
  const pinAt = s => {
    const m = markers[s], reach = m.r + Math.hypot(m.a.x - m.c.x, m.a.y - m.c.y);
    return { x: m.c.x*UNIT, y: m.c.y*UNIT, r: Math.max(0.44, reach + 0.07)*UNIT };
  };
  const O = pinAt(from), D = pinAt(to);
  const placePin = P => {
    for (const el of [dest, ripple]) { el.setAttribute("cx", P.x); el.setAttribute("cy", P.y); }
    dest.setAttribute("r", P.r); destIn.setAttribute("cx", P.x); destIn.setAttribute("cy", P.y);
    destIn.setAttribute("r", Math.max(0.19*UNIT, P.r * 0.42));
  };

  const ring   = svgEl("circle", { cx:O.x, cy:O.y, r:0.5*UNIT, fill:"none", stroke:color, "stroke-width":0.1*UNIT, class:"origin-ring", opacity:0 }, gTop);
  svgEl("circle", { cx:O.x, cy:O.y, r:0.24*UNIT, fill:INK, stroke:"#fff", "stroke-width":0.08*UNIT, class:"origin-marker" }, gTop);
  const ripple = svgEl("circle", { r:0.45*UNIT, fill:"none", stroke:color, "stroke-width":0.12*UNIT, class:"dest-ripple", opacity:0 }, gTop);
  const dest   = svgEl("circle", { fill:"#fff", stroke:INK, "stroke-width":0.11*UNIT, class:"dest-marker", opacity:0 }, gTop);
  const destIn = svgEl("circle", { fill:color, class:"dest-marker-inner", opacity:0 }, gTop);
  placePin(D);
  /* mystery: a gold "?" on every stop it could be */
  const candPins = new Map((shortlist ?? []).map(s => {
    const P = pinAt(s), r = Math.max(0.36*UNIT, P.r - 0.06*UNIT);
    const g = svgEl("g", { class:"cand-pin", opacity:0 }, gTop);
    svgEl("circle", { cx:P.x, cy:P.y, r, fill:"#D4A62A", stroke:INK, "stroke-width":0.09*UNIT }, g);
    const q = svgEl("text", { x:P.x, y:P.y + r*0.42, "text-anchor":"middle", "font-size":r*1.25, "font-weight":800, fill:INK, class:"cand-q" }, g);
    q.textContent = "?";
    return [s, g];
  }));
  const train  = mystery ? null : makeTrain(gTop, color);
  const pulse  = mystery ? svgEl("circle", { r:0.24*UNIT, fill:color, stroke:color, "stroke-opacity":0.3, "stroke-width":0.34*UNIT, class:"route-pulse", opacity:0 }, gTop) : null;

  /* ---- camera ---- */
  const W = svg.clientWidth || 300, H = svg.clientHeight || 225;
  const aspect = W / H;
  const bb = route.getBBox();
  const minW = Math.max(9 * UNIT, (W / 64) * UNIT);       // never closer than ~9 grid units across
  const fit = (pad) => {
    let x = bb.x - pad*UNIT, y = bb.y - pad*UNIT, w = bb.width + 2*pad*UNIT, h = bb.height + 2*pad*UNIT;
    if (w < minW) { x -= (minW - w) / 2; w = minW; }
    if (h < minW / aspect) { y -= (minW / aspect - h) / 2; h = minW / aspect; }
    if (w / h > aspect) { const nh = w / aspect; y -= (nh - h) / 2; h = nh; }
    else                { const nw = h * aspect; x -= (nw - w) / 2; w = nw; }
    return { x, y, w, h };
  };
  let view = fit(1.4);
  /* extra room for label text: widen the view, then re-fit */
  const endText = mystery ? (shortlist ? "" : `toward ${labelFor(end)}`) : labelFor(end);
  const longest = Math.max(labelFor(from).length, endText.length, mystery ? labelFor(to).length : 0);
  view = fit(Math.max(1.4, Math.min((longest * 0.6 * 13 * (view.w / W)) / UNIT + 0.8, 3.2)));
  const pxPerUnit = () => (W / view.w) * UNIT;

  /* ride-along camera for trips too long to read at full-route zoom */
  const FOLLOW_W = Math.max(minW, 10.5 * UNIT);
  const follow = !mystery && view.w / FOLLOW_W >= 1.7;
  const camAt = l => {
    const k = 1.5 * UNIT, p = [l - k, l, l + k].map(v => route.getPointAtLength(clamp(v, 0, total)));
    const cx = (p[0].x + p[1].x + p[2].x) / 3, cy = (p[0].y + p[1].y + p[2].y) / 3;
    const w = FOLLOW_W, h = w / aspect;
    return { x: clamp(cx - w / 2, view.x, view.x + view.w - w), y: clamp(cy - h / 2, view.y, view.y + view.h - h), w, h };
  };
  const vb = v => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`;

  /* ---- labels: sized for the final view, placed where they hit the least ---- */
  const R2 = Math.SQRT1_2;
  const SIDES = { E:{x:1,y:0}, W:{x:-1,y:0}, N:{x:0,y:-1}, S:{x:0,y:1}, NE:{x:R2,y:-R2}, NW:{x:-R2,y:-R2}, SE:{x:R2,y:R2}, SW:{x:-R2,y:R2} };
  const angle = (a, b) => Math.acos(clamp(a.x*b.x + a.y*b.y, -1, 1));
  const segmentDirs = station => {
    const dirs = [];
    for (const path of Object.values(LINE_PATHS)) {
      const p = path.map(pt), i = p.findIndex(q => q.st === station);
      if (i < 0) continue;
      if (i > 0)            dirs.push(unit(sub(p[i-1], p[i])));
      if (i < p.length - 1) dirs.push(unit(sub(p[i+1], p[i])));
    }
    return dirs;
  };
  const inView = r => r.x >= view.x && r.y >= view.y && r.x + r.w <= view.x + view.w && r.y + r.h <= view.y + view.h;
  const segments = Object.entries(lanes).flatMap(([name, res]) => res.slice(1).map((q, i) => ({
    p: { x: res[i].x*UNIT, y: res[i].y*UNIT }, q: { x: q.x*UNIT, y: q.y*UNIT }, line: name })));
  const placed = [];

  const makeLabel = (station, text, role) => {
    const m = markers[station];
    const cx = m.c.x*UNIT, cy = m.c.y*UNIT, rad = m.r*UNIT + Math.hypot(m.a.x - m.c.x, m.a.y - m.c.y)*UNIT;
    const fs = (role === "mid" ? 10.5 : 13) * (view.w / W);  // px → svg units
    const textW = text.length * (role === "mid" ? 0.53 : 0.57) * fs;
    const gap = rad + 0.16*UNIT, dg = gap * 0.78;
    const spots = {
      E:  [cx + gap, cy + fs*0.35, "start"],  W:  [cx - gap, cy + fs*0.35, "end"],
      N:  [cx, cy - gap - fs*0.12, "middle"], S:  [cx, cy + gap + fs*0.8, "middle"],
      NE: [cx + dg, cy - dg, "start"],        NW: [cx - dg, cy - dg, "end"],
      SE: [cx + dg, cy + dg + fs*0.75, "start"], SW: [cx - dg, cy + dg + fs*0.75, "end"]
    };
    const rectFor = (x, y, anchor) => ({ x: anchor === "start" ? x : anchor === "end" ? x - textW : x - textW/2, y: y - fs*0.78, w: textW, h: fs });
    const dirs = segmentDirs(station);
    let best = null;
    for (const [side, v] of Object.entries(SIDES)) {
      let [x, y, anchor] = spots[side];
      let r = rectFor(x, y, anchor);
      if (anchor === "middle") {                               // slide a centred label back inside the frame
        const m = 0.25*UNIT, shift = clamp(0, view.x + m - r.x, view.x + view.w - m - (r.x + r.w));
        x += shift; r = rectFor(x, y, anchor);
      }
      /* hard rules first (stay in frame, don't sit on another label), then fewest lines crossed */
      let s = dirs.length ? Math.min(...dirs.map(dd => angle(v, dd))) : Math.PI;
      if (!inView(r)) s -= 10;
      if (placed.some(o => rectsOverlap(o, r))) s -= 6;
      const fat = { x: r.x - 0.12*UNIT, y: r.y - 0.12*UNIT, w: r.w + 0.24*UNIT, h: r.h + 0.24*UNIT };
      const crossed = new Set(segments.filter(sg => segHitsRect(sg.p, sg.q, fat)).map(sg => sg.line));
      for (const l of crossed) s -= l === line ? 1.0 : 0.35;
      let blocked = 0;
      for (const [other, om] of Object.entries(markers))
        if (other !== station && rectsOverlap(fat, { x: om.c.x*UNIT - om.r*UNIT, y: om.c.y*UNIT - om.r*UNIT, w: 2*om.r*UNIT, h: 2*om.r*UNIT })) blocked++;
      s -= Math.min(blocked, 3) * 0.4;
      if (side === "E") s += 0.05;
      if (side.length === 1) s += 0.03;
      if (!best || s > best.s) best = { s, x, y, anchor, r };
    }
    const t = svgEl("text", { class:`map-label ${role}`, x:best.x, y:best.y, "text-anchor":best.anchor, "font-size":fs,
                              "paint-order":"stroke", "stroke-width":fs*0.3, "stroke-linejoin":"round", opacity:0 }, gLabels);
    t.textContent = text;
    placed.push(best.r);
    return t;
  };
  const fromLabel = makeLabel(from, labelFor(from), "from");
  const endLabel  = endText ? makeLabel(end, endText, mystery ? "toward" : "to") : null;
  const midLabels = {};
  if (!mystery && !follow && stops.length <= 7 && pxPerUnit() >= 34)
    stops.slice(1, -1).forEach(s => (midLabels[s] = makeLabel(s, labelFor(s), "mid")));

  /* ---- stations: hidden at overview; the route's own stand out ---- */
  const allStations = [...map.layers.stations.children];
  gsap.set(allStations, { opacity:0, transformOrigin:"50% 50%" });
  stopEls.forEach(el => el.classList.add("on-route"));
  const offRoute = allStations.filter(el => !el.classList.contains("on-route"));
  const byLine = layer => [...layer.children];
  const others = [...byLine(map.layers.lines), ...byLine(map.layers.casings)].filter(p => p.dataset.line !== line);
  const mine   = map.layers.lines.querySelector(`[data-line="${line}"]`);

  svg.setAttribute("viewBox", vb(bounds));

  /* ---- pacing ---- */
  const n = stops.length - 1;
  const segmented = !mystery && n <= 14;
  const dwell   = segmented ? (n <= 4 ? 0.16 : n <= 8 ? 0.1 : 0.05) : 0;
  const drawDur = mystery ? clamp(0.45 + 0.11*n, 0.9, 2.2) : clamp(0.7 + 0.3*n, 1.1, 3.9);
  const proxy = { l: 0 };
  const apply = (camera = true) => {
    const l = proxy.l;
    casing.style.strokeDashoffset = route.style.strokeDashoffset = total - l;
    const p = pose(route, total, l);
    if (train) train.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.deg.toFixed(1)})`);
    if (pulse) { pulse.setAttribute("cx", p.x); pulse.setAttribute("cy", p.y); }
    if (follow && camera) svg.setAttribute("viewBox", vb(camAt(l)));
  };

  /* ---- timeline ---- */
  const tl = gsap.timeline();
  const DRAW = 1.9;
  tl.to(ring, { opacity:1, duration:0.3 }, 0.25)
    .fromTo(ring, { attr:{ r:0.2*UNIT } }, { attr:{ r:0.95*UNIT }, opacity:0, duration:1.0, ease:"power2.out", repeat:1 }, 0.25)
    .to(others,            { opacity:0.16, duration:0.6, ease:"power1.out" }, 0.45)
    .to(map.layers.rivers, { opacity:0.6,  duration:0.6 }, 0.45)
    .to(mine,              { opacity:0.5,  duration:0.6 }, 0.45)
    .fromTo(svg, { attr:{ viewBox: vb(bounds) } }, { attr:{ viewBox: vb(follow ? camAt(0) : view) }, duration:1.3, ease:"power2.inOut" }, 0.6)
    .to(offRoute, { opacity:0.55, duration:0.5 }, 1.1)
    .to(stopEls,  { opacity:1,    duration:0.5 }, 1.1)
    .add(() => onDrawStart && onDrawStart(), DRAW)
    .to(train ?? pulse, { opacity:1, duration:0.2 }, DRAW);
  if (!follow) tl.to(fromLabel, { opacity:1, duration:0.4 }, DRAW - 0.3);

  /* a station lights up in the line colour as the train (or pulse) reaches it */
  const arriveAt = (i, at) => {
    const el = stopEls[i];
    tl.set(el.querySelectorAll(".st-outer"), { fill: color, stroke: color }, at)
      .fromTo(el, { scale:1 }, { scale: mystery ? 1.22 : 1.38, duration:0.15, ease:"power2.out", yoyo:true, repeat:1, immediateRender:false }, at - 0.04);
    if (midLabels[stops[i]]) tl.to(midLabels[stops[i]], { opacity:1, duration:0.3 }, at);
    const pin = candPins.get(stops[i]);
    if (pin) tl.fromTo(pin, { opacity:0, scale:0.3, transformOrigin:"50% 50%" },
                       { opacity:1, scale:1, duration:0.4, ease:"back.out(2.6)", immediateRender:false }, at);
  };

  let drawEnd;
  if (segmented) {
    /* stop by stop: ease out of each station, ease into the next, a beat at each platform */
    const segLen = stopLen.slice(1).map((l, i) => l - stopLen[i]);
    const avg = total / n;
    const weight = segLen.map(s => Math.max(s, 0.6 * avg) ** 0.8);
    const sum = weight.reduce((a, b) => a + b, 0);
    const move = drawDur - dwell * (n - 1);
    let at = DRAW + 0.15;
    segLen.forEach((_, i) => {
      const dur = move * weight[i] / sum;
      tl.to(proxy, { l: stopLen[i + 1], duration: dur, ease:"power2.inOut", onUpdate: apply }, at);
      at += dur;
      if (i < n - 1) { arriveAt(i + 1, at); at += dwell; }
    });
    drawEnd = at;
  } else {
    /* long run (or the mystery sweep): one smooth glide, stations ticking past at constant pace */
    const ease = gsap.parseEase("power1.inOut");
    const invert = f => { let a = 0, b = 1; for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (ease(m) < f) a = m; else b = m; } return (a + b) / 2; };
    tl.to(proxy, { l: total, duration: drawDur, ease:"power1.inOut", onUpdate: apply }, DRAW + 0.15);
    for (let i = 1; i < n; i++) arriveAt(i, DRAW + 0.15 + drawDur * invert(stopLen[i] / total));
    drawEnd = DRAW + 0.15 + drawDur;
  }
  apply(false);                                           // park the train at the origin; the camera stays on the overview

  if (mystery) {
    arriveAt(n, drawEnd);
    tl.to(pulse, { opacity:0, duration:0.3 }, drawEnd);
    if (endLabel) tl.to(endLabel, { opacity:1, duration:0.4 }, drawEnd - 0.2);
  } else {
    arriveAt(n, drawEnd);
    tl.to(train, { opacity:0, scale:0.6, transformOrigin:"50% 50%", duration:0.3 }, drawEnd + 0.05)
      .fromTo([dest, destIn], { opacity:0, scale:0.4, transformOrigin:"50% 50%" },
              { opacity:1, scale:1, duration:0.5, ease:"back.out(2.5)", stagger:0.05 }, drawEnd)
      .fromTo(ripple, { attr:{ r:D.r }, opacity:0.9 },
              { attr:{ r:D.r + 0.95*UNIT }, opacity:0, duration:0.85, ease:"power2.out", immediateRender:false }, drawEnd + 0.05);
    if (follow) {
      /* pull back from the ride-along view to the whole journey, then name both ends */
      tl.fromTo(svg, { attr:{ viewBox: vb(camAt(total)) } }, { attr:{ viewBox: vb(view) }, duration:1.0, ease:"power2.inOut", immediateRender:false }, drawEnd + 0.2)
        .to([fromLabel, endLabel], { opacity:1, duration:0.4, stagger:0.1 }, drawEnd + 0.85);
    } else {
      tl.to(endLabel, { opacity:1, duration:0.4 }, drawEnd + 0.1);
    }
  }

  /* Peek: drop the destination pin + label onto the finished map */
  let peekLabel = null;
  const fixedLabels = placed.length;
  tl.reveal = (station = to) => {
    placePin(pinAt(station));
    candPins.forEach((g, s) => gsap.to(g, { opacity: s === station ? 0 : 0.35, duration:0.25 }));
    gsap.fromTo([dest, destIn], { opacity:0, scale:0.4, transformOrigin:"50% 50%" },
                { opacity:1, scale:1, duration:0.45, ease:"back.out(2.5)", stagger:0.05 });
    peekLabel?.remove();
    placed.length = fixedLabels;                           // forget an older peek's label
    peekLabel = makeLabel(station, labelFor(station), "to");
    gsap.to(peekLabel, { opacity:1, duration:0.35 });
  };
  tl.unreveal = () => {
    gsap.to([dest, destIn], { opacity:0, duration:0.2 });
    candPins.forEach(g => gsap.to(g, { opacity:1, duration:0.25 }));
    peekLabel?.remove(); peekLabel = null;
  };

  return tl;
}
