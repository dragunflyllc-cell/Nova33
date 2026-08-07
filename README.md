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
- `play.html` — the game itself (map, capture flow, collection)
- `js/creatures.js` — creature roster + deterministic spawn hashing
- `js/geo.js` — distance/bearing/grid math, spawn generation
- `js/game.js` — map rendering (Leaflet), capture flow, localStorage collection
- `manifest.json` / `sw.js` — PWA installability + offline app shell
- `docs/monetization.md` — revenue plan
- `docs/marketing-plan.md` — zero-budget growth plan
- `docs/social-templates.md` — ready-to-post launch copy

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
Dragunfly caps every in-game altitude target at 400ft AGL to align with
typical FAA Part 107 / recreational limits, and the landing page carries an
explicit reminder that pilots are responsible for flying legally and safely
regardless of what the game shows.

## Roadmap ideas (not yet built)
- Compass/AR overlay using `DeviceOrientationEvent` to point pilots toward
  the nearest spawn.
- Optional DJI Mobile SDK integration (still a free developer registration,
  not a partnership) for automatic altitude confirmation instead of manual entry.
- Sponsored location spawns (see `docs/monetization.md`).
