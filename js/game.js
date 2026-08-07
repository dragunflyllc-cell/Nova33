// Dragunfly — main game logic. No drone integration: this only ever reads
// the pilot's own phone GPS. The pilot flies their real drone using their
// drone's own controller/app and self-confirms altitude here.

const CAPTURE_RADIUS_M = 30;
const ALT_TOLERANCE_FT = 25;
const STORAGE_KEY = "dragunfly_collection_v1";

let map, playerMarker, playerLat, playerLng;
const spawnMarkers = new Map();
let activeSpawn = null;
let watchId = null;

function loadCollection() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCapture(entry) {
  const collection = loadCollection();
  collection.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  renderCollection();
}

function renderCollection() {
  const collection = loadCollection();
  const el = document.getElementById("collection-count");
  if (el) el.textContent = collection.length;

  const list = document.getElementById("collection-list");
  if (!list) return;
  list.innerHTML = "";
  if (collection.length === 0) {
    list.innerHTML = '<p class="empty">No catches yet — fly and find one!</p>';
    return;
  }
  [...collection].reverse().forEach((c) => {
    const div = document.createElement("div");
    div.className = "catch-card";
    div.innerHTML = `
      <span class="dot" style="background:${c.color}"></span>
      <div>
        <strong>${c.name}</strong>
        <div class="meta">${RARITY_LABEL[c.rarity]} · ${c.altitude}ft · ${new Date(c.capturedAt).toLocaleDateString()}</div>
      </div>`;
    list.appendChild(div);
  });
}

function markerIcon(spawn, captured) {
  return L.divIcon({
    className: "",
    html: `<div class="spawn-pin ${captured ? "captured" : ""} rarity-${spawn.species.rarity}" style="--c:${spawn.species.color}"></div>`,
    iconSize: [28, 28],
  });
}

function refreshSpawns() {
  if (!playerLat) return;
  const spawns = getNearbySpawns(playerLat, playerLng);
  const captured = new Set(loadCollection().map((c) => c.uid));

  const seen = new Set();
  spawns.forEach((spawn) => {
    seen.add(spawn.uid);
    if (spawnMarkers.has(spawn.uid)) return;
    const marker = L.marker([spawn.lat, spawn.lng], {
      icon: markerIcon(spawn, captured.has(spawn.uid)),
    }).addTo(map);
    marker.on("click", () => openCapture(spawn));
    spawnMarkers.set(spawn.uid, marker);
  });

  // Remove markers that fell out of range.
  for (const [uid, marker] of spawnMarkers) {
    if (!seen.has(uid)) {
      map.removeLayer(marker);
      spawnMarkers.delete(uid);
    }
  }
}

function openCapture(spawn) {
  activeSpawn = spawn;
  const captured = loadCollection().some((c) => c.uid === spawn.uid);
  const modal = document.getElementById("capture-modal");
  document.getElementById("capture-name").textContent = spawn.species.name;
  document.getElementById("capture-rarity").textContent = RARITY_LABEL[spawn.species.rarity];
  document.getElementById("capture-rarity").className = `rarity-badge rarity-${spawn.species.rarity}`;
  document.getElementById("capture-alt-target").textContent = `${spawn.species.minAlt}–${spawn.species.maxAlt}ft`;
  document.getElementById("capture-status").textContent = captured
    ? "Already caught — you can still view it."
    : "Fly your drone to this spot, then enter the altitude shown on your controller.";
  document.getElementById("capture-alt-input").value = spawn.altitude;
  document.getElementById("capture-btn").disabled = captured;
  document.getElementById("capture-btn").textContent = captured ? "Caught ✓" : "Attempt Capture";
  updateDistanceReadout();
  modal.classList.add("open");
}

function closeCapture() {
  document.getElementById("capture-modal").classList.remove("open");
  activeSpawn = null;
}

function updateDistanceReadout() {
  if (!activeSpawn || !playerLat) return;
  const dist = haversineMeters(playerLat, playerLng, activeSpawn.lat, activeSpawn.lng);
  const readout = document.getElementById("capture-distance");
  readout.textContent = `${Math.round(dist)}m away`;
  readout.className = dist <= CAPTURE_RADIUS_M ? "in-range" : "";
}

function attemptCapture() {
  if (!activeSpawn) return;
  const dist = haversineMeters(playerLat, playerLng, activeSpawn.lat, activeSpawn.lng);
  const enteredAlt = parseInt(document.getElementById("capture-alt-input").value, 10);
  const status = document.getElementById("capture-status");

  if (dist > CAPTURE_RADIUS_M) {
    status.textContent = `Get within ${CAPTURE_RADIUS_M}m of the marker first (currently ${Math.round(dist)}m).`;
    return;
  }
  const { minAlt, maxAlt } = activeSpawn.species;
  if (enteredAlt < minAlt - ALT_TOLERANCE_FT || enteredAlt > maxAlt + ALT_TOLERANCE_FT) {
    status.textContent = `Fly your drone to ${minAlt}–${maxAlt}ft and try again.`;
    return;
  }

  saveCapture({
    uid: activeSpawn.uid,
    id: activeSpawn.species.id,
    name: activeSpawn.species.name,
    rarity: activeSpawn.species.rarity,
    color: activeSpawn.species.color,
    altitude: enteredAlt,
    capturedAt: Date.now(),
  });
  status.textContent = `Caught! ${activeSpawn.species.name} added to your collection.`;
  document.getElementById("capture-btn").disabled = true;
  document.getElementById("capture-btn").textContent = "Caught ✓";
  refreshSpawns();
  offerShare(activeSpawn);
}

function offerShare(spawn) {
  const text = `Just caught a ${RARITY_LABEL[spawn.species.rarity]} ${spawn.species.name} at ${document.getElementById("capture-alt-input").value}ft with my drone on Dragunfly! \u{1F409}\u{1F681} #DragunflyGame`;
  const shareBtn = document.getElementById("share-btn");
  shareBtn.style.display = "inline-block";
  shareBtn.onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = "Copied!";
      setTimeout(() => (shareBtn.textContent = "Share catch"), 1500);
    }
  };
}

function initMap(lat, lng) {
  map = L.map("map", { zoomControl: false }).setView([lat, lng], 17);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
  playerMarker = L.circleMarker([lat, lng], {
    radius: 8,
    color: "#0077b6",
    fillColor: "#48cae4",
    fillOpacity: 1,
  }).addTo(map);
  refreshSpawns();
}

function onPosition(pos) {
  playerLat = pos.coords.latitude;
  playerLng = pos.coords.longitude;
  document.getElementById("loading").style.display = "none";

  if (!map) {
    initMap(playerLat, playerLng);
  } else {
    playerMarker.setLatLng([playerLat, playerLng]);
  }
  refreshSpawns();
  updateDistanceReadout();
}

function onPositionError(err) {
  document.getElementById("loading").innerHTML = `
    <p>Location access is required to play.</p>
    <p class="meta">${err.message}</p>`;
}

function startLocationWatch() {
  if (!navigator.geolocation) {
    onPositionError({ message: "Geolocation not supported in this browser." });
    return;
  }
  navigator.geolocation.getCurrentPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
  });
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderCollection();
  startLocationWatch();
  document.getElementById("capture-close").addEventListener("click", closeCapture);
  document.getElementById("capture-btn").addEventListener("click", attemptCapture);
  document.getElementById("tab-map").addEventListener("click", () => switchTab("map"));
  document.getElementById("tab-collection").addEventListener("click", () => switchTab("collection"));
});

function switchTab(tab) {
  document.getElementById("view-map").classList.toggle("active", tab === "map");
  document.getElementById("view-collection").classList.toggle("active", tab === "collection");
  document.getElementById("tab-map").classList.toggle("active", tab === "map");
  document.getElementById("tab-collection").classList.toggle("active", tab === "collection");
  if (tab === "map" && map) setTimeout(() => map.invalidateSize(), 50);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
