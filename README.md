# Dragunfly

A free, real-world game for real drone pilots. Original sky creatures spawn
at real GPS coordinates and altitude bands. Pilots fly their **actual**
drone to a spawn using their own controller's GPS/altitude readout, then
confirm the catch in-app.

Dragunfly never connects to a drone. It only ever reads the pilot's phone
location. That's a deliberate design choice, not a limitation:

- **No drone SDK / manufacturer approval** — no DJI/Autel developer
  partnership, nothing installed on the aircraft.
- **No app store review** — ships as an installable web app (PWA), so
  updates go live instantly and pilots can play the moment they open the link.
- **No third-party IP** — every creature is an original Dragunfly design.
- **No backend** — spawns are generated deterministically client-side from
  the player's GPS grid cell + the current date, so the same location shows
  the same creatures to everyone that day with zero server cost.

## Structure
- `index.html` — marketing landing page (share/link-in-bio entry point)
- `play.html` — the game itself (map, radar, territory, collection, data tabs)
- `js/creatures.js` — creature roster + deterministic spawn hashing
- `js/geo.js` — distance/bearing/grid math, spawn generation, VLOS-conscious distance cap
- `js/game.js` — map rendering (Leaflet), capture flow, safety gate, localStorage collection
- `js/territory.js` + `js/firebase-config.js` — Territory mode (needs one-time setup, see below)
- `manifest.json` / `sw.js` — PWA installability + offline app shell
- `docs/monetization.md` — revenue plan
- `docs/marketing-plan.md` — zero-budget growth plan
- `docs/social-templates.md` — ready-to-post launch copy
- `docs/territory-setup.md` — one-time free Firebase setup for Territory mode

## Running locally
This is a static site — no build step, no server required beyond a static
file server (needed because Service Workers require http/https, not
`file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Deploy target: any static host (GitHub Pages, Vercel, Netlify — all free
tiers). Location and altitude confirmation only work meaningfully in the
field with a phone, over HTTPS (required for the Geolocation API).

## Safety
Safety constraints are built into the game logic, not just stated in copy:
- Every in-game altitude target is capped at 400ft AGL (FAA Part 107 /
  recreational ceiling) — see `creatures.js`.
- Creature spawns are filtered to within ~180m of the player
  (`MAX_SPAWN_DISTANCE_M` in `geo.js`) so the game doesn't nudge pilots
  into flying further than they can keep their aircraft in unaided visual
  line of sight.
- First-time players see a mandatory "Fly Safe" checklist before playing
  (VLOS, no flying over people, daylight, airspace check via the FAA's
  free B4UFLY tool, FAA drone registration/Remote ID) — reachable anytime
  from the 🛡️ Fly Safe button in the header. See `openSafetyModal()` in
  `js/game.js`.
- The landing page carries the same checklist and links.

None of this replaces the pilot's own responsibility to follow FAA and
local law — it's guardrails against the game accidentally encouraging
something unsafe, not a compliance guarantee.

## Roadmap ideas (not yet built)
- Optional DJI Mobile SDK integration (still a free developer registration,
  not a partnership) for automatic altitude confirmation instead of manual entry.
- Sponsored location spawns (see `docs/monetization.md`).
- Real airspace-awareness (e.g. flagging spawns near FAA UAS Facility Map
  grids that need LAANC authorization) — would need a data integration,
  not yet built.
