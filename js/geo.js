// Dragunfly — geo helpers. Pure client-side, browser Geolocation API only.

const EARTH_RADIUS_M = 6371000;
const GRID_SIZE_DEG = 0.0018; // ~200m cells
const SPAWN_SEARCH_RADIUS_CELLS = 2; // scan a 5x5 grid around the player
// Kept conservative on purpose: a small consumer drone is easy to keep in
// unaided visual line of sight within this range in open conditions. The
// game should never be the reason someone flies further than they can
// clearly see their aircraft.
const MAX_SPAWN_DISTANCE_M = 180;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function bearingDegrees(lat1, lng1, lat2, lng2) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function gridCell(lat, lng) {
  return [Math.floor(lat / GRID_SIZE_DEG), Math.floor(lng / GRID_SIZE_DEG)];
}

// Generate the deterministic spawn (if any) for a single grid cell.
function spawnForCell(cellLat, cellLng, seed) {
  const key = `${cellLat},${cellLng},${seed}`;
  const h = hashString(key);
  const spawnRoll = (h % 1000) / 1000; // 0..1
  if (spawnRoll > 0.35) return null; // ~35% of cells have a spawn today

  const speciesRng = ((h >>> 8) % 1000) / 1000;
  const species = pickWeighted(speciesRng, CREATURES);

  const altRng = ((h >>> 16) % 1000) / 1000;
  const altitude = Math.round(species.minAlt + altRng * (species.maxAlt - species.minAlt));

  // Jitter the exact point within the cell so pins aren't grid-aligned.
  const jitterLat = (((h >>> 4) % 1000) / 1000) * GRID_SIZE_DEG;
  const jitterLng = (((h >>> 12) % 1000) / 1000) * GRID_SIZE_DEG;
  const lat = cellLat * GRID_SIZE_DEG + jitterLat;
  const lng = cellLng * GRID_SIZE_DEG + jitterLng;

  return {
    uid: `${species.id}-${cellLat}-${cellLng}-${seed}`,
    species,
    lat,
    lng,
    altitude,
  };
}

function getNearbySpawns(playerLat, playerLng) {
  const [cLat, cLng] = gridCell(playerLat, playerLng);
  const seed = dailySeed();
  const spawns = [];
  for (let dLat = -SPAWN_SEARCH_RADIUS_CELLS; dLat <= SPAWN_SEARCH_RADIUS_CELLS; dLat++) {
    for (let dLng = -SPAWN_SEARCH_RADIUS_CELLS; dLng <= SPAWN_SEARCH_RADIUS_CELLS; dLng++) {
      const spawn = spawnForCell(cLat + dLat, cLng + dLng, seed);
      if (!spawn) continue;
      if (haversineMeters(playerLat, playerLng, spawn.lat, spawn.lng) > MAX_SPAWN_DISTANCE_M) continue;
      spawns.push(spawn);
    }
  }
  return spawns;
}
