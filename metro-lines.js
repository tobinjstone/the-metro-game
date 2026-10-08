/* ------------------------------------------------------------------
   DC Metro lines & stations  – last verified: 28 Aug 2026
   Colours are WMATA's official GTFS route colours. `text` is the label colour
   on that colour: white only clears 4.5:1 contrast on Red, so the rest use ink.
   ------------------------------------------------------------------ */
export const metroLines = [
  {
    name: "Red", code: "RD",
    color: "#BF0D3E",
    text: "#ffffff",
    stations: [
      "Shady Grove","Rockville","Twinbrook","North Bethesda",
      "Grosvenor–Strathmore","Medical Center","Bethesda",
      "Friendship Heights","Tenleytown–AU","Van Ness–UDC",
      "Cleveland Park","Woodley Park","Dupont Circle",
      "Farragut North","Metro Center","Gallery Place",
      "Judiciary Square","Union Station","NoMa–Gallaudet U",
      "Rhode Island Ave","Brookland–CUA","Fort Totten",
      "Takoma","Silver Spring","Forest Glen","Wheaton","Glenmont"
    ]
  },
  {
    name: "Orange", code: "OR",
    color: "#ED8B00",
    text: "#1d1d1f",
    stations: [
      "Vienna","Dunn Loring","West Falls Church","East Falls Church",
      "Ballston–MU","Virginia Square–GMU","Clarendon","Courthouse",
      "Rosslyn","Foggy Bottom–GWU","Farragut West","McPherson Square",
      "Metro Center","Federal Triangle","Smithsonian","L'Enfant Plaza",
      "Federal Center SW","Capitol South","Eastern Market","Potomac Ave",
      "Stadium–Armory","Minnesota Ave","Deanwood","Cheverly",
      "Landover","New Carrollton"
    ]
  },
  {
    name: "Silver", code: "SV",
    color: "#919D9D",
    text: "#1d1d1f",
    stations: [
      "Ashburn","Loudoun Gateway","Washington Dulles International Airport",
      "Innovation Center","Herndon","Reston Town Center",
      "Wiehle–Reston East","Spring Hill","Greensboro","Tysons","McLean",
      "East Falls Church","Ballston–MU","Virginia Square–GMU",
      "Clarendon","Courthouse","Rosslyn","Foggy Bottom–GWU",
      "Farragut West","McPherson Square","Metro Center",
      "Federal Triangle","Smithsonian","L'Enfant Plaza",
      "Federal Center SW","Capitol South","Eastern Market","Potomac Ave",
      "Stadium–Armory","Benning Road","Capitol Heights",
      "Addison Road–Seat Pleasant","Morgan Boulevard","Downtown Largo"
    ]
  },
  {
    name: "Blue", code: "BL",
    color: "#009CDE",
    text: "#1d1d1f",
    stations: [
      "Franconia–Springfield","Van Dorn Street","King Street–Old Town",
      "Braddock Road","Potomac Yard–VT","Ronald Reagan Washington National Airport",
      "Crystal City","Pentagon City","Pentagon","Arlington Cemetery",
      "Rosslyn","Foggy Bottom–GWU","Farragut West","McPherson Square",
      "Metro Center","Federal Triangle","Smithsonian","L'Enfant Plaza",
      "Federal Center SW","Capitol South","Eastern Market","Potomac Ave",
      "Stadium–Armory","Benning Road","Capitol Heights",
      "Addison Road–Seat Pleasant","Morgan Boulevard","Downtown Largo"
    ]
  },
  {
    /* Since May 2023 the Yellow Line runs Huntington ↔ Mount Vernon Square only. */
    name: "Yellow", code: "YL",
    color: "#FFD100",
    text: "#1d1d1f",
    stations: [
      "Huntington","Eisenhower Avenue","King Street–Old Town",
      "Braddock Road","Potomac Yard–VT","Ronald Reagan Washington National Airport",
      "Crystal City","Pentagon City","Pentagon","L'Enfant Plaza",
      "Archives","Gallery Place","Mount Vernon Square"
    ]
  },
  {
    name: "Green", code: "GR",
    color: "#00B140",
    text: "#1d1d1f",
    stations: [
      "Branch Ave","Suitland","Naylor Road","Southern Ave",
      "Congress Heights","Anacostia","Navy Yard–Ballpark","Waterfront",
      "L'Enfant Plaza","Archives","Gallery Place","Mount Vernon Square",
      "Shaw–Howard U","U Street","Columbia Heights",
      "Georgia Ave–Petworth","Fort Totten","West Hyattsville",
      "Hyattsville Crossing","College Park–U of Md","Greenbelt"
    ]
  }
];

/* Short display names for places where the full name is too long */
export const shortNames = {
  "Ronald Reagan Washington National Airport": "National Airport",
  "Washington Dulles International Airport": "Dulles Airport",
  "Addison Road–Seat Pleasant": "Addison Road",
  "U Street": "U Street",
  "Mount Vernon Square": "Mt Vernon Sq"
};
export const shortName = s => shortNames[s] ?? s;
