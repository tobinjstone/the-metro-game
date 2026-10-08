/* ==================================================================
   places.js — the venue guide: loading, categories, filtering and
   picking. Pure functions (no DOM) so node scripts can test them.
   places.json itself is untouched; everything here runs at load time.
   ================================================================== */

/* WMATA spellings (metro-lines.js) → the keys used in places.json
   (which match WMATA's API station names). */
export const stationAlias = {
  "Addison Road–Seat Pleasant": "Addison Road-Seat Pleasant",
  "Archives"                  : "Archives-Navy Memorial-Penn Quarter",
  "Ballston–MU"               : "Ballston-MU",
  "Brookland–CUA"             : "Brookland-CUA",
  "College Park–U of Md"      : "College Park-U of Md",
  "Courthouse"                : "Court House",
  "Dunn Loring"               : "Dunn Loring-Merrifield",
  "Foggy Bottom–GWU"          : "Foggy Bottom-GWU",
  "Franconia–Springfield"     : "Franconia-Springfield",
  "Gallery Place"             : "Gallery Pl-Chinatown",
  "Georgia Ave–Petworth"      : "Georgia Ave-Petworth",
  "Grosvenor–Strathmore"      : "Grosvenor-Strathmore",
  "King Street–Old Town"      : "King St-Old Town",
  "Mount Vernon Square"       : "Mt Vernon Sq 7th St-Convention Center",
  "Navy Yard–Ballpark"        : "Navy Yard-Ballpark",
  "NoMa–Gallaudet U"          : "NoMa-Gallaudet U",
  "Potomac Yard–VT"           : "Potomac Yard",
  "Rhode Island Ave"          : "Rhode Island Ave-Brentwood",
  "Shaw–Howard U"             : "Shaw-Howard U",
  "Southern Ave"              : "Southern Avenue",
  "Stadium–Armory"            : "Stadium-Armory",
  "Tenleytown–AU"             : "Tenleytown-AU",
  "U Street"                  : "U Street/African-Amer Civil War Memorial/Cardozo",
  "Van Ness–UDC"              : "Van Ness-UDC",
  "Vienna"                    : "Vienna/Fairfax-GMU",
  "Virginia Square–GMU"       : "Virginia Square-GMU",
  "Wiehle–Reston East"        : "Wiehle-Reston East",
  "Woodley Park"              : "Woodley Park-Zoo/Adams Morgan"
};
export const dataKey = station => stationAlias[station] ?? station;

export const CATEGORIES = ["Coffee", "Drinks", "Food", "Activity", "Shopping"];
export const CATEGORY_WORD = { Coffee: "coffee", Drinks: "drinks", Food: "food", Activity: "activity", Shopping: "shopping" };

/* Google "types" → the five buckets */
const TYPE_TO_CATEGORY = {
  bar: "Drinks", night_club: "Drinks",
  cafe: "Coffee", coffee_shop: "Coffee",
  restaurant: "Food", meal_takeaway: "Food", meal_delivery: "Food", bakery: "Food", food: "Food",
  park: "Activity", museum: "Activity", art_gallery: "Activity", tourist_attraction: "Activity",
  landmark: "Activity", movie_theater: "Activity", spa: "Activity", stadium: "Activity", zoo: "Activity",
  bowling_alley: "Activity", library: "Activity", amusement_park: "Activity", aquarium: "Activity",
  clothing_store: "Shopping", book_store: "Shopping", shoe_store: "Shopping", electronics_store: "Shopping",
  shopping_mall: "Shopping", bicycle_store: "Shopping", jewelry_store: "Shopping", florist: "Shopping",
  furniture_store: "Shopping", hardware_store: "Shopping", pet_store: "Shopping",
  department_store: "Shopping", home_goods_store: "Shopping", store: "Shopping"
};
/* A liquor store only counts as Drinks when you can also sit down there */
const ON_SITE = new Set(["bar", "restaurant", "cafe", "food", "bakery", "meal_takeaway"]);

/* A place whose first-listed type is one of these isn't an outing */
const EXCLUDED_TYPES = new Set([
  "beauty_salon", "hair_care", "doctor", "dentist", "health", "hospital", "pharmacy", "drugstore",
  "local_government_office", "parking", "school", "lodging", "travel_agency", "gym", "bank", "atm",
  "real_estate_agency", "insurance_agency", "lawyer", "car_repair", "car_dealer", "gas_station",
  "laundry", "post_office", "storage", "moving_company", "convenience_store", "grocery_or_supermarket",
  "supermarket", "funeral_home", "church", "place_of_worship", "physiotherapist", "veterinary_care"
]);

/* National/international chains. Matched against punctuation-free names,
   so "Papa Johns" and "Papa John's" both hit. Single words only match
   the start of a name. "&pizza" is checked on the raw name because it
   normalises to plain "pizza". */
const CHAINS = [
  "mcdonalds", "wendys", "burger king", "starbucks", "subway", "dunkin", "panera", "jimmy johns",
  "chipotle", "five guys", "panda express", "dominos", "papa johns", "taco bell", "kfc", "pizza hut",
  "shake shack", "sweetgreen", "chick fil a", "potbelly", "blaze pizza", "pret a manger", "au bon pain",
  "jamba", "gregorys coffee", "joe the juice", "blue bottle", "wawa", "roti", "california tortilla",
  "elephant castle", "devon blakely", "nandos", "jersey mikes", "ihop", "peets coffee", "cold stone",
  "macys", "marshalls", "tj maxx", "target", "cvs", "walgreens", "7 eleven", "fedex", "the ups store",
  "at t", "verizon", "t mobile", "ubreakifix", "the container store", "le pain quotidien", "cava",
  "chopt", "qdoba", "popeyes", "dennys", "applebees", "olive garden", "cheesecake factory",
  "buffalo wild wings", "pollo campero", "fogo de chao", "the capital grille", "mortons the steakhouse",
  "ruths chris", "maggianos", "the cheesecake factory", "pf changs", "cosi", "baskin robbins", "krispy kreme", "auntie annes", "cinnabon", "h m", "zara",
  "uniqlo", "gap", "old navy", "best buy", "staples", "petco", "petsmart", "dollar tree", "ross dress"
];
/* Brands whose name is also an ordinary word or surname: only an exact
   name match counts ("Marshalls" yes, "Marshall's Bar & Grille" no). */
const EXACT_CHAINS = new Set(["marshalls", "target", "gap", "zara", "cosi", "roti", "cava"]);
export const normalizeName = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export function isChain(name) {
  if (/^\s*&\s*pizza/i.test(name)) return true;
  const n = normalizeName(name);
  if (EXACT_CHAINS.has(n)) return true;
  return CHAINS.some(c => !EXACT_CHAINS.has(c) && (c.includes(" ") ? ` ${n} `.includes(` ${c} `) : ` ${n} `.startsWith(` ${c} `)));
}

/* Not the kind of surprise anyone asked for */
const ADULT = /strip club|gentlem[ae]n'?s club|showbar/i;

/* Categories for one Google row; [] means "leave it out of the guide" */
export function categorize(row) {
  const types = (row.types ?? []).filter(t => t !== "point_of_interest" && t !== "establishment");
  if (!types.length || EXCLUDED_TYPES.has(types[0])) return [];
  const cats = new Set();
  for (const t of types) {
    if (t === "liquor_store") { if (types.some(x => ON_SITE.has(x))) cats.add("Drinks"); continue; }
    if (TYPE_TO_CATEGORY[t]) cats.add(TYPE_TO_CATEGORY[t]);
  }
  /* a generic "store" that is really a restaurant or café isn't Shopping */
  if (cats.has("Shopping") && types.includes("store") && !types.some(t => TYPE_TO_CATEGORY[t] === "Shopping" && t !== "store")
      && (cats.has("Food") || cats.has("Coffee") || cats.has("Activity"))) cats.delete("Shopping");
  return [...cats];
}

/* raw places.json → { dataKey: [place, …] } with categories attached */
export function indexPlaces(raw) {
  const rows = Array.isArray(raw) ? raw : Object.values(raw).flat();
  const byStation = {};
  for (const row of rows) {
    if (isChain(row.name) || ADULT.test(row.name)) continue;
    if (row.rating != null && row.rating < 3.5 && (row.user_ratings_total ?? 0) >= 5) continue;
    const categories = categorize(row);
    if (!categories.length) continue;
    (byStation[row.station] ??= []).push({ ...row, categories });
  }
  return byStation;
}

/* { total, counts: { Coffee: 4, … } } — counts can overlap */
export function roster(list = []) {
  const counts = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (const p of list) for (const c of p.categories) counts[c]++;
  return { total: list.length, counts };
}

export const matches = (place, mood) => !mood || mood === "Surprise" || place.categories.includes(mood);

/* Order to show venues in: a weighted shuffle that favours well-rated,
   well-reviewed places but still surfaces everything eventually. */
export function venueOrder(list, mood, rng = Math.random) {
  const pool = list.filter(p => matches(p, mood));
  const weight = p => {
    const r = p.rating ?? 4, n = p.user_ratings_total ?? 10;
    return Math.max(0.15, (r - 3) ** 2) * Math.log10(n + 10);
  };
  return pool
    .map(p => ({ p, key: -Math.log(rng() || 1e-9) / weight(p) }))      // Efraimidis–Spirakis
    .sort((a, b) => a.key - b.key)
    .map(x => x.p);
}

/* Walking minutes + 8-point compass direction from the station */
const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
export function walkInfo(place, stationLatLng) {
  const minutes = place.distance_m ? Math.max(1, Math.round(place.distance_m / 80)) : null;
  if (!stationLatLng || !place.location) return { minutes, direction: null };
  const [lat1, lng1] = stationLatLng, { lat: lat2, lng: lng2 } = place.location;
  const dy = lat2 - lat1, dx = (lng2 - lng1) * Math.cos(lat1 * Math.PI / 180);
  if (Math.hypot(dx, dy) < 0.0006) return { minutes, direction: null };   // basically at the station
  const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  return { minutes, direction: COMPASS[Math.round(bearing / 45) % 8] };
}
