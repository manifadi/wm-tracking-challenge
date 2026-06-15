# Product Vision — WM 2026 Lauf-Challenge

## 1. Der Pitch (ein Satz)

> Die App, die das Mitfiebern bei der WM 2026 in **Bewegung** verwandelt: jedes Tor
> wird zu deinen Kilometern – mit Live-Ticker, echten Spiel-Infos und einer
> Lauf-Challenge, die dich über das ganze Turnier motiviert.

## 2. Was die App heute ist

- No-Build **PWA** (Vanilla JS + Tailwind via CDN), installierbar, offline-fähig.
- 4 Tabs: **Heute · Spielplan · Tabelle · Challenge**.
- Live-Daten über einen **Cloudflare-Worker-Cache** (football-data.org + API-Football),
  Fallback auf eingebaute Demo-Daten.
- State (gelaufene km, Theme, ausgenommene Spiele) liegt **nur lokal** im `localStorage`.

**Lücke:** Es ist heute ein lokales Tool, kein Produkt. Keine Accounts, keine
geräteübergreifende Synchronisation, kein Onboarding, keine sozialen/Vergleichs-Elemente,
dünne Spiel-Detailtiefe. Genau das schließt diese Vision.

## 3. Für wen (Personas)

| Persona | Will | Wir liefern |
|---|---|---|
| **Der Challenger** | Fit bleiben, motiviert werden, Fortschritt sehen | Challenge, Gamification, Ranking, Reminder |
| **Der Fan** | WM verfolgen, Spiele/Stats checken | Live-Ticker, Spiel-Details, Aufstellungen, News |
| **Der Gelegenheits-Nutzer** | Nur schnell Ergebnisse | Info-Modus ohne Challenge-Ballast |

## 4. Nordstern & Prinzipien

- **Nordstern-Metrik:** km, die pro aktivem Nutzer und Woche eingetragen werden.
- **Mobile-first, Apple-Look** bleibt — frosted glass, Haptik, Mikro-Animationen.
- **No-Build bleibt:** Supabase & alles Neue kommt per ES-Module-CDN rein, kein Webpack.
- **Sicher per Design:** Daten in Supabase mit Row Level Security (RLS); der Client
  kennt nur den öffentlichen anon-Key, jeder Nutzer sieht nur seine eigenen Daten.
- **Offline-tauglich:** lokaler State bleibt die Quelle der Wahrheit, Cloud ist Sync-Layer.
- **i18n von Anfang an:** Sprache folgt dem Handy, manuell überschreibbar.

## 5. Die 7 Wünsche → Produkt-Features

1. **Gamification & Einordnung** — „Du gehörst zu den Top 8 % der Challenge-Läufer."
   Perzentil-Ranking, Liga/Level, Wochenziele, Vergleich mit der Community.
2. **Läufe editierbar** — Distanz, Datum & Uhrzeit nachträglich ändern, nicht nur löschen.
3. **Tiefe Spiel-Infos** — Aufstellung visuell auf dem Platz, runde Spieler-Fotos
   (WhatsApp-Stil), Statistiken (Ballbesitz, Pässe, Schüsse, Karten), Tor-Ticker.
4. **Supabase-Backend + sicherer Login** — E-Mail/Passwort + Magic-Link, RLS,
   Cloud-Sync der Läufe, **eigene gebrandete E-Mails** (Login & Benachrichtigungen).
5. **Einstellungen** — Account, Sprache, Theme, Benachrichtigungen, Challenge an/aus,
   Maßeinheit, Datenschutz/Logout/Account löschen.
6. **Welcome-/Onboarding-Screen** — WM-Wallpaper, Kurz-Info, Auswahl
   **Challenge mitmachen** vs. **nur Info** (Info-Modus blendet den Challenge-Tab aus,
   später in den Einstellungen umschaltbar).
7. **Spiel-Detail als Bottom-Sheet** — zieh-/schließbar über den Griff oben
   (echtes Drag-Gesture, snap zu halb/voll/zu).

## 6. Zusätzliche Produkt-Bausteine (für „komplettes Produkt")

- **Live-News** pro Team/Spiel über Google-News-RSS (im Worker geholt & gecacht).
- **Push-Benachrichtigungen** (Web Push): Anpfiff, Tor in einem gemerkten Spiel,
  „Du hängst hinter deinem Wochenziel".
- **Community-Ranking** (anonymisiertes Perzentil) als Basis für Feature 1.
- **Account-übergreifende Sync** der Läufe & Einstellungen.

## 7. Datenquellen (alle mit Free-Tier)

| Brauchen wir | Quelle | Free-Tier | Anmerkung |
|---|---|---|---|
| Spielplan, Ergebnisse, Torschützen | football-data.org | ja | bereits im Worker |
| Live-Minute/-Stand | API-Football (api-sports.io) | 100 req/Tag | bereits im Worker |
| Aufstellungen, Spieler-Fotos, Stats | API-Football | im selben Plan | `fixtures/lineups`, `fixtures/statistics`, `players[].photo` |
| News | Google News RSS | kostenlos | XML im Worker parsen & cachen |
| Auth, DB, E-Mail-Trigger | Supabase | ja | RLS, Auth, Edge Functions |
| Gebrandete E-Mails | Resend | 3.000/Monat, 100/Tag | als SMTP in Supabase ODER via Edge Function |
| Web Push | VAPID (Web Push) | kostenlos | Subscription in Supabase speichern |

## 8. Architektur-Zielbild

```
        ┌──────────────────────────────────────────────┐
        │  PWA (index.html + app.js, no-build)          │
        │  • Auth via @supabase/supabase-js (ESM-CDN)    │
        │  • lokaler State (localStorage) = Offline-Cache│
        └───────────┬───────────────────┬──────────────┘
                    │                   │
        Live-Sport  │                   │  Auth / Daten / Sync
                    ▼                   ▼
        ┌────────────────────┐   ┌─────────────────────────┐
        │ Cloudflare Worker   │   │ Supabase                │
        │ /api/matches        │   │ • Auth (E-Mail+Magic)   │
        │ /api/lineups        │   │ • Postgres + RLS        │
        │ /api/news           │   │   runs, profiles,       │
        │ (Edge-Cache)        │   │   push_subscriptions    │
        └─────────┬──────────┘   │ • Edge Functions:       │
                  │              │   ranking, send-email,   │
   football-data ─┤              │   push                  │
   API-Football  ─┘              └──────────┬──────────────┘
                                            │ SMTP/API
                                            ▼   Resend (gebrandete Mails)
```

## 9. Erfolgskriterien (MVP des „echten Produkts")

- Nutzer kann sich registrieren/anmelden, bekommt eine **gebrandete** Login-Mail.
- Läufe sind nach Login **geräteübergreifend** vorhanden, editierbar & löschbar.
- Onboarding fragt Challenge vs. Info; Info-Modus blendet Challenge-Tab aus.
- Spiel-Detail zeigt Aufstellung mit Spieler-Fotos + Grundstatistiken, Sheet ist ziehbar.
- Sprache folgt dem Handy.
- „Top X %"-Einordnung erscheint in der Challenge.
- Lighthouse PWA-Score bleibt grün; App lädt offline.
</content>
</invoke>
