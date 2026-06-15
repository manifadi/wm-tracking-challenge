# Roadmap & To-do-Liste

Legende:
- 🤖 = mache ich (Code)
- 🙋 = machst du (Klicks/Accounts) — Schritt-für-Schritt steht in `SETUP_SUPABASE.md`
- ⏱️ = grobe Größe (S/M/L)

Reihenfolge ist so gewählt, dass jede Phase **für sich nutzbar** ist und nichts blockiert.
Phase 1 & 2 brauchen **keinen** externen Account — damit fangen wir an.

---

## Phase 0 — Fundament & Aufräumen (🤖, ⏱️ S)

Vorbereitung, damit der Rest sauber andockt.

- [ ] `app.js` in Module aufteilen (data / state / views / ui) **ohne** Build-Step
      (ES-Module via `<script type="module">`). Optional, aber zahlt sich aus.
- [ ] Zentrale `i18n`-Schicht (`t('key')`) + Wörterbuch `de`/`en`, Sprache aus
      `navigator.language`, Override in State. Alle sichtbaren Strings darüber.
- [ ] Settings-State-Objekt einführen (`challengeEnabled`, `lang`, `theme`, `unit`,
      `notifications`) + Persistenz.
- [ ] Versionierter `localStorage`-Migrations-Helper (für spätere Schema-Änderungen).

## Phase 1 — Challenge aufwerten (🤖, ⏱️ M) — *kein Account nötig*

Liefert sofort sichtbaren Mehrwert.

- [ ] **Läufe editieren** (Wunsch 2): jeder History-Eintrag bekommt „Bearbeiten" →
      Sheet mit Distanz + Datum + Uhrzeit. Speichern aktualisiert km & Charts.
- [ ] **Gamification/Einordnung** (Wunsch 1), zunächst lokal berechnet:
  - [ ] Level/Liga aus gelaufenen km (Bronze→…→Legende).
  - [ ] Wochenziel + Fortschrittsanzeige.
  - [ ] „Top X %"-Karte — Phase 1 mit einer eingebauten Verteilungs-Heuristik,
        in Phase 5 durch echte Community-Zahlen ersetzt.
  - [ ] Motivations-Texte je nach Status (vorn/dran/hinten).
- [ ] Burndown-Chart um „Prognose: Ziel erreicht am …" ergänzen.

## Phase 2 — UX: Onboarding, Settings, Spiel-Sheet (🤖, ⏱️ M) — *kein Account nötig*

- [ ] **Welcome/Onboarding** (Wunsch 6): Vollbild-Screen mit WM-Wallpaper,
      3 Kurz-Infos, Auswahl **„Challenge mitmachen"** vs. **„Nur Infos"**.
      Auswahl setzt `challengeEnabled`. Einmalig beim ersten Start.
- [ ] **Challenge-Tab dynamisch** aus der Bottom-Nav blenden, wenn Info-Modus.
- [ ] **Einstellungen-Screen** (Wunsch 5): Sprache, Theme, Einheit (km/mi),
      Challenge an/aus, Benachrichtigungen, (später) Account-Bereich.
      Erreichbar über ein Zahnrad im Header.
- [ ] **Spiel-Sheet ziehbar machen** (Wunsch 7): echtes Pointer-Drag am Griff,
      Snap-Punkte halb/voll/zu, Wisch-nach-unten schließt, Backdrop-Tap schließt.

## Phase 3 — Tiefe Spiel-Infos (✅ Code fertig in v1.2 · 🙋 nur noch API-Key-Check)

- [x] **Worker erweitern**: `GET /api/match?fixture=ID` liefert Aufstellung +
      Statistik + Events gebündelt (API-Football `fixtures/lineups|statistics|events`),
      Edge-Cache, Spieler-Fotos via `media.api-sports.io/.../players/{id}.png`.
- [x] **Aufstellung visuell** (Wunsch 3): Spielfeld-Grafik mit Positionen aus `grid`,
      **runde Spieler-Avatare** (Foto live / Initialen-Kreis als Fallback), Bank.
- [x] **Spiel-Statistiken**: Ballbesitz-Balken, Schüsse, Pässe, Passquote, Ecken,
      Fouls, Abseits, Karten, Paraden.
- [x] **Tor-/Event-Verlauf** im Sheet (Minute, Typ, Spieler, Heim/Gast-Seite).
- [x] Detail-Sheet mit Sub-Tabs **Aufstellung · Statistik · Verlauf · Info**,
      Demo-Daten (deterministisch) wenn keine Live-Quelle → funktioniert sofort/offline.
- [ ] 🙋 **Wenn Live gewünscht:** API-Football-Key prüfen (Free 100/Tag reicht meist
      dank Edge-Cache; sonst kleines Upgrade). Mapping deckt aktuell **laufende** Spiele
      ab (fixtureId aus dem Live-Overlay); für beendete/geplante Partien greift der
      Demo-Fallback → optionaler Follow-up: `fixtures`-Endpoint für volle ID-Zuordnung.
      → Schritte in `SETUP_SUPABASE.md` §7.

## Phase 4 — Backend & sicherer Login (✅ Client-Code v1.4 · 🙋 Supabase-Setup offen)

> Genaue Klick-Anleitung: **`SETUP_SUPABASE.md`**. Client läuft **ruhend**, bis
> `CONFIG.supabase` (URL + anon-Key) in `app.js` gefüllt ist.

- [x] 🤖 Supabase-Client (ESM-CDN, lazy) einbinden, `CONFIG.supabase`-Schalter.
- [x] 🤖 **Auth-Flow**: Registrieren, Login, Magic-Link, „Passwort vergessen", Logout
      (Bottom-Sheet, via Einstellungen → Konto).
- [x] 🤖 **Sync-Layer**: Läufe ↔ `runs` (offline-first; Merge/Upload beim Login,
      Write-through bei add/edit/delete) + Einstellungen ↔ `settings`/`profiles`.
- [x] 🤖 Account-Bereich in den Einstellungen (angemeldet als …, Sync-Status, Logout).
- [ ] 🙋 Supabase-Projekt anlegen, URL + anon-Key in `CONFIG.supabase` eintragen (§1–§2).
- [ ] 🙋 Tabellen `profiles`, `runs`, `settings`, `push_subscriptions` + **RLS-Policies**
      per fertigem SQL anlegen (§3).
- [ ] 🙋 Site-/Redirect-URLs setzen, E-Mail-Login aktiv (§4).
- [ ] 🙋 (optional) **Gebrandete E-Mails**: Resend + Domain, SMTP in Supabase, Templates (§5).
- [ ] 🤖 (optional, später) Account-Löschung via Edge Function (Client kann sich nur abmelden).

## Phase 5 — Community-Ranking & Live-News (✅ v1.5–1.6 · 🙋 SQL + Worker-Deploy)

- [x] 🤖 Community-Ranking via SQL-RPC `community_stats()` (security definer):
      echtes Perzentil + Wochen-Leaderboard, anonym/optional Nickname. (SQL §3b)
- [x] 🤖 Worker `GET /api/news?q=…&lang=…`: Google-News-RSS → JSON, Edge-Cache.
- [x] 🤖 News-Sektion auf „Heute" (allg. WM) + im Spiel-Detail (Info-Tab, Team-News),
      XSS-sicher (escaped), graceful wenn Worker/Endpoint fehlt.
- [ ] 🙋 SQL `community_stats` ausführen (für Ranking) + Worker **neu deployen** (für News).

## Phase 6 — Benachrichtigungen (🤖 + 🙋, ⏱️ M)

- [ ] 🙋 VAPID-Keys erzeugen (Anleitung §6), in Supabase-Secrets ablegen.
- [ ] 🤖 Web-Push-Subscription im Client, speichern in `push_subscriptions`.
- [ ] 🤖 Edge Function/Cron: „Anpfiff gleich", „Tor in deinem Spiel",
      „Wochenziel in Gefahr". Custom-Benachrichtigungs-Mails via Resend.
- [ ] 🤖 Service Worker um `push`/`notificationclick`-Handler erweitern.

## UI/UX-Redesign (✅ v1.3) — Hybrid-Look + aufgeräumte IA

- [x] Hybrid-Look: heller, cleaner Body + immersive Gradient-Hero-Cards.
- [x] Challenge entzerrt → **Sub-Tabs** Fortschritt / Verlauf / Erfolge.
- [x] Spielplan: **Status-Filter-Chips** (Alle/Live/Heute/Kommend/Beendet).
- [x] Tabelle: **Gruppen-Chips** (Alle, A–L) statt 12 gestapelter Tabellen.
- [x] Home = Dashboard (Top-3-Torschützen + „Alle anzeigen", Snapshot nur im Challenge-Modus).
- [x] Wiederverwendbare Bausteine: `segTabs`, `chipRow`, `sectionTitle` + DE/EN.
- [ ] Optional offen: volle i18n-Abdeckung tieferliegender Detail-Strings, Dark-Mode-Feinschliff.

## Phase 7 — Politur & Release (🤖 + 🙋, ⏱️ M)

- [ ] 🤖 Tailwind **production build** (CDN-Warnung weg, kleineres CSS) — bleibt optional
      ohne komplexen Bundler (Tailwind CLI als einmaliger Schritt).
- [ ] 🤖 Leere-Zustände, Fehler-Toasts, Skeletons überall konsistent.
- [ ] 🤖 a11y-Pass (Fokus, ARIA, Kontraste), `prefers-reduced-motion` überall.
- [ ] 🙋 Eigene **Domain** für die PWA (Cloudflare Pages) — optional, wirkt aber „echt".
- [ ] 🤖 Lighthouse/PWA-Check, Offline-Test, Install-Flow iOS/Android.

---

## Was du als Erstes tust

1. Nichts — ich starte mit **Phase 1 + 2** (kein Account nötig), wenn du grünes Licht gibst.
2. Parallel kannst du **Supabase** nach `SETUP_SUPABASE.md` anlegen, dann kommt Phase 4.

## Reihenfolge-Empfehlung

`Phase 1 → 2` (sofort, sichtbar) → `4` (Backend, sobald Supabase steht) →
`3` (Spiel-Tiefe) → `5` (Ranking/News) → `6` (Push) → `7` (Release).
Phase 3 kann auch vorgezogen werden, wenn dir die Spiel-Tiefe wichtiger ist als Login.
</content>
