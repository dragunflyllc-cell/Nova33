// Dragunfly — Territory mode: claim real-world tiles by flying your drone
// over them. Needs a shared backend (Firebase Firestore) since ownership
// has to be visible to every pilot, not just generated locally like the
// creature spawns are.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const TERRITORY_GRID_DEG = 0.003; // ~330m tiles
const TERRITORY_VIEW_RADIUS = 2; // 5x5 tiles around the player
const CLAIM_RADIUS_M = 60;
const NICK_KEY = "dragunfly_nickname";

let db, auth, uid;
let territoryMap;
let ready = false;
const tileRects = new Map();
const tileUnsub = new Map();
let selected = null; // { id, lat, lng }

function getNickname() {
  let name = localStorage.getItem(NICK_KEY);
  if (!name) {
    name = "Pilot" + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem(NICK_KEY, name);
  }
  return name;
}

function tileIndex(lat, lng) {
  return { latIdx: Math.floor(lat / TERRITORY_GRID_DEG), lngIdx: Math.floor(lng / TERRITORY_GRID_DEG) };
}

function tileId(latIdx, lngIdx) {
  return `t_${latIdx}_${lngIdx}`;
}

function tileBounds(latIdx, lngIdx) {
  const south = latIdx * TERRITORY_GRID_DEG;
  const west = lngIdx * TERRITORY_GRID_DEG;
  return [[south, west], [south + TERRITORY_GRID_DEG, west + TERRITORY_GRID_DEG]];
}

function tileCenter(latIdx, lngIdx) {
  return {
    lat: latIdx * TERRITORY_GRID_DEG + TERRITORY_GRID_DEG / 2,
    lng: lngIdx * TERRITORY_GRID_DEG + TERRITORY_GRID_DEG / 2,
  };
}

async function initTerritory() {
  if (!window.TERRITORY_ENABLED) return;
  const app = initializeApp(window.FIREBASE_CONFIG);
  db = getFirestore(app);
  auth = getAuth(app);
  await new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        uid = user.uid;
        ready = true;
        resolve();
      }
    });
    signInAnonymously(auth).catch(() => resolve());
  });
}

function ensureMap(lat, lng) {
  if (territoryMap) return;
  territoryMap = L.map("territory-map", { zoomControl: false }).setView([lat, lng], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(territoryMap);
}

function subscribeTile(id, rect, latIdx, lngIdx) {
  if (tileUnsub.has(id) || !db) return;
  const unsub = onSnapshot(doc(db, "territories", id), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const isMine = data.ownerId === uid;
      rect.setStyle({
        color: isMine ? "#35d0a1" : "#ff5f6d",
        fillColor: isMine ? "#35d0a1" : "#ff5f6d",
        fillOpacity: 0.4,
        weight: 2,
      });
      rect.unbindTooltip();
      rect.bindTooltip(`${data.ownerName}'s territory`, { sticky: true });
    } else {
      rect.setStyle({ color: "#ffffff44", fillColor: "#ffffff11", fillOpacity: 0.25, weight: 1 });
      rect.unbindTooltip();
    }
  });
  tileUnsub.set(id, unsub);
}

export function refreshTerritoryTiles(lat, lng) {
  if (!window.TERRITORY_ENABLED) return;
  ensureMap(lat, lng);
  const { latIdx: cLat, lngIdx: cLng } = tileIndex(lat, lng);
  for (let dLat = -TERRITORY_VIEW_RADIUS; dLat <= TERRITORY_VIEW_RADIUS; dLat++) {
    for (let dLng = -TERRITORY_VIEW_RADIUS; dLng <= TERRITORY_VIEW_RADIUS; dLng++) {
      const latIdx = cLat + dLat;
      const lngIdx = cLng + dLng;
      const id = tileId(latIdx, lngIdx);
      if (tileRects.has(id)) continue;
      const rect = L.rectangle(tileBounds(latIdx, lngIdx), {
        color: "#ffffff44", weight: 1, fillColor: "#ffffff11", fillOpacity: 0.25,
      }).addTo(territoryMap);
      rect.on("click", () => selectTile(latIdx, lngIdx));
      tileRects.set(id, rect);
      subscribeTile(id, rect, latIdx, lngIdx);
    }
  }
}

function selectTile(latIdx, lngIdx) {
  const center = tileCenter(latIdx, lngIdx);
  selected = { id: tileId(latIdx, lngIdx), lat: center.lat, lng: center.lng };
  window.dispatchEvent(new CustomEvent("territory-tile-selected", { detail: selected }));
}

export async function claimSelectedTile(playerLat, playerLng) {
  if (!window.TERRITORY_ENABLED) return { ok: false, reason: "Territory mode isn't set up yet — see docs/territory-setup.md." };
  if (!ready) return { ok: false, reason: "Still connecting — try again in a moment." };
  if (!selected) return { ok: false, reason: "Tap a tile on the map first." };
  const dist = haversineMeters(playerLat, playerLng, selected.lat, selected.lng);
  if (dist > CLAIM_RADIUS_M) {
    return { ok: false, reason: `Fly your drone within ${CLAIM_RADIUS_M}m of the tile center (currently ${Math.round(dist)}m).` };
  }
  const ref = doc(db, "territories", selected.id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return { ok: false, reason: `Already claimed by ${existing.data().ownerName}.` };
  }
  try {
    await setDoc(ref, {
      ownerId: uid,
      ownerName: getNickname(),
      lat: selected.lat,
      lng: selected.lng,
      claimedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "Someone just claimed this tile first — try another." };
  }
}

export function getSelectedTile() {
  return selected;
}

export function invalidateSize() {
  if (territoryMap) territoryMap.invalidateSize();
}

export { initTerritory, getNickname };
window.Territory = {
  initTerritory, refreshTerritoryTiles, claimSelectedTile, getSelectedTile, getNickname, invalidateSize,
};
