// remove-chains.js
const fs = require('fs');

// List of known chains to remove
const CHAIN_NAMES = [
  "McDonald's",
  "Wendy's",
  "Burger King",
  "Starbucks",
  "Subway",
  "Dunkin'",
  "Panera",
  "Jimmy John's",
  "Chipotle",
  "Five Guys",
  "Panda Express",
  "Domino's",
  "Papa John's",
  "Taco Bell",
  "KFC",
  "Pizza Hut",
  "Shake Shack",
  "Sweetgreen",
  "Chick-fil-A",
  "Potbelly",
  "Blaze Pizza",
  "Pret A Manger",
  "Au Bon Pain",
  "Jamba Juice",
  "Gregorys Coffee",
  "Joe & the Juice",
  "Blue Bottle Coffee",
  "Wawa",
  "Roti",
  "California Tortilla",
  "Elephant & Castle",
  "&pizza",
  "Devon & Blakely"
];

// Load the dataset
const data = JSON.parse(fs.readFileSync('places.json', 'utf-8'));

// Remove chain restaurants
for (const station in data) {
  data[station] = data[station].filter(place => {
    return !CHAIN_NAMES.some(chain =>
      place.name.toLowerCase().includes(chain.toLowerCase())
    );
  });
}

// Save cleaned dataset
fs.writeFileSync('places-cleaned.json', JSON.stringify(data, null, 2));
console.log('Chain restaurants removed. Cleaned data saved as places-cleaned.json');
