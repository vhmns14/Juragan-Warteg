<div align="center">

**English** · [Bahasa Indonesia](README.id.md)

# Juragan Warteg

**Grow a humble food cart into a nationwide warteg franchise, in a cozy pixel-art tycoon you can play in the browser.**

[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Phaser](https://img.shields.io/badge/Phaser-4.2.1-8A2BE2)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](#installing-as-an-app)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Live demo](https://img.shields.io/badge/play-live%20demo-e8762b)](https://juraganwarteg.kodekecil.my.id)

### [▶ Play now](https://juraganwarteg.kodekecil.my.id)

<img src="docs/screenshots/hero-progression.jpg" alt="The six warteg stages side by side, from a street food cart to a two-floor restaurant, plus the national franchise map" width="100%">

</div>

## About

Juragan Warteg is a Kairosoft-style management game about running a *warteg*, the humble Indonesian rice-and-sides eatery. You start with a gerobak (food cart) at the edge of the market and grow through six stages: Warteg Kecil, Warteg, Warteg Besar, Rumah Makan and finally a two-floor Restoran Besar. Then open branches across town, launch a franchise with your own brand, and put outlets in eight cities.

A full career lasts ten in-game years and ends with a title based on how you played, then you can keep going in free play. The UI is in casual Indonesian. Every business, app and brand name in the game is fictional.

## Screenshots

<table>
  <tr>
    <td colspan="2"><img src="docs/screenshots/desktop-rumah-makan.jpg" alt="Rumah Makan stage on desktop, with side panels and a busy dining room"></td>
    <td colspan="2"><img src="docs/screenshots/desktop-restoran-lantai2.jpg" alt="Second floor of the Restoran Besar with the VIP room"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/phone-title.jpg" alt="Title screen on a phone"></td>
    <td><img src="docs/screenshots/phone-warteg.jpg" alt="A warteg during the lunch rush on a phone"></td>
    <td><img src="docs/screenshots/phone-restoran-besar.jpg" alt="The Restoran Besar on a phone"></td>
    <td><img src="docs/screenshots/phone-peta-nasional.jpg" alt="National franchise map on a phone"></td>
  </tr>
</table>

## Features

- **A day that feels like a real warteg.** Shop at the market at dawn, cook the day's dishes into the glass display case, then survive breakfast, the *Jam Makan Siang* lunch rush and dinner. Customers queue, pick their sides, sit or take away, and leave angry if the wait is too long or a dish runs out.
- **Six rooms that actually grow.** Each stage is built procedurally from one layout: wider frontage, longer counter, more kitchen, tables and queue space. The Restoran Besar has two floors, a VIP room and a parking lot.
- **Cooking and shopping.** Plan portions for up to 32 dishes, manage rice, kitchen capacity and leftovers. Eight-plus ingredients with weekly price swings (chili spikes in the rainy season, eggs and meat before Lebaran), spoilage and storage limits.
- **Customers with their own wallets.** Laborers, students, office workers, ojol drivers, foremen and housewives, each with a budget, patience and food likes. Purchasing power follows the month: *tanggal tua* versus payday, with an optional tab (*kasbon*) policy.
- **Food delivery apps.** Two fictional apps with fees, commissions, promos, store ratings and drivers walking in to pick up orders.
- **Staff with personalities.** Cooks, head chef, cashiers, waiters, a market runner and managers, with skills, levels and traits. Training, raises, days off, THR before Lebaran, poaching by rivals and a bit of workplace drama.
- **Research and combos.** Unlock recipes and techniques, and discover hidden three-dish meal packages.
- **Branches and a national franchise.** Eight town locations with their own customer mix, then a brand with outlets in city centers, malls and airports across eight cities.
- **A living neighborhood.** Weather, Ramadan and Lebaran, health inspections, food vloggers, catering orders, regular customers with story arcs, a warteg cat, street buskers, a radio with original chiptune dangdut, and three quick cooking mini-games.
- **Ten-year career with branching endings,** 62 achievements, a guided tutorial, and save backups you can export as a file or a code.
- **Plays anywhere.** Responsive layout for phones and wide screens, installable as a PWA and playable offline.

## How to play

1. **Morning:** check the *Masak* (cook) plan and the *Belanja* (shop) prices. Cook enough of what your customers like, without too many leftovers.
2. **Service:** watch the queue during the lunch rush. Hire and train staff so the counter keeps up.
3. **Evening:** read the daily report and reviews, then adjust prices, promos and the menu.
4. **Grow:** spend money, stars and fans on renovations, decorations and research. Open branches from the *Peta* (map), then build your franchise.
5. **Stay solvent:** going deep into debt for three month-starts in a row means bankruptcy.

The tutorial walks you through the first day. You can replay it from *Menu*.

## Controls

| Action | Desktop | Phone |
|---|---|---|
| Zoom | Mouse wheel | Pinch |
| Pan | Drag, arrow keys or WASD | Drag |
| Pause / resume | Space | Speed buttons |
| Close dialog | Esc | ✕ button |
| Everything else | Click the bottom bar and side panels | Tap the bottom bar and dock tabs |

## Tech stack

- [Phaser 4](https://phaser.io/) for rendering, input and scenes
- [TypeScript 7](https://www.typescriptlang.org/) in strict mode, type-checked with `tsc --noEmit`
- [Vite 8](https://vite.dev/) with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (offline precache, manifest) and [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) for a one-file build
- WebAudio synthesis for all music and sound effects, no audio files
- [Playwright](https://playwright.dev/) for end-to-end, responsive, movement and soak tests
- Python (Pillow, NumPy, SciPy) for the sprite pipeline
- Fonts: Pixelify Sans, Silkscreen and Baloo 2 via Fontsource

## Project structure

```
juragan-warteg/
├── index.html
├── public/              # _headers (CSP and caching), PWA icons
├── src/
│   ├── main.ts          # boot, responsive scaling
│   ├── scenes/          # Boot, Title, Game
│   ├── sim.ts           # pure simulation (no Phaser): days, customers, money, events
│   ├── sim3.ts systems.ts   # later systems: roles, prasmanan, franchise, tax, katering...
│   ├── data*.ts         # dishes, ingredients, customers, stages, cities, endings
│   ├── layout.ts room.ts world.ts backdrop.ts   # procedural rooms, pathfinding, street
│   ├── screens*.ts sidepanel.ts ui.ts tutorial.ts   # dialogs and UI kit
│   ├── state.ts sanitize.ts backup.ts           # save format, migration, backup import/export
│   ├── audio.ts         # WebAudio sequencer and SFX
│   └── assets/          # sprite sheets
├── tools/               # e2e and screenshot scripts, balance bot, asset pipeline, deploy helpers
├── vite.config.ts       # PWA build
├── vite.single.config.ts    # single-file build
└── wrangler.embed.jsonc # Cloudflare Worker config
```

## Getting started

Requires Node.js 20.19 or newer.

```bash
git clone https://github.com/vhmns14/juragan-warteg.git
cd juragan-warteg
npm install
npm run dev          # local dev server with hot reload
npm run typecheck    # strict TypeScript check
npm run build        # production PWA build into dist/
npm run preview      # serve the production build
npm run build:single # whole game in one HTML file, in dist-single/
```

### Tests

The tests drive the real game in headless Chromium, so build first and install a browser once:

```bash
npx playwright install chromium
npm run build
npm run test:e2e     # full playthrough with screenshots in shots/
npm run test:resp    # layouts at phone, laptop and desktop sizes
npm run test:walk    # character movement checks
npm run test:soak    # a bot plays 10 in-game years
npm run balance      # headless balance simulation on the pure sim
```

## Deployment

`npm run build` produces a static site in `dist/` with a relative base path, so it works on any static host or sub-path (Cloudflare, Netlify, GitHub Pages, your own server). `public/_headers` carries a strict Content Security Policy and cache rules for hosts that read it.

**Cloudflare Workers (static assets):**

```bash
npm run build
npx wrangler deploy --assets dist --name juragan-warteg --compatibility-date 2026-10-01
```

**Cloudflare Workers (single embedded script),** as used for the live site. Edit `wrangler.embed.jsonc` with your own account and route first:

```bash
npm run build
npm run embed        # writes deploy-embed/worker.js
npx wrangler deploy -c wrangler.embed.jsonc
```

### Installing as an app

Open the game in Chrome, Edge or Safari and choose *Install* or *Add to Home Screen*. After the first load it works offline.

## Roadmap and known limitations

- The UI is Indonesian only. An English translation is not planned yet.
- Saves live in the browser's localStorage. Clearing site data deletes them, so use *Backup Save* to keep a copy.
- Balance is tuned with bots. Real players may find some stages faster or slower than intended; feedback is welcome.
- The test suite needs a local Chromium through Playwright and is not wired to CI yet.
- Ideas for later: more cities and outlet types, more regular-customer stories, controller support.

## License

[MIT](LICENSE) © 2026 vahmi sofyan. Made by KodeKecil.
