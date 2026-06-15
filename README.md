# WM 2026 · Lauf-Challenge 🏃⚽️

Mobile-first PWA zur Fitness-Challenge während der Fußball-WM 2026.

> **Die Regel:** Für jedes bei der WM geschossene Tor läufst du **1 km**.

> 📍 **Produktrichtung:** Vision, Roadmap & Setup liegen in [`docs/`](docs/) –
> [`PRODUCT_VISION.md`](docs/PRODUCT_VISION.md), [`ROADMAP.md`](docs/ROADMAP.md),
> [`SETUP_SUPABASE.md`](docs/SETUP_SUPABASE.md).
>
> **Neu in v1.1 (Phase 1+2):** Rang/Liga & „Top X %"-Einordnung, Wochenziel,
> Läufe nachträglich bearbeiten (Distanz/Datum/Zeit), Welcome-/Onboarding-Screen
> (Challenge- vs. Info-Modus), Einstellungen (Sprache nach Handy, Theme, Einheit,
> Challenge an/aus), ziehbares Spiel-Detail-Sheet, i18n (DE/EN).
>
> **Neu in v1.2 (Phase 3):** Spiel-Detail-Sheet mit Sub-Tabs **Aufstellung ·
> Statistik · Verlauf · Info** – visuelle Aufstellung auf dem Platz mit runden
> Spieler-Avataren (Live-Foto / Initialen-Fallback), Statistiken (Ballbesitz, Schüsse,
> Pässe …) und Tor-/Event-Verlauf. Live über den Worker-Endpoint
> `GET /api/match?fixture=ID`, sonst deterministische Demo-Daten (offline-fähig).
>
> **Neu in v1.3 (UI/UX-Redesign):** Hybrid-Look (heller, cleaner Body + immersive
> Hero-Cards). Aufgeräumte Informationsarchitektur: **Challenge mit Sub-Tabs**
> (Fortschritt/Verlauf/Erfolge), **Filter-Chips** auf Spielplan (Alle/Live/Heute/
> Kommend/Beendet) und **Gruppen-Chips** in der Tabelle, Home als Dashboard
> (Top-3-Torschützen statt Top-10), konsistente Sektions-Titel & durchgängigere
> DE/EN-Übersetzung. Kein Endlos-Scroll mehr.
>
> **Neu in v1.4 (Phase 4 – Login & Cloud-Sync):** Optionales **Supabase**-Backend.
> Login/Registrieren/Magic-Link/Passwort-Reset (Einstellungen → Konto), geräte­
> übergreifender **Sync** von Läufen & Einstellungen (offline-first, RLS-gesichert).
> **Ruhend, bis `CONFIG.supabase` (URL + anon-Key) gesetzt ist** → ohne Setup läuft
> die App unverändert rein lokal. Anleitung: [`docs/SETUP_SUPABASE.md`](docs/SETUP_SUPABASE.md).

## Features

**Screen 1 — Live-Ticker**
- Voller Turnierumfang: 12 Gruppen, 48 Teams, kompletter Spielplan (beendet / live / geplant)
- Umschaltbar **Spielplan ⇄ Live-Tabellen** (Tabellen live aus den Ergebnissen berechnet)
- **Torschützenliste** (live via Worker, Demo-Daten eingebaut)
- Globaler Tor-Zähler (= Soll-Kilometer der Challenge) mit Live-Badge
- Live-Status mit pulsierender Anzeige, Auto-Aktualisierung im Hintergrund

**Screen 2 — Lauf-Challenge**
- Apple-Watch-Style-Fortschrittsring (Soll vs. Ist vs. offen) mit animiertem Count-up
- Spiel-Filter: einzelne Partien per Toggle ausnehmen → deren Tore werden sofort vom Soll abgezogen
- Kilometer-Tracker: Eingabefeld, +/−-Buttons und Quick-Adds (0,5 / 1 / 3 / 5 km)
- **Feier-Feedback** beim Eintragen: Konfetti, Haptik, aufsteigendes „+X km", Meilenstein-Overlays
- **Lauf-Historie** mit Datum (löschbar) + **Burndown-Chart** (Soll- vs. Ist-Linie)
- **Streak** (Tage in Folge) & freischaltbare **Badges/Erfolge**
- **Virtuelle WM-Reise**: deine km als Strecke durch die Gastgeberstädte 🇲🇽🇺🇸🇨🇦

## Tech-Stack

- **Vanilla JS + Tailwind CSS (CDN)** — kein Build-Step, läuft direkt im Browser
- **PWA** — `manifest.webmanifest` + Service Worker (`sw.js`), installierbar & offline-fähig
- **State** persistiert im `localStorage` (gelaufene km, ausgenommene Spiele, Tab, Theme)
- **Light/Dark-Mode** (folgt dem System, manuell umschaltbar)

## Starten

Ein lokaler Webserver ist nötig (Service Worker funktioniert nicht über `file://`):

```bash
# eine der Varianten
npx serve .
python3 -m http.server 8080
```

Dann `http://localhost:8080` (bzw. den angezeigten Port) am Smartphone oder in der
Responsive-Ansicht der Dev-Tools öffnen.

> Standardmäßig läuft die App mit eingebauten **Demo-Daten** — kein Server, kein Key nötig.

## Als App installieren (Homescreen)

Die App ist eine echte PWA und läuft nach der Installation im Vollbild, fast wie nativ:

- **iPhone (Safari):** Teilen-Symbol → **„Zum Home-Bildschirm"**. Die App zeigt dazu
  automatisch einen Hinweis.
- **Android (Chrome):** Es erscheint ein **„Installieren"**-Banner (bzw. Menü → „App
  installieren"). Ein Tippen genügt.

Voraussetzung: Aufruf über **HTTPS** (oder `localhost`). Beim ersten Online-Besuch werden
App-Shell + Icons gecacht → danach auch **offline** lauffähig.

## Live-Daten anbinden (gemischte APIs + Cache)

Damit die Daten echt live sind und das API-Limit **auch bei vielen Nutzern** nie reißt,
liegt ein **Caching-Proxy** als Cloudflare Worker bei (`/worker`). Er mischt zwei Quellen
und cacht das Ergebnis am Edge → die Upstream-Last ist **unabhängig von der Nutzerzahl**:

```
football-data.org  (Plan + Ergebnisse) ─┐
                                         ├─►  Worker (Edge-Cache)  ─►  /api/matches  ─►  App
API-Football       (Live-Minute/-Stand) ─┘
```

**Aktivieren:**
1. Worker deployen — Anleitung in [`worker/README.md`](worker/README.md)
   (läuft im Demo-Modus sofort, echte Daten via 2 API-Keys).
2. Die Worker-URL in `app.js` bei `CONFIG.apiBase` eintragen, z. B.
   `apiBase: 'https://wm-ticker.dein-name.workers.dev'`.

Danach holt die App live aus dem Worker (Polling: schnell wenn ein Spiel läuft, sonst
träge; pausiert bei verstecktem Tab). Ist `apiBase` leer oder der Worker nicht erreichbar,
fällt die App automatisch auf die Demo-Daten zurück — sie funktioniert also immer.

## Projektstruktur

```
index.html             App-Shell, Header, Bottom-Nav, Tailwind-Config
app.js                 Daten, State, Selektoren, Rendering, Live-Polling, Install
manifest.webmanifest   PWA-Metadaten (Icons, Standalone-Display)
sw.js                  Service Worker (Offline-Cache + Network-first für API)
icon.svg               Quell-Icon (Vektor)
icons/                 Gerenderte PNG-Icons (180/192/512/1024) für iOS & Android
worker/                Cloudflare Worker: mischt & cacht football-data + API-Football
  ├─ worker.js
  ├─ wrangler.toml
  └─ README.md         Deploy-Anleitung
```
