// Dragunfly — creature roster
// All original characters. No third-party IP. Altitude bands are capped at
// 400ft AGL to match the FAA Part 107 / recreational flight ceiling, so the
// game never encourages a pilot to fly higher than the law already allows.

const CREATURES = [
  { id: "glimmerfly",   name: "Glimmerfly",     rarity: "common",    minAlt: 0,   maxAlt: 100, weight: 40, color: "#8ecae6" },
  { id: "mistwing",     name: "Mistwing",       rarity: "common",    minAlt: 0,   maxAlt: 100, weight: 40, color: "#a8dadc" },
  { id: "duskhopper",   name: "Duskhopper",     rarity: "common",    minAlt: 50,  maxAlt: 150, weight: 35, color: "#adb5bd" },
  { id: "stormtail",    name: "Stormtail",      rarity: "uncommon",  minAlt: 100, maxAlt: 200, weight: 20, color: "#5390d9" },
  { id: "emberwing",    name: "Emberwing",      rarity: "uncommon",  minAlt: 100, maxAlt: 200, weight: 20, color: "#ff7b54" },
  { id: "frostquill",   name: "Frostquill",     rarity: "uncommon",  minAlt: 150, maxAlt: 250, weight: 18, color: "#90e0ef" },
  { id: "ironjaw",      name: "Ironjaw",        rarity: "rare",      minAlt: 200, maxAlt: 300, weight: 8,  color: "#6c757d" },
  { id: "voidwing",     name: "Voidwing",       rarity: "rare",      minAlt: 200, maxAlt: 300, weight: 8,  color: "#7209b7" },
  { id: "auroralux",    name: "Auroralux",      rarity: "legendary", minAlt: 300, maxAlt: 400, weight: 2,  color: "#f9c74f" },
  { id: "draconis-prime", name: "Draconis Prime", rarity: "legendary", minAlt: 350, maxAlt: 400, weight: 1, color: "#ffd60a", flagship: true },
];

const RARITY_LABEL = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

// Deterministic string hash (djb2) so every pilot at the same grid cell,
// on the same day, sees the same spawns — no backend/server required.
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function pickWeighted(rng, items) {
  const total = items.reduce((sum, c) => sum + c.weight, 0);
  let r = rng * total;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return items[items.length - 1];
}

function dailySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
