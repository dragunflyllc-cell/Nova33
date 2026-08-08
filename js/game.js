// Dragunfly — main game logic. No drone integration: this only ever reads
// the pilot's own phone GPS. The pilot flies their real drone using their
// drone's own controller/app and self-confirms altitude here.

const CAPTURE_RADIUS_M = 30;
const ALT_TOLERANCE_FT = 25;
const STORAGE_KEY = "dragunfly_collection_v1";
const CONSENT_KEY = "dragunfly_data_consent_v1";
const CONTRIB_KEY = "dragunfly_contributions_v1";
const SAFETY_ACK_KEY = "dragunfly_safety_ack_v1";

let map, playerMarker, playerLat, playerLng;
const spawnMarkers = new Map();
let currentSpawns = [];
let activeSpawn = null;
let watchId = null;
let radarSpawn = null;
let orientationActive = false;

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
  currentSpawns = spawns;
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
  document.getElementById("share-btn").style.display = "none";
  document.getElementById("photo-btn").style.display = "none";
  document.getElementById("photo-btn").disabled = false;
  document.getElementById("photo-btn").textContent = "Add ground photo (optional)";
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
  fireConfetti(activeSpawn.species.color);
  if (isDataConsent()) {
    document.getElementById("photo-btn").style.display = "inline-block";
  }
}

function fireConfetti(color) {
  const layer = document.getElementById("confetti-layer");
  if (!layer) return;
  layer.innerHTML = "";
  const palette = [color, "#ffc93c", "#ff5f6d", "#35d0a1", "#5ec8ff"];
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = palette[i % palette.length];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    layer.appendChild(piece);
  }
}

// ---------- Data Contributor mode (opt-in, disclosed, nothing auto-shared) ----------
function isDataConsent() {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

function setDataConsent(value) {
  localStorage.setItem(CONSENT_KEY, value ? "true" : "false");
}

function loadContributions() {
  try {
    return JSON.parse(localStorage.getItem(CONTRIB_KEY)) || [];
  } catch {
    return [];
  }
}

function saveContribution(entry) {
  const list = loadContributions();
  list.push(entry);
  localStorage.setItem(CONTRIB_KEY, JSON.stringify(list));
  renderContributions();
}

function renderContributions() {
  const list = loadContributions();
  const countEl = document.getElementById("contrib-count");
  if (countEl) countEl.textContent = list.length;
  const listEl = document.getElementById("contrib-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  if (list.length === 0) {
    listEl.innerHTML = '<p class="empty">No ground photos yet.</p>';
    return;
  }
  [...list].reverse().forEach((c) => {
    const div = document.createElement("div");
    div.className = "catch-card";
    div.innerHTML = `
      <img src="${c.photo}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;flex-shrink:0">
      <div>
        <strong>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</strong>
        <div class="meta">${new Date(c.timestamp).toLocaleString()} · stored on this device only</div>
      </div>`;
    listEl.appendChild(div);
  });
}

function renderDataTab() {
  const toggle = document.getElementById("data-consent-toggle");
  if (toggle) toggle.checked = isDataConsent();
  renderContributions();
}

function handlePhotoSelected(file) {
  if (!file || !activeSpawn) return;
  const reader = new FileReader();
  reader.onload = () => {
    saveContribution({
      uid: activeSpawn.uid,
      lat: activeSpawn.lat,
      lng: activeSpawn.lng,
      timestamp: Date.now(),
      photo: reader.result,
    });
    document.getElementById("photo-btn").textContent = "Photo saved ✓";
    document.getElementById("photo-btn").disabled = true;
  };
  reader.readAsDataURL(file);
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

// Nearest not-yet-caught spawn, used by the radar/compass view.
function nearestUncapturedSpawn() {
  if (!playerLat) return null;
  const captured = new Set(loadCollection().map((c) => c.uid));
  let best = null;
  let bestDist = Infinity;
  for (const spawn of currentSpawns) {
    if (captured.has(spawn.uid)) continue;
    const dist = haversineMeters(playerLat, playerLng, spawn.lat, spawn.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = spawn;
    }
  }
  return best ? { spawn: best, dist: bestDist } : null;
}

function enterRadar() {
  const info = document.getElementById("radar-info");
  const captureBtn = document.getElementById("radar-capture-btn");
  const nearest = nearestUncapturedSpawn();
  radarSpawn = nearest ? nearest.spawn : null;
  captureBtn.style.display = "none";

  if (!radarSpawn) {
    info.textContent = "No creatures nearby right now — move around or check back tomorrow.";
    return;
  }
  info.textContent = "Point your phone flat and turn toward your drone.";
  captureBtn.onclick = () => {
    switchTab("map");
    openCapture(radarSpawn);
  };
  requestOrientationAccess();
}

function requestOrientationAccess() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    DOE.requestPermission()
      .then((state) => {
        if (state === "granted") attachOrientationListener();
        else document.getElementById("radar-info").textContent =
          "Compass access denied — enable motion & orientation access in your browser settings to use radar.";
      })
      .catch(() => {});
  } else {
    attachOrientationListener();
  }
}

function attachOrientationListener() {
  if (orientationActive) return;
  orientationActive = true;
  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);
}

function onOrientation(event) {
  if (!playerLat) return;
  let heading = event.webkitCompassHeading; // iOS Safari: already true-north, no reversal needed
  if (heading == null) {
    if (event.alpha == null) return;
    heading = (360 - event.alpha) % 360; // best-effort for browsers exposing raw alpha
  }
  if (radarSpawn && document.getElementById("view-radar").classList.contains("active")) {
    updateRadarUI(heading);
  }
  if (document.getElementById("view-live").classList.contains("active")) {
    updateArOverlay(heading);
  }
}

function updateRadarUI(heading) {
  const bearing = bearingDegrees(playerLat, playerLng, radarSpawn.lat, radarSpawn.lng);
  const relative = ((bearing - heading) + 360) % 360;
  document.getElementById("radar-arrow").style.transform = `rotate(${relative}deg)`;

  const dist = haversineMeters(playerLat, playerLng, radarSpawn.lat, radarSpawn.lng);
  document.getElementById("radar-info").textContent = `${radarSpawn.species.name} · ${Math.round(dist)}m away`;
  document.getElementById("radar-capture-btn").style.display = dist <= CAPTURE_RADIUS_M ? "block" : "none";
}

// ---------- Live AR mode: overlay creatures on the pilot's own YouTube ----------
// livestream (started from their drone's own app). Positioning is an
// approximation from phone compass heading, not real computer vision on
// the video — good enough for game feel, not precision AR.
const AR_FOV_DEG = 80;
const liveSprites = new Map();

function extractYouTubeId(input) {
  const trimmed = (input || "").trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:live\/|watch\?v=|embed\/))([\w-]{11})/);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

function startLive() {
  const input = document.getElementById("live-url-input").value;
  const id = extractYouTubeId(input);
  const status = document.getElementById("live-setup-status");
  if (!id) {
    status.textContent = "Couldn't find a video ID in that link — paste the full YouTube Live URL.";
    return;
  }
  document.getElementById("live-iframe").src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1`;
  document.getElementById("live-setup").style.display = "none";
  document.getElementById("live-stage").style.display = "block";
  requestOrientationAccess();
}

function endLive() {
  document.getElementById("live-iframe").src = "";
  document.getElementById("live-setup").style.display = "block";
  document.getElementById("live-stage").style.display = "none";
  document.getElementById("live-url-input").value = "";
  document.getElementById("live-setup-status").textContent = "";
  liveSprites.forEach((sprite) => sprite.remove());
  liveSprites.clear();
}

function updateArOverlay(heading) {
  const layer = document.getElementById("live-ar-layer");
  if (!layer || !playerLat) return;
  const captured = new Set(loadCollection().map((c) => c.uid));
  const half = AR_FOV_DEG / 2;
  const seen = new Set();

  currentSpawns.forEach((spawn) => {
    if (captured.has(spawn.uid)) return;
    const bearing = bearingDegrees(playerLat, playerLng, spawn.lat, spawn.lng);
    const relative = ((bearing - heading + 540) % 360) - 180; // -180..180
    if (Math.abs(relative) > half) {
      const existing = liveSprites.get(spawn.uid);
      if (existing) {
        existing.remove();
        liveSprites.delete(spawn.uid);
      }
      return;
    }
    seen.add(spawn.uid);

    const dist = haversineMeters(playerLat, playerLng, spawn.lat, spawn.lng);
    const xPct = 50 + (relative / half) * 46;
    const scale = Math.max(0.5, 1.3 - dist / MAX_SPAWN_DISTANCE_M);

    let sprite = liveSprites.get(spawn.uid);
    if (!sprite) {
      sprite = document.createElement("div");
      sprite.className = "ar-sprite";
      sprite.style.background = spawn.species.color;
      const topPct = 30 + (hashString(spawn.uid) % 400) / 10; // 30–70%, stable per creature
      sprite.style.top = `${topPct}%`;
      sprite.addEventListener("click", () => openCapture(spawn));
      layer.appendChild(sprite);
      liveSprites.set(spawn.uid, sprite);
    }
    sprite.style.left = `${xPct}%`;
    sprite.style.transform = `translate(-50%, -50%) scale(${scale})`;
    sprite.title = `${spawn.species.name} · ${Math.round(dist)}m`;
  });

  for (const [uid, sprite] of liveSprites) {
    if (!seen.has(uid)) {
      sprite.remove();
      liveSprites.delete(uid);
    }
  }
}

function enterTerritory() {
  const disabled = document.getElementById("territory-disabled");
  const panel = document.getElementById("territory-panel");
  if (!window.TERRITORY_ENABLED) {
    disabled.style.display = "flex";
    panel.style.display = "none";
    return;
  }
  disabled.style.display = "none";
  panel.style.display = "block";
  if (playerLat && window.Territory) {
    window.Territory.refreshTerritoryTiles(playerLat, playerLng);
    setTimeout(() => window.Territory.invalidateSize(), 50);
  }
}

async function attemptClaim() {
  if (!window.Territory || !playerLat) return;
  const status = document.getElementById("territory-status");
  status.textContent = "Claiming…";
  const result = await window.Territory.claimSelectedTile(playerLat, playerLng);
  status.textContent = result.ok ? "Claimed! It's yours." : result.reason;
}

// ---------- Fly Safe checklist gate ----------
function isSafetyAcked() {
  return localStorage.getItem(SAFETY_ACK_KEY) === "true";
}

function openSafetyModal() {
  const acked = isSafetyAcked();
  document.getElementById("safety-ack-checkbox").checked = acked;
  document.getElementById("safety-continue-btn").disabled = !acked;
  document.getElementById("safety-close").style.display = acked ? "inline-block" : "none";
  document.getElementById("safety-modal").classList.add("open");
}

function closeSafetyModal() {
  document.getElementById("safety-modal").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
  renderCollection();
  renderDataTab();
  startLocationWatch();
  if (window.Territory) window.Territory.initTerritory();

  if (isSafetyAcked()) closeSafetyModal();
  else openSafetyModal();
  document.getElementById("safety-ack-checkbox").addEventListener("change", (e) => {
    document.getElementById("safety-continue-btn").disabled = !e.target.checked;
  });
  document.getElementById("safety-continue-btn").addEventListener("click", () => {
    if (document.getElementById("safety-ack-checkbox").checked) {
      localStorage.setItem(SAFETY_ACK_KEY, "true");
    }
    closeSafetyModal();
  });
  document.getElementById("safety-close").addEventListener("click", closeSafetyModal);
  document.getElementById("safety-link").addEventListener("click", openSafetyModal);
  window.addEventListener("territory-tile-selected", (e) => {
    document.getElementById("territory-status").textContent =
      `Selected tile at ${e.detail.lat.toFixed(5)}, ${e.detail.lng.toFixed(5)} — fly your drone there and claim it.`;
  });
  document.getElementById("territory-claim-btn").addEventListener("click", attemptClaim);
  document.getElementById("tab-territory").addEventListener("click", () => switchTab("territory"));
  document.getElementById("capture-close").addEventListener("click", closeCapture);
  document.getElementById("capture-btn").addEventListener("click", attemptCapture);
  document.getElementById("tab-map").addEventListener("click", () => switchTab("map"));
  document.getElementById("tab-radar").addEventListener("click", () => switchTab("radar"));
  document.getElementById("tab-live").addEventListener("click", () => switchTab("live"));
  document.getElementById("live-start-btn").addEventListener("click", startLive);
  document.getElementById("live-end-btn").addEventListener("click", endLive);
  document.getElementById("tab-collection").addEventListener("click", () => switchTab("collection"));
  document.getElementById("tab-data").addEventListener("click", () => switchTab("data"));
  document.getElementById("data-consent-toggle").addEventListener("change", (e) => {
    setDataConsent(e.target.checked);
  });
  document.getElementById("photo-btn").addEventListener("click", () => {
    document.getElementById("photo-input").click();
  });
  document.getElementById("photo-input").addEventListener("change", (e) => {
    handlePhotoSelected(e.target.files[0]);
  });
});

function switchTab(tab) {
  ["map", "radar", "live", "territory", "collection", "data"].forEach((t) => {
    document.getElementById(`view-${t}`).classList.toggle("active", t === tab);
    document.getElementById(`tab-${t}`).classList.toggle("active", t === tab);
  });
  if (tab === "map" && map) setTimeout(() => map.invalidateSize(), 50);
  if (tab === "radar") enterRadar();
  if (tab === "territory") enterTerritory();
  if (tab === "data") renderDataTab();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
