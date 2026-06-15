# CLAUDE.md — Projekt-Leitfaden (WM 2026 Lauf-Challenge)

> Diese Datei ist die Orientierung für jede neue Claude-Instanz. Sie erklärt, **was wo
> liegt**, **wie man etwas ändert/hinzufügt**, woher die **echten Daten** kommen und wie
> **deployt** wird. UI-Sprache ist Deutsch; Antworten an den Nutzer auf Deutsch.

## 1. Was ist das?
Mobile-first **PWA**: WM-2026-Live-Ticker **+** Fitness-Challenge („pro WM-Tor läufst du 1 km")
**+** Community-Ranking. Kern-USP: das Turnier gemeinsam „nachlaufen" und sich messen.

- **Kein Build-Step.** Vanilla JS + Tailwind via CDN. Direkt im Browser lauffähig.
- **Alle angezeigten Daten sind echt** (kein Demo/Synthetik mehr in der UI).
- Live: https://wm-tracking-challenge.pages.dev · Worker-API: https://wm-ticker.manuel-fades50.workers.dev

## 2. Dateistruktur (was wo)
```
index.html          App-Shell: <head>, Tailwind-Config, ALLE CSS (<style>), Header, Bottom-Nav.
                    → Hier: Schriften, Farben, .glass-card/.seg/.chip/.grabber/.cv, Animationen, Header-Logo.
app.js  (~groß)     Die gesamte App-Logik (s. Abschnitt 4 für den inneren Aufbau).
sw.js               Service Worker: App-Shell-Cache + Strategie. CACHE-Version + ASSETS-Liste.
manifest.webmanifest PWA-Metadaten (Name, Icons, Standalone).
icons/              App-Icons (icon-180/192/512/1024.png) + wm2026-logo.png (Header/Onboarding).
icon.svg            Vektor-Quell-Icon.
worker/worker.js    Cloudflare Worker = Daten-Proxy/Cache (football-data + ESPN + News).
worker/wrangler.toml Worker-Config (name=wm-ticker, vars DEMO_MODE, AF_ENABLE).
worker/.dev.vars    LOKALE Secrets — NICHT committen (in .gitignore).
docs/               PRODUCT_VISION.md, ROADMAP.md, SETUP_SUPABASE.md (Supabase-Klickanleitung + SQL).
ui-inspo/           Design-Vorlagen + wm2026-logo.jpg (Logo-Quelle).
public/             NUR Deploy-Artefakt (gitignored). Wird vor jedem Pages-Deploy neu befüllt.
```

## 3. Datenquellen (gemischt — so viele echte Daten wie möglich)
| Daten | Quelle | Wo im Code |
|---|---|---|
| Spielplan, Ergebnis, Gruppen/Tabellen, Torschützen | **football-data.org** (Key) | worker `fetchBase`, `fetchScorers` |
| Halbzeitstand, Schiedsrichter, Stadion | **football-data** Match-Detail | worker `fetchMatchInfo` → `/api/matchinfo` |
| **Live-Minute + Live-Stand**, Aufstellung, Statistik, Tor-/Karten-/Wechsel-Verlauf | **ESPN** (öffentliche JSON-API, KEIN Key) | worker `espnLive`/`mergeEspn`, `fetchEspnDetail` → `/api/detail` |
| News | Google News RSS, optional **GNews** (Key→Foto+Intro) | worker `fetchNews`/`fetchGNews` → `/api/news` |
| Login, Lauf-/Settings-Sync, Community-Ranking | **Supabase** | app.js Abschnitt „AUTH & CLOUD-SYNC" |

**Wichtig/gelernt:**
- **ESPN** ist die Live-Quelle (gratis, ohne Credits, deckt WM 2026 voll ab). Sofascore=403
  (Bot-Schutz), Flashscore=fragil/ToS → **nicht** nutzen.
- **API-Football** Free-Plan **sperrt Saison 2026** → deaktiviert (`AF_ENABLE` aus). Code bleibt
  als Zukunftsoption (bezahlter Plan) erhalten, wird aber nicht aufgerufen.
- ESPNs API ist **inoffiziell** → bei Ausfall fällt das Detail-Sheet automatisch auf Info+News
  zurück. Team-Namen-Matching football-data↔ESPN: `teamKey`/`nameMatch` (akzent-/füllworttolerant).

## 4. app.js — innerer Aufbau (Reihenfolge im File)
1. **CONFIG** — `apiBase` (Worker-URL), Poll-Intervalle, **`supabase:{url,anonKey}`** (leer = Login aus).
2. **MOCK_DATA** — Fallback, falls Worker nicht erreichbar.
3. **LS / load/save / Settings / i18n** — `I18N.de/en` + `t('key', vars)`; `getLang()`, `applyNav()`.
4. **state** — `{data, tab, runs, settings, auth, community, news, …}`. `persist()` schreibt LS.
5. **Selektoren** — `team()`, `sollKm()`, `totalRan()`, `computeStandings()`, `streakDays()` …
6. **Gamification** — `LEAGUES`, `leagueFor()`, `RANK_ART`/`rankBadge()`, `topPercent()`, `weeklyKm()`.
7. **Helfer** — `fmtKm/fmtDist/fmtDistU` (Einheiten), `crest()` (Wappen), `esc()` (XSS-Schutz).
8. **UI-Bausteine** — `segTabs()`, `chipRow()`, `sectionTitle()`, **`ICONS`/`ic(name)`**, `evIcon()`.
9. **Views** — `viewToday`, `viewSchedule` (Status-Chips), `viewTable` (Gruppen-Chips), `viewChallenge`
   (Sub-Tabs `chProgress`/`chHistory`/`chAchievements`), `viewSettings`.
10. **Spiel-Detail-Sheet** — `loadDetail`/`loadMatchInfo`/`loadMatchNews`, `renderSheetContent` (Tabs
    Aufstellung/Statistik/Verlauf/Info), `renderLineupTab` (Trikots+Namen, `kitColor`/`NAT_COLOR`),
    `renderStatsTab`, `renderEventsTab`, `openMatchSheet`, `closeSheet`, `makeSheetDraggable` (Flick).
11. **Aktionen** — EIN globaler `document.addEventListener('click', …)` mit `switch(data-action)`.
    Neue Buttons brauchen `data-action="…"` + einen `case`.
12. **Theme / Polling / Install / Auth+Cloud / Onboarding / init()** (am Ende, IIFE).

## 5. „Wie ändere/füge ich X hinzu?" — Rezepte
- **Text/Übersetzung:** Key in `I18N.de` **und** `I18N.en` ergänzen → im Markup `${t('key')}`.
- **Icon:** Pfad in `ICONS` ergänzen → `${ic('name','w-5 h-5')}` (currentColor, erbt Textfarbe).
- **Neuer Button/Interaktion:** Markup mit `data-action="x"` → `case 'x':` im Click-Handler.
- **Neuer Screen/Tab:** Nav-Button in `index.html` + `render()` `VIEWS`/`TITLES` + ggf. `applyNav`.
- **Neues Daten-Feld pro Spiel:** worker `fetchBase` (football-data) bzw. `mergeEspn` (ESPN) →
  Feld landet in `/api/matches`; in der passenden View rendern.
- **Spiel-Detail erweitern:** worker `fetchEspnDetail` (Mapping aus ESPN-Summary) + `renderLineupTab`/
  `renderStatsTab`/`renderEventsTab`.
- **Logo/App-Icons ändern:** Quelle in `ui-inspo/`, mit `sips` skalieren →
  `sips -s format png -Z 320 quelle.jpg --out icons/wm2026-logo.png` und
  `sips -s format png -z 192 192 quelle.jpg --out icons/icon-192.png` (180/512/1024 analog).
- **Echte Daten nur, kein Fake:** keine synthetischen Werte in die UI; fehlt eine Quelle → Element
  ausblenden (so wie das Detail-Sheet ohne ESPN nur Info+News zeigt).

## 6. Versionierung & Deployment (IMMER beides!)
Bei **jeder** Auslieferung:
1. `APP_VERSION` in `app.js` hochzählen **und** `CACHE` in `sw.js` (`wm-challenge-vN`) — sonst sehen
   PWA-Nutzer die Änderung nicht.
2. **Frontend (Cloudflare Pages):**
   ```
   rm -rf public && mkdir -p public
   cp index.html app.js sw.js manifest.webmanifest icon.svg public/ && cp -r icons public/
   npx wrangler pages deploy public --project-name wm-tracking-challenge --branch main --commit-dirty=true
   ```
   `public/` enthält **nur** statische Dateien — niemals `worker/` (Secrets!).
3. **Worker (nur bei worker/-Änderungen):** `cd worker && npx wrangler deploy`
   (Wrangler ist bei Cloudflare angemeldet; `npx wrangler whoami` prüft).
4. **GitHub:** committen + pushen. Commit-Trailer:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
5. Verifizieren: `curl -s …pages.dev/app.js | grep APP_VERSION` etc.

**Edge-Cache-Falle:** `/api/*`-Antworten sind am Worker-Edge gecacht. Beim Live-Testen Cache-Buster
anhängen (`?cb=$RANDOM`), sonst kommt eine alte Antwort.

## 7. Secrets & Konfiguration
- **Worker-Secrets** (per `npx wrangler secret put NAME` in `worker/`): `FOOTBALL_DATA_KEY` (gesetzt),
  `GNEWS_KEY` (optional, für News-Fotos), `API_FOOTBALL_KEY` (vorhanden, aber ungenutzt).
- **Worker-Vars** (`wrangler.toml`): `DEMO_MODE="false"`, `AF_ENABLE` (aus). ESPN braucht **keinen** Key.
- **Supabase** (öffentlich, in `app.js` `CONFIG.supabase`): URL + anon-Key (durch RLS sicher).
  Schema/RLS/`community_stats`-RPC: **docs/SETUP_SUPABASE.md** (§3 + §3b SQL zum Einfügen).
  Der geheime `service_role`-Key gehört **nicht** in den Client.

## 8. Konventionen & Stolpersteine
- **No-Build:** keine Imports/Bundler im Frontend; Supabase wird per ESM-CDN dynamisch geladen.
- **Rendering:** Views sind Funktionen, die HTML-Strings liefern; `render()` setzt `#app.innerHTML`.
- **Sicherheit:** alle Fremd-/Nutzerdaten mit `esc()` ausgeben (News, Spielernamen). Links nur `http(s)`.
- **Emojis:** UI-Icons sind echte SVGs (`ic()`); Länderflaggen (Wappen via `crest`) und Emoji in echten
  Textsätzen bleiben.
- **Design-Sprache:** Display-Schrift „Bricolage Grotesque", Glass-Cards, Film-Grain, Trikot-/Landesfarben,
  WM-Logo. Lange Listen nutzen `.cv` (content-visibility) fürs Scroll-Tempo.
- **Sheets:** `makeSheetDraggable` (Griff `.grabber[data-drag-handle]`): nach unten/Flick = schließen,
  nach oben = vergrößern. iOS-Fix: SW bereinigt „redirected" Responses (sonst PWA-Startfehler).

## 9. Aktueller Stand (Stand v1.14.1)
Fertig & live: Live-Ticker (echte Minute), Tabellen, Torschützen, Spiel-Detail (Aufstellung in
Landes-Trikotfarben + Statistik + Verlauf, alles echt via ESPN), News-Carousel, Lauf-Challenge
(Ränge/Badges/Wochenziel/Reise), Login + Cloud-Sync + Community-Ranking (Supabase), Onboarding,
Einstellungen (Sprache/Theme/Einheit), WM-2026-Logo, echtes Icon-Set.

Offene Ideen (s. docs/ROADMAP.md): Tippspiel + Punkte-Liga, Push-Benachrichtigungen, Lieblingsteams,
maskable Icons, gebrandete E-Mails (Resend). Spielerfotos gibt's gratis nirgends (ESPN liefert für
die WM keine) → bewusst Trikots+Namen.
