// Dragunfly — geo helpers. Pure client-side, browser Geolocation API only.

const EARTH_RADIUS_M = 6371000;
// Spawns are generated directly around the player's own position (not
// snapped to a fixed map grid), so they're always close enough to keep a
// small drone in unaided visual line of sight — the game should never be
// the reason someone flies further than they can clearly see their aircraft.
const MIN_SPAWN_DISTANCE_M = 20;
const MAX_SPAWN_DISTANCE_M = 180;
const SPAWN_SLOTS = 10;
const SPAWN_CHANCE = 0.55;
// Players within the same ~50m bucket see the same spawns today, so two
// pilots standing near each other see a shared "world" without a backend.
const BUCKET_SIZE_DEG = 0.00045;

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

// Destination point given a start, bearing, and distance (standard
// spherical-earth formula — plenty accurate at these short ranges).
function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lng);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return { lat: (phi2 * 180) / Math.PI, lng: (lambda2 * 180) / Math.PI };
}

function rand01(key) {
  return (hashString(key) % 100000) / 100000;
}

function getNearbySpawns(playerLat, playerLng) {
  const bucketLat = Math.round(playerLat / BUCKET_SIZE_DEG) * BUCKET_SIZE_DEG;
  const bucketLng = Math.round(playerLng / BUCKET_SIZE_DEG) * BUCKET_SIZE_DEG;
  const seed = `${bucketLat.toFixed(6)},${bucketLng.toFixed(6)},${dailySeed()}`;
  const spawns = [];

  for (let i = 0; i < SPAWN_SLOTS; i++) {
    const slotKey = `${seed}:${i}`;
    if (rand01(`${slotKey}:exist`) > SPAWN_CHANCE) continue;

    const bearing = rand01(`${slotKey}:bearing`) * 360;
    const distance =
      MIN_SPAWN_DISTANCE_M + rand01(`${slotKey}:dist`) * (MAX_SPAWN_DISTANCE_M - MIN_SPAWN_DISTANCE_M);
    const { lat, lng } = destinationPoint(bucketLat, bucketLng, bearing, distance);

    const species = pickWeighted(rand01(`${slotKey}:species`), CREATURES);
    const altitude = Math.round(
      species.minAlt + rand01(`${slotKey}:alt`) * (species.maxAlt - species.minAlt)
    );

    spawns.push({ uid: slotKey, species, lat, lng, altitude });
  }

  return spawns;
}
