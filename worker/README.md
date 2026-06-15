# WM-Ticker Proxy (Cloudflare Worker)

Caching-Proxy, der **football-data.org** (Plan + Ergebnisse) und **API-Football**
(Live-Minute + Live-Stand) zu einem `/api/matches`-Endpoint zusammenführt.

**Warum:** Der Edge-Cache entkoppelt die Upstream-Last von der Nutzerzahl — egal ob 1
oder 1 Mio. Leute die App offen haben, die APIs werden nur 1× pro Cache-Intervall
abgefragt. So bleibst du dauerhaft im Free-/Pro-Limit.

```
football-data.org ─┐
                   ├─►  dieser Worker (Edge-Cache)  ─►  /api/matches  ─►  alle Nutzer
API-Football ──────┘
```

## Schnellstart

### 0) Voraussetzung
Ein (kostenloser) Cloudflare-Account. Wrangler braucht keine lokale Installation —
`npx` lädt es bei Bedarf.

### 1) Sofort testen (Demo-Modus, ohne Keys)
```bash
cd worker
npx wrangler dev          # lokal -> http://localhost:8787/api/matches
```
Liefert Demo-Daten (`DEMO_MODE = "true"` in `wrangler.toml`). Damit kannst du die
ganze App-Kette schon end-to-end testen.

### 2) Deployen
```bash
npx wrangler login        # einmalig: Browser-Login
npx wrangler deploy
```
Danach bekommst du eine URL wie `https://wm-ticker.DEIN-NAME.workers.dev`.
→ Diese URL in `../app.js` bei `CONFIG.apiBase` eintragen.

### 3) Echte Daten aktivieren
API-Keys holen:
- **football-data.org** → kostenloses Token unter https://www.football-data.org/client/register
- **API-Football** → Key im Dashboard unter https://dashboard.api-football.com/ (Free-Plan: 100 Req/Tag; für das ganze Turnier ggf. Pro ~19 €/Mon.)

Secrets setzen (werden verschlüsselt bei Cloudflare gespeichert, nie im Code):
```bash
npx wrangler secret put FOOTBALL_DATA_KEY
npx wrangler secret put API_FOOTBALL_KEY
```
Dann in `wrangler.toml` `DEMO_MODE = "false"` setzen und erneut `npx wrangler deploy`.

> Nur ein Key vorhanden? Kein Problem:
> - nur `FOOTBALL_DATA_KEY` → Plan + Ergebnisse live, ohne Minuten-Ticker.
> - kein Key / `DEMO_MODE=true` → Demo-Daten.

## Caching-Verhalten
- Läuft ein Spiel → Cache 60 s (frischer Live-Stand).
- Sonst → Cache 600 s (Ergebnisse ändern sich kaum).
- Fällt eine API aus → letzter guter Stand bzw. Demo (kein Absturz).

## Endpoints
- `GET /api/matches` → `{ competition, groups, matches }` (exakt das App-Schema).
- `GET /api/match?fixture=ID` → `{ lineups:{home,away}, stats, events, predicted }`
  (Aufstellung mit Spieler-Fotos, Statistik & Verlauf für das Detail-Sheet).
  Cache 120 s. Ohne API-Football-Key / im Demo-Modus kommt `{ lineups: null }` —
  die App nutzt dann ihren eigenen, deterministischen Demo-Fallback.
- `GET /api/news?q=…&lang=de|en` → `{ items:[{title,link,source,published}] }`
  (Live-News via Google-News-RSS, **kein Key nötig**, Cache 600 s).

> Die `fixtureId` für `/api/match` stammt aktuell aus dem Live-Overlay (deckt also
> **laufende** Spiele ab). Für beendete/geplante Partien greift der App-seitige
> Demo-Fallback; volle ID-Zuordnung wäre ein optionaler Follow-up über den
> API-Football-`fixtures`-Endpoint.
