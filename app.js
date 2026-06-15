/* =====================================================================
 * WM 2026 · Lauf-Challenge  —  App-Logik
 * ---------------------------------------------------------------------
 * Regel: pro geschossenem WM-Tor = 1 km laufen.
 * Stack: Vanilla JS + Tailwind (CDN). Kein Build-Step nötig.
 * State: localStorage (gelaufene km, deaktivierte Spiele, Tab, Theme).
 * ===================================================================== */

'use strict';

/* ------------------------------------------------------------------ *
 * 0) KONFIGURATION
 * ------------------------------------------------------------------ *
 * apiBase = URL deines Cloudflare-Workers (siehe /worker).
 *   - LEER lassen  → App läuft mit eingebauten Mock-Daten (offline-tauglich, kein Key nötig).
 *   - gesetzt      → App holt gemischte Live-/Ergebnisdaten aus deinem Worker-Cache.
 * Der Worker liefert exakt dasselbe Schema wie die Mock-Daten – kein Mapping nötig.
 * ------------------------------------------------------------------ */
const CONFIG = {
  apiBase: 'https://wm-ticker.manuel-fades50.workers.dev',   // Produktions-Worker (Live-Daten). Lokal testen: 'http://localhost:8787'
  pollLiveMs: 60000,           // Abfrage-Intervall, wenn mind. ein Spiel LÄUFT
  pollIdleMs: 600000,          // Abfrage-Intervall sonst (Ergebnisse ändern sich selten)

  // Supabase (Login & Cloud-Sync). Leer = deaktiviert → App läuft rein lokal wie bisher.
  // Werte aus dem Supabase-Dashboard (Project Settings → API) eintragen:
  supabase: {
    url:     'https://euqbexhqamznbyykrhtx.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1cWJleGhxYW16bmJ5eWtyaHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzA3ODQsImV4cCI6MjA5NzEwNjc4NH0.RjfKqLfe1fnuQ7Bz7v5YDEchKfKAyTVw8hxt26IfU_w',
  },
};

/* ------------------------------------------------------------------ *
 * 1) MOCK-DATA  (WM 2026)
 * ------------------------------------------------------------------ *
 * Struktur ist bewusst nah an der football-data.org-API gehalten,
 * damit fetchMatches() später 1:1 durch einen echten Call ersetzbar ist.
 * status: 'FINISHED' | 'IN_PLAY' | 'SCHEDULED'
 * ------------------------------------------------------------------ */
const MOCK_DATA = {
  competition: 'FIFA World Cup 2026',
  groups: {
    A: [{code:'MEX',name:'Mexiko',flag:'🇲🇽'}, {code:'POL',name:'Polen',flag:'🇵🇱'}, {code:'KSA',name:'Saudi-Arabien',flag:'🇸🇦'}, {code:'AUS',name:'Australien',flag:'🇦🇺'}],
    B: [{code:'CAN',name:'Kanada',flag:'🇨🇦'}, {code:'BEL',name:'Belgien',flag:'🇧🇪'}, {code:'MAR',name:'Marokko',flag:'🇲🇦'}, {code:'JPN',name:'Japan',flag:'🇯🇵'}],
    C: [{code:'USA',name:'USA',flag:'🇺🇸'}, {code:'ENG',name:'England',flag:'🏴'}, {code:'SEN',name:'Senegal',flag:'🇸🇳'}, {code:'ECU',name:'Ecuador',flag:'🇪🇨'}],
    D: [{code:'GER',name:'Deutschland',flag:'🇩🇪'}, {code:'BRA',name:'Brasilien',flag:'🇧🇷'}, {code:'CRO',name:'Kroatien',flag:'🇭🇷'}, {code:'GHA',name:'Ghana',flag:'🇬🇭'}],
    E: [{code:'FRA',name:'Frankreich',flag:'🇫🇷'}, {code:'NED',name:'Niederlande',flag:'🇳🇱'}, {code:'IRN',name:'Iran',flag:'🇮🇷'}, {code:'CRC',name:'Costa Rica',flag:'🇨🇷'}],
    F: [{code:'ESP',name:'Spanien',flag:'🇪🇸'}, {code:'POR',name:'Portugal',flag:'🇵🇹'}, {code:'URU',name:'Uruguay',flag:'🇺🇾'}, {code:'KOR',name:'Südkorea',flag:'🇰🇷'}],
    G: [{code:'ARG',name:'Argentinien',flag:'🇦🇷'}, {code:'ITA',name:'Italien',flag:'🇮🇹'}, {code:'NGA',name:'Nigeria',flag:'🇳🇬'}, {code:'QAT',name:'Katar',flag:'🇶🇦'}],
    H: [{code:'COL',name:'Kolumbien',flag:'🇨🇴'}, {code:'SUI',name:'Schweiz',flag:'🇨🇭'}, {code:'EGY',name:'Ägypten',flag:'🇪🇬'}, {code:'NZL',name:'Neuseeland',flag:'🇳🇿'}],
    I: [{code:'DEN',name:'Dänemark',flag:'🇩🇰'}, {code:'SRB',name:'Serbien',flag:'🇷🇸'}, {code:'TUN',name:'Tunesien',flag:'🇹🇳'}, {code:'PAN',name:'Panama',flag:'🇵🇦'}],
    J: [{code:'NOR',name:'Norwegen',flag:'🇳🇴'}, {code:'AUT',name:'Österreich',flag:'🇦🇹'}, {code:'ALG',name:'Algerien',flag:'🇩🇿'}, {code:'JAM',name:'Jamaika',flag:'🇯🇲'}],
    K: [{code:'UKR',name:'Ukraine',flag:'🇺🇦'}, {code:'TUR',name:'Türkei',flag:'🇹🇷'}, {code:'CMR',name:'Kamerun',flag:'🇨🇲'}, {code:'UZB',name:'Usbekistan',flag:'🇺🇿'}],
    L: [{code:'PER',name:'Peru',flag:'🇵🇪'}, {code:'PAR',name:'Paraguay',flag:'🇵🇾'}, {code:'CIV',name:'Elfenbeinküste',flag:'🇨🇮'}, {code:'JOR',name:'Jordanien',flag:'🇯🇴'}],
  },
  matches: [
    { id:'A1', group:'A', status:'FINISHED', utcDate:'2026-06-11T18:00:00Z', home:'MEX', away:'POL', score:{ home:1, away:2 } },
    { id:'A2', group:'A', status:'FINISHED', utcDate:'2026-06-11T21:00:00Z', home:'KSA', away:'AUS', score:{ home:3, away:1 } },
    { id:'A3', group:'A', status:'IN_PLAY', utcDate:'2026-06-14T18:00:00Z', home:'MEX', away:'KSA', score:{ home:1, away:1 }, minute:34 },
    { id:'A4', group:'A', status:'FINISHED', utcDate:'2026-06-14T21:00:00Z', home:'POL', away:'AUS', score:{ home:2, away:3 } },
    { id:'A5', group:'A', status:'SCHEDULED', utcDate:'2026-06-17T18:00:00Z', home:'MEX', away:'AUS', score:{ home:null, away:null } },
    { id:'A6', group:'A', status:'SCHEDULED', utcDate:'2026-06-17T21:00:00Z', home:'POL', away:'KSA', score:{ home:null, away:null } },
    { id:'B1', group:'B', status:'FINISHED', utcDate:'2026-06-12T18:00:00Z', home:'CAN', away:'BEL', score:{ home:3, away:3 } },
    { id:'B2', group:'B', status:'FINISHED', utcDate:'2026-06-12T21:00:00Z', home:'MAR', away:'JPN', score:{ home:2, away:2 } },
    { id:'B3', group:'B', status:'IN_PLAY', utcDate:'2026-06-15T18:00:00Z', home:'CAN', away:'MAR', score:{ home:1, away:2 }, minute:42 },
    { id:'B4', group:'B', status:'FINISHED', utcDate:'2026-06-15T21:00:00Z', home:'BEL', away:'JPN', score:{ home:1, away:3 } },
    { id:'B5', group:'B', status:'SCHEDULED', utcDate:'2026-06-18T18:00:00Z', home:'CAN', away:'JPN', score:{ home:null, away:null } },
    { id:'B6', group:'B', status:'SCHEDULED', utcDate:'2026-06-18T21:00:00Z', home:'BEL', away:'MAR', score:{ home:null, away:null } },
    { id:'C1', group:'C', status:'FINISHED', utcDate:'2026-06-13T18:00:00Z', home:'USA', away:'ENG', score:{ home:3, away:4 } },
    { id:'C2', group:'C', status:'FINISHED', utcDate:'2026-06-13T21:00:00Z', home:'SEN', away:'ECU', score:{ home:0, away:2 } },
    { id:'C3', group:'C', status:'IN_PLAY', utcDate:'2026-06-16T18:00:00Z', home:'USA', away:'SEN', score:{ home:1, away:2 }, minute:75 },
    { id:'C4', group:'C', status:'FINISHED', utcDate:'2026-06-16T21:00:00Z', home:'ENG', away:'ECU', score:{ home:4, away:1 } },
    { id:'C5', group:'C', status:'SCHEDULED', utcDate:'2026-06-19T18:00:00Z', home:'USA', away:'ECU', score:{ home:null, away:null } },
    { id:'C6', group:'C', status:'SCHEDULED', utcDate:'2026-06-19T21:00:00Z', home:'ENG', away:'SEN', score:{ home:null, away:null } },
    { id:'D1', group:'D', status:'FINISHED', utcDate:'2026-06-11T18:00:00Z', home:'GER', away:'BRA', score:{ home:1, away:0 } },
    { id:'D2', group:'D', status:'FINISHED', utcDate:'2026-06-11T21:00:00Z', home:'CRO', away:'GHA', score:{ home:1, away:2 } },
    { id:'D3', group:'D', status:'IN_PLAY', utcDate:'2026-06-14T18:00:00Z', home:'GER', away:'CRO', score:{ home:1, away:2 }, minute:84 },
    { id:'D4', group:'D', status:'FINISHED', utcDate:'2026-06-14T21:00:00Z', home:'BRA', away:'GHA', score:{ home:2, away:1 } },
    { id:'D5', group:'D', status:'SCHEDULED', utcDate:'2026-06-17T18:00:00Z', home:'GER', away:'GHA', score:{ home:null, away:null } },
    { id:'D6', group:'D', status:'SCHEDULED', utcDate:'2026-06-17T21:00:00Z', home:'BRA', away:'CRO', score:{ home:null, away:null } },
    { id:'E1', group:'E', status:'FINISHED', utcDate:'2026-06-12T18:00:00Z', home:'FRA', away:'NED', score:{ home:1, away:0 } },
    { id:'E2', group:'E', status:'FINISHED', utcDate:'2026-06-12T21:00:00Z', home:'IRN', away:'CRC', score:{ home:4, away:1 } },
    { id:'E3', group:'E', status:'FINISHED', utcDate:'2026-06-15T18:00:00Z', home:'FRA', away:'IRN', score:{ home:1, away:2 } },
    { id:'E4', group:'E', status:'FINISHED', utcDate:'2026-06-15T21:00:00Z', home:'NED', away:'CRC', score:{ home:2, away:0 } },
    { id:'E5', group:'E', status:'SCHEDULED', utcDate:'2026-06-18T18:00:00Z', home:'FRA', away:'CRC', score:{ home:null, away:null } },
    { id:'E6', group:'E', status:'SCHEDULED', utcDate:'2026-06-18T21:00:00Z', home:'NED', away:'IRN', score:{ home:null, away:null } },
    { id:'F1', group:'F', status:'FINISHED', utcDate:'2026-06-13T18:00:00Z', home:'ESP', away:'POR', score:{ home:1, away:1 } },
    { id:'F2', group:'F', status:'FINISHED', utcDate:'2026-06-13T21:00:00Z', home:'URU', away:'KOR', score:{ home:2, away:0 } },
    { id:'F3', group:'F', status:'FINISHED', utcDate:'2026-06-16T18:00:00Z', home:'ESP', away:'URU', score:{ home:1, away:2 } },
    { id:'F4', group:'F', status:'FINISHED', utcDate:'2026-06-16T21:00:00Z', home:'POR', away:'KOR', score:{ home:2, away:2 } },
    { id:'F5', group:'F', status:'SCHEDULED', utcDate:'2026-06-19T18:00:00Z', home:'ESP', away:'KOR', score:{ home:null, away:null } },
    { id:'F6', group:'F', status:'SCHEDULED', utcDate:'2026-06-19T21:00:00Z', home:'POR', away:'URU', score:{ home:null, away:null } },
    { id:'G1', group:'G', status:'FINISHED', utcDate:'2026-06-11T18:00:00Z', home:'ARG', away:'ITA', score:{ home:4, away:4 } },
    { id:'G2', group:'G', status:'FINISHED', utcDate:'2026-06-11T21:00:00Z', home:'NGA', away:'QAT', score:{ home:1, away:4 } },
    { id:'G3', group:'G', status:'FINISHED', utcDate:'2026-06-14T18:00:00Z', home:'ARG', away:'NGA', score:{ home:2, away:2 } },
    { id:'G4', group:'G', status:'FINISHED', utcDate:'2026-06-14T21:00:00Z', home:'ITA', away:'QAT', score:{ home:0, away:1 } },
    { id:'G5', group:'G', status:'SCHEDULED', utcDate:'2026-06-17T18:00:00Z', home:'ARG', away:'QAT', score:{ home:null, away:null } },
    { id:'G6', group:'G', status:'SCHEDULED', utcDate:'2026-06-17T21:00:00Z', home:'ITA', away:'NGA', score:{ home:null, away:null } },
    { id:'H1', group:'H', status:'FINISHED', utcDate:'2026-06-12T18:00:00Z', home:'COL', away:'SUI', score:{ home:2, away:0 } },
    { id:'H2', group:'H', status:'FINISHED', utcDate:'2026-06-12T21:00:00Z', home:'EGY', away:'NZL', score:{ home:2, away:4 } },
    { id:'H3', group:'H', status:'FINISHED', utcDate:'2026-06-15T18:00:00Z', home:'COL', away:'EGY', score:{ home:3, away:0 } },
    { id:'H4', group:'H', status:'FINISHED', utcDate:'2026-06-15T21:00:00Z', home:'SUI', away:'NZL', score:{ home:4, away:2 } },
    { id:'H5', group:'H', status:'SCHEDULED', utcDate:'2026-06-18T18:00:00Z', home:'COL', away:'NZL', score:{ home:null, away:null } },
    { id:'H6', group:'H', status:'SCHEDULED', utcDate:'2026-06-18T21:00:00Z', home:'SUI', away:'EGY', score:{ home:null, away:null } },
    { id:'I1', group:'I', status:'FINISHED', utcDate:'2026-06-13T18:00:00Z', home:'DEN', away:'SRB', score:{ home:3, away:3 } },
    { id:'I2', group:'I', status:'FINISHED', utcDate:'2026-06-13T21:00:00Z', home:'TUN', away:'PAN', score:{ home:2, away:4 } },
    { id:'I3', group:'I', status:'SCHEDULED', utcDate:'2026-06-16T18:00:00Z', home:'DEN', away:'TUN', score:{ home:null, away:null } },
    { id:'I4', group:'I', status:'SCHEDULED', utcDate:'2026-06-16T21:00:00Z', home:'SRB', away:'PAN', score:{ home:null, away:null } },
    { id:'I5', group:'I', status:'SCHEDULED', utcDate:'2026-06-19T18:00:00Z', home:'DEN', away:'PAN', score:{ home:null, away:null } },
    { id:'I6', group:'I', status:'SCHEDULED', utcDate:'2026-06-19T21:00:00Z', home:'SRB', away:'TUN', score:{ home:null, away:null } },
    { id:'J1', group:'J', status:'FINISHED', utcDate:'2026-06-11T18:00:00Z', home:'NOR', away:'AUT', score:{ home:4, away:2 } },
    { id:'J2', group:'J', status:'FINISHED', utcDate:'2026-06-11T21:00:00Z', home:'ALG', away:'JAM', score:{ home:4, away:2 } },
    { id:'J3', group:'J', status:'SCHEDULED', utcDate:'2026-06-14T18:00:00Z', home:'NOR', away:'ALG', score:{ home:null, away:null } },
    { id:'J4', group:'J', status:'SCHEDULED', utcDate:'2026-06-14T21:00:00Z', home:'AUT', away:'JAM', score:{ home:null, away:null } },
    { id:'J5', group:'J', status:'SCHEDULED', utcDate:'2026-06-17T18:00:00Z', home:'NOR', away:'JAM', score:{ home:null, away:null } },
    { id:'J6', group:'J', status:'SCHEDULED', utcDate:'2026-06-17T21:00:00Z', home:'AUT', away:'ALG', score:{ home:null, away:null } },
    { id:'K1', group:'K', status:'FINISHED', utcDate:'2026-06-12T18:00:00Z', home:'UKR', away:'TUR', score:{ home:0, away:1 } },
    { id:'K2', group:'K', status:'FINISHED', utcDate:'2026-06-12T21:00:00Z', home:'CMR', away:'UZB', score:{ home:0, away:2 } },
    { id:'K3', group:'K', status:'SCHEDULED', utcDate:'2026-06-15T18:00:00Z', home:'UKR', away:'CMR', score:{ home:null, away:null } },
    { id:'K4', group:'K', status:'SCHEDULED', utcDate:'2026-06-15T21:00:00Z', home:'TUR', away:'UZB', score:{ home:null, away:null } },
    { id:'K5', group:'K', status:'SCHEDULED', utcDate:'2026-06-18T18:00:00Z', home:'UKR', away:'UZB', score:{ home:null, away:null } },
    { id:'K6', group:'K', status:'SCHEDULED', utcDate:'2026-06-18T21:00:00Z', home:'TUR', away:'CMR', score:{ home:null, away:null } },
    { id:'L1', group:'L', status:'FINISHED', utcDate:'2026-06-13T18:00:00Z', home:'PER', away:'PAR', score:{ home:1, away:3 } },
    { id:'L2', group:'L', status:'FINISHED', utcDate:'2026-06-13T21:00:00Z', home:'CIV', away:'JOR', score:{ home:2, away:0 } },
    { id:'L3', group:'L', status:'SCHEDULED', utcDate:'2026-06-16T18:00:00Z', home:'PER', away:'CIV', score:{ home:null, away:null } },
    { id:'L4', group:'L', status:'SCHEDULED', utcDate:'2026-06-16T21:00:00Z', home:'PAR', away:'JOR', score:{ home:null, away:null } },
    { id:'L5', group:'L', status:'SCHEDULED', utcDate:'2026-06-19T18:00:00Z', home:'PER', away:'JOR', score:{ home:null, away:null } },
    { id:'L6', group:'L', status:'SCHEDULED', utcDate:'2026-06-19T21:00:00Z', home:'PAR', away:'CIV', score:{ home:null, away:null } },
  ],
  // Demo-Torschützenliste (im Live-Betrieb vom Worker via football-data /scorers)
  scorers: [
    { name: 'Kylian Mbappé',     team: 'Frankreich',   flag: '🇫🇷', goals: 4 },
    { name: 'Harry Kane',        team: 'England',      flag: '🏴', goals: 3 },
    { name: 'Vinícius Júnior',   team: 'Brasilien',    flag: '🇧🇷', goals: 3 },
    { name: 'Erling Haaland',    team: 'Norwegen',     flag: '🇳🇴', goals: 3 },
    { name: 'Lautaro Martínez',  team: 'Argentinien',  flag: '🇦🇷', goals: 2 },
    { name: 'Florian Wirtz',     team: 'Deutschland',  flag: '🇩🇪', goals: 2 },
    { name: 'Cristiano Ronaldo', team: 'Portugal',     flag: '🇵🇹', goals: 2 },
  ],
};

/**
 * Holt die WM-Daten.
 *  - CONFIG.apiBase gesetzt → echter Call an den Worker-Cache (mischt Live + Ergebnisse).
 *    Der Worker normalisiert bereits auf unser Schema, daher kein Mapping nötig.
 *  - kein apiBase ODER Fehler/Offline → eingebaute Mock-Daten (App bleibt voll funktionsfähig).
 */
const FORCE_DEMO = (typeof location !== 'undefined') && new URLSearchParams(location.search).get('demo') === '1';

async function fetchMatches() {
  if (!CONFIG.apiBase || FORCE_DEMO) {           // ?demo=1 erzwingt Mock-Daten (offline/Preview)
    await new Promise((r) => setTimeout(r, 200));
    return structuredClone(MOCK_DATA);
  }
  try {
    const res = await fetch(`${CONFIG.apiBase.replace(/\/$/, '')}/api/matches`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.matches)) throw new Error('Ungültiges Schema');
    return data;
  } catch (err) {
    console.warn('[WM] Live-Daten nicht erreichbar – nutze Mock-Fallback:', err.message);
    return structuredClone(MOCK_DATA);
  }
}

/* ------------------------------------------------------------------ *
 * 2) STATE & PERSISTENZ
 * ------------------------------------------------------------------ */
const LS = {
  ran:      'wm-challenge:ranKm',          // (legacy) Einzelwert – wird einmalig migriert
  runs:     'wm-challenge:runs',           // Lauf-Historie: [{ id, km, ts }]
  badges:   'wm-challenge:seenBadges',     // bereits gefeierte Badge-IDs
  disabled: 'wm-challenge:disabledMatches',
  tab:      'wm-challenge:tab',
  tickerView: 'wm-challenge:tickerView',     // 'matches' | 'table'
  theme:    'wm-challenge:theme',
  install:  'wm-challenge:installDismissed',
  settings: 'wm-challenge:settings',         // { lang, unit, challengeEnabled, notifications, weeklyGoalKm }
  onboarded:'wm-challenge:onboarded',        // true, sobald der Welcome-Screen durchlaufen wurde
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* Lauf-Historie laden + sanfte Migration vom alten Einzelwert ranKm */
function loadRuns() {
  const stored = load(LS.runs, null);
  if (Array.isArray(stored)) return stored;
  const legacy = Number(load(LS.ran, 0)) || 0;       // alter Stand → 1 Sammeleintrag
  return legacy > 0 ? [{ id: 'legacy', km: legacy, ts: Date.now() }] : [];
}

const VALID_TABS = ['today', 'schedule', 'table', 'challenge'];
function loadTab() {
  const t = load(LS.tab, 'today');
  return VALID_TABS.includes(t) ? t : 'today';   // alte Werte ('ticker') → Heute
}

/* ------------------------------------------------------------------ *
 * 2b) EINSTELLUNGEN + i18n (Sprache folgt dem Handy, manuell überschreibbar)
 * ------------------------------------------------------------------ */
const SUPPORTED_LANGS = ['de', 'en'];

/** Sprache aus der Handy-/Browser-Einstellung ableiten (Default: Deutsch) */
function detectLang() {
  const navLangs = (navigator.languages && navigator.languages.length)
    ? navigator.languages : [navigator.language || 'de'];
  for (const l of navLangs) {
    const base = String(l).slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(base)) return base;
  }
  return 'de';
}

const DEFAULT_SETTINGS = {
  lang: null,                 // null → automatisch (detectLang); sonst 'de' | 'en'
  unit: 'km',                 // 'km' | 'mi'
  challengeEnabled: true,     // false = reiner Info-Modus (Challenge-Tab ausgeblendet)
  notifications: false,       // Platzhalter bis Phase 6 (Web-Push)
  weeklyGoalKm: 15,           // persönliches Wochenziel
  nickname: '',               // Anzeigename in der Rangliste (optional)
  leaderboardOptin: false,    // Name in der Rangliste zeigen (sonst „Läufer #")
};

function loadSettings() {
  const s = load(LS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
}

/** Aktuell aktive Sprache (Override oder Auto-Erkennung) */
const getLang = () => {
  const l = state.settings && state.settings.lang;
  return SUPPORTED_LANGS.includes(l) ? l : detectLang();
};

/* Wörterbuch. Bestehende deutsche UI bleibt vorerst direkt im Code; neue
 * Oberflächen (Onboarding, Einstellungen, Gamification, Lauf-Editor) sowie die
 * Navigation/Headertitel laufen über t() und sind de/en vollständig übersetzt. */
const I18N = {
  de: {
    'nav.today': 'Heute', 'nav.schedule': 'Spielplan', 'nav.table': 'Tabelle', 'nav.challenge': 'Challenge',
    'title.today': 'Übersicht', 'title.schedule': 'Spielplan', 'title.table': 'Tabellen',
    'title.challenge': 'Challenge', 'title.settings': 'Einstellungen',
    'greet.night': 'Gute Nacht', 'greet.morning': 'Guten Morgen', 'greet.day': 'Guten Tag', 'greet.evening': 'Guten Abend',
    'common.save': 'Speichern', 'common.cancel': 'Abbrechen', 'common.delete': 'Löschen', 'common.close': 'Schließen',
    'common.back': 'Zurück', 'common.continue': 'Weiter', 'common.on': 'An', 'common.off': 'Aus', 'common.auto': 'Automatisch',
    'onb.tagline': 'Lauf dir die WM 2026.',
    'onb.rule': 'Die Regel: Für jedes WM-Tor läufst du 1 km.',
    'onb.f1.t': 'Live dabei', 'onb.f1.d': 'Ticker, Tabellen & Spiel-Details in Echtzeit.',
    'onb.f2.t': 'In Bewegung', 'onb.f2.d': 'Jedes Tor wird zu deinen Kilometern.',
    'onb.f3.t': 'Motiviert', 'onb.f3.d': 'Fortschritt, Erfolge & deine Einordnung.',
    'onb.q': 'Wie möchtest du starten?',
    'onb.challenge.t': 'Challenge mitmachen', 'onb.challenge.d': 'Tore tracken & Kilometer laufen.',
    'onb.info.t': 'Nur Infos', 'onb.info.d': 'Nur Ticker & Ergebnisse – ohne Challenge.',
    'onb.hint': 'Du kannst das jederzeit in den Einstellungen ändern.',
    'set.appearance': 'Darstellung', 'set.language': 'Sprache', 'set.theme': 'Erscheinungsbild',
    'set.theme.system': 'System', 'set.theme.light': 'Hell', 'set.theme.dark': 'Dunkel',
    'set.unit': 'Einheit', 'set.challenge': 'Challenge', 'set.challenge.on': 'Lauf-Challenge aktiv',
    'set.challenge.d': 'Aus = reiner Info-Modus, Challenge-Tab ausgeblendet.',
    'set.weeklygoal': 'Wochenziel', 'set.notifications': 'Benachrichtigungen',
    'set.notifications.d': 'Anpfiff, Tore & Ziel-Erinnerungen (bald verfügbar).',
    'set.account': 'Konto', 'set.account.soon': 'Login & Cloud-Sync kommen bald.',
    'set.data': 'Daten', 'set.reset': 'Fortschritt zurücksetzen', 'set.about': 'Über',
    'set.version': 'Version', 'set.lang.auto': 'Automatisch (Handy)',
    'run.edit': 'Lauf bearbeiten', 'run.distance': 'Distanz', 'run.date': 'Datum', 'run.time': 'Uhrzeit',
    'gam.title': 'Dein Rang', 'gam.level': 'Level', 'gam.top': 'Top {pct} %',
    'gam.top.sub': 'der Challenge-Läufer', 'gam.weekly': 'Wochenziel', 'gam.weekly.left': 'noch {km} km diese Woche',
    'gam.weekly.done': 'Wochenziel geschafft! 🎉',
    'gam.m.ahead': 'Stark – du bist deinem Soll voraus! 🔥',
    'gam.m.ontrack': 'Gut dabei – bleib dran! 💪', 'gam.m.behind': 'Zeit für eine Runde – {km} km offen. 👟',
    'gam.m.start': 'Trag deinen ersten Lauf ein und leg los! 🚀',
    'md.lineup': 'Aufstellung', 'md.stats': 'Statistik', 'md.events': 'Verlauf', 'md.info': 'Info',
    'md.probable': 'Voraussichtliche Aufstellung', 'md.coach': 'Trainer', 'md.bench': 'Ersatzbank',
    'md.noLineup': 'Aufstellung noch nicht verfügbar.', 'md.noStats': 'Noch keine Statistik – Spiel nicht gestartet.',
    'md.noEvents': 'Noch keine Ereignisse.',
    'md.demo': 'Beispielwerte – echte Statistiken brauchen einen Sport-Datenplan mit Saison-Zugriff.',
    'st.possession': 'Ballbesitz', 'st.shots': 'Torschüsse', 'st.shotsOn': 'aufs Tor', 'st.passes': 'Pässe',
    'st.passAcc': 'Passquote', 'st.corners': 'Ecken', 'st.fouls': 'Fouls', 'st.yellow': 'Gelbe Karten',
    'st.offsides': 'Abseits', 'st.saves': 'Paraden',
    'ev.goal': 'Tor', 'ev.penalty': 'Elfmeter', 'ev.owngoal': 'Eigentor', 'ev.yellow': 'Gelb', 'ev.red': 'Rot', 'ev.subst': 'Wechsel',
    'pos.gk': 'TOR', 'pos.def': 'ABW', 'pos.mid': 'MIT', 'pos.fwd': 'ANG',
    'ch.progress': 'Fortschritt', 'ch.history': 'Verlauf', 'ch.ach': 'Erfolge',
    'f.all': 'Alle', 'f.live': 'Live', 'f.today': 'Heute', 'f.upcoming': 'Kommend', 'f.finished': 'Beendet',
    'sec.news': 'News', 'news.empty': 'Aktuell keine News.',
    'sec.scorers': 'Torschützenkönige', 'sec.allMatches': 'Alle Spiele', 'sec.seeAll': 'Alle anzeigen',
    'sec.standings': 'Tabellen', 'sec.bracket': 'K.-o.-Runde', 'sec.weighting': 'Spiele werten',
    'sec.weighting.d': 'Schalter aus = Tore dieses Spiels zählen nicht zum Soll.',
    'sec.noMatches': 'Keine Spiele in dieser Auswahl.',
    'grp': 'Gruppe', 'tbl.team': 'Team', 'tbl.pl': 'Sp', 'tbl.diff': 'Diff', 'tbl.pts': 'Pkt',
    'ch.balance': 'Deine Bilanz', 'ch.noStreak': 'noch kein Streak',
    'ch.trackTitle': 'Kilometer eintragen', 'ch.trackHint': 'Trag deine gerade gelaufene Strecke ein.',
    'ch.addRun': 'Lauf hinzufügen', 'today.challenge': 'Deine Challenge', 'today.open': 'Öffnen',
    'auth.signin': 'Anmelden', 'auth.signup': 'Registrieren', 'auth.email': 'E-Mail', 'auth.password': 'Passwort',
    'auth.magic': 'Stattdessen Magic-Link senden', 'auth.forgot': 'Passwort vergessen?', 'auth.logout': 'Abmelden',
    'auth.signedInAs': 'Angemeldet als', 'auth.cloudHint': 'Melde dich an, um deine Läufe & Einstellungen geräteübergreifend zu sichern.',
    'auth.checkEmail': 'Fast geschafft – bestätige deine E-Mail-Adresse. 📧',
    'auth.magicSent': 'Magic-Link gesendet – check deine E-Mails. 📧', 'auth.resetSent': 'Link zum Zurücksetzen gesendet. 📧',
    'auth.needFields': 'Bitte E-Mail und Passwort eingeben.', 'auth.needEmail': 'Bitte zuerst die E-Mail eingeben.',
    'auth.syncing': 'Synchronisiere …', 'auth.synced': 'Cloud-Sync aktiv', 'auth.busy': 'Bitte warten …',
    'auth.welcome': 'Cloud-Sync', 'auth.haveAccount': 'Schon dabei?', 'auth.title': 'Anmelden oder registrieren',
    'rank.title': 'Rangliste', 'rank.players': 'von {n}', 'rank.you': 'Du', 'rank.total': 'Gesamt',
    'rank.signin': 'Melde dich an, um in der Rangliste mitzulaufen.',
    'gam.top.real': 'von {n} Läufern', 'set.nickname': 'Anzeigename (Rangliste)',
    'set.leaderboard': 'In Rangliste anzeigen', 'set.leaderboard.d': 'Zeigt deinen Namen statt „Läufer #". Sonst bleibst du anonym.',
  },
  en: {
    'nav.today': 'Today', 'nav.schedule': 'Matches', 'nav.table': 'Standings', 'nav.challenge': 'Challenge',
    'title.today': 'Overview', 'title.schedule': 'Matches', 'title.table': 'Standings',
    'title.challenge': 'Challenge', 'title.settings': 'Settings',
    'greet.night': 'Good night', 'greet.morning': 'Good morning', 'greet.day': 'Hello', 'greet.evening': 'Good evening',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'common.close': 'Close',
    'common.back': 'Back', 'common.continue': 'Continue', 'common.on': 'On', 'common.off': 'Off', 'common.auto': 'Automatic',
    'onb.tagline': 'Run your way through the 2026 World Cup.',
    'onb.rule': 'The rule: for every World Cup goal, you run 1 km.',
    'onb.f1.t': 'Live coverage', 'onb.f1.d': 'Ticker, standings & match details in real time.',
    'onb.f2.t': 'On the move', 'onb.f2.d': 'Every goal turns into your kilometres.',
    'onb.f3.t': 'Motivated', 'onb.f3.d': 'Progress, achievements & your ranking.',
    'onb.q': 'How would you like to start?',
    'onb.challenge.t': 'Join the challenge', 'onb.challenge.d': 'Track goals & run kilometres.',
    'onb.info.t': 'Info only', 'onb.info.d': 'Just ticker & results – no challenge.',
    'onb.hint': 'You can change this anytime in settings.',
    'set.appearance': 'Appearance', 'set.language': 'Language', 'set.theme': 'Theme',
    'set.theme.system': 'System', 'set.theme.light': 'Light', 'set.theme.dark': 'Dark',
    'set.unit': 'Unit', 'set.challenge': 'Challenge', 'set.challenge.on': 'Running challenge active',
    'set.challenge.d': 'Off = info-only mode, challenge tab hidden.',
    'set.weeklygoal': 'Weekly goal', 'set.notifications': 'Notifications',
    'set.notifications.d': 'Kick-off, goals & goal reminders (coming soon).',
    'set.account': 'Account', 'set.account.soon': 'Login & cloud sync coming soon.',
    'set.data': 'Data', 'set.reset': 'Reset progress', 'set.about': 'About',
    'set.version': 'Version', 'set.lang.auto': 'Automatic (device)',
    'run.edit': 'Edit run', 'run.distance': 'Distance', 'run.date': 'Date', 'run.time': 'Time',
    'gam.title': 'Your rank', 'gam.level': 'Level', 'gam.top': 'Top {pct}%',
    'gam.top.sub': 'of all challengers', 'gam.weekly': 'Weekly goal', 'gam.weekly.left': '{km} km left this week',
    'gam.weekly.done': 'Weekly goal reached! 🎉',
    'gam.m.ahead': 'Great – you’re ahead of target! 🔥',
    'gam.m.ontrack': 'Nice pace – keep it up! 💪', 'gam.m.behind': 'Time for a run – {km} km to go. 👟',
    'gam.m.start': 'Log your first run and get going! 🚀',
    'md.lineup': 'Line-up', 'md.stats': 'Stats', 'md.events': 'Timeline', 'md.info': 'Info',
    'md.probable': 'Probable line-up', 'md.coach': 'Coach', 'md.bench': 'Bench',
    'md.noLineup': 'Line-up not available yet.', 'md.noStats': 'No stats yet – match not started.',
    'md.noEvents': 'No events yet.',
    'md.demo': 'Sample values – real stats need a sports-data plan with season access.',
    'st.possession': 'Possession', 'st.shots': 'Shots', 'st.shotsOn': 'on target', 'st.passes': 'Passes',
    'st.passAcc': 'Pass accuracy', 'st.corners': 'Corners', 'st.fouls': 'Fouls', 'st.yellow': 'Yellow cards',
    'st.offsides': 'Offsides', 'st.saves': 'Saves',
    'ev.goal': 'Goal', 'ev.penalty': 'Penalty', 'ev.owngoal': 'Own goal', 'ev.yellow': 'Yellow', 'ev.red': 'Red', 'ev.subst': 'Sub',
    'pos.gk': 'GK', 'pos.def': 'DEF', 'pos.mid': 'MID', 'pos.fwd': 'FWD',
    'ch.progress': 'Progress', 'ch.history': 'History', 'ch.ach': 'Awards',
    'f.all': 'All', 'f.live': 'Live', 'f.today': 'Today', 'f.upcoming': 'Upcoming', 'f.finished': 'Finished',
    'sec.news': 'News', 'news.empty': 'No news right now.',
    'sec.scorers': 'Top scorers', 'sec.allMatches': 'All matches', 'sec.seeAll': 'See all',
    'sec.standings': 'Standings', 'sec.bracket': 'Knockout stage', 'sec.weighting': 'Count matches',
    'sec.weighting.d': 'Switch off = this match’s goals don’t count toward your target.',
    'sec.noMatches': 'No matches in this selection.',
    'grp': 'Group', 'tbl.team': 'Team', 'tbl.pl': 'P', 'tbl.diff': 'Diff', 'tbl.pts': 'Pts',
    'ch.balance': 'Your balance', 'ch.noStreak': 'no streak yet',
    'ch.trackTitle': 'Log kilometres', 'ch.trackHint': 'Add the distance you just ran.',
    'ch.addRun': 'Add run', 'today.challenge': 'Your challenge', 'today.open': 'Open',
    'auth.signin': 'Sign in', 'auth.signup': 'Sign up', 'auth.email': 'Email', 'auth.password': 'Password',
    'auth.magic': 'Send a magic link instead', 'auth.forgot': 'Forgot password?', 'auth.logout': 'Sign out',
    'auth.signedInAs': 'Signed in as', 'auth.cloudHint': 'Sign in to back up your runs & settings across devices.',
    'auth.checkEmail': 'Almost there – confirm your email address. 📧',
    'auth.magicSent': 'Magic link sent – check your email. 📧', 'auth.resetSent': 'Reset link sent. 📧',
    'auth.needFields': 'Please enter email and password.', 'auth.needEmail': 'Please enter your email first.',
    'auth.syncing': 'Syncing …', 'auth.synced': 'Cloud sync active', 'auth.busy': 'Please wait …',
    'auth.welcome': 'Cloud sync', 'auth.haveAccount': 'Already in?', 'auth.title': 'Sign in or sign up',
    'rank.title': 'Leaderboard', 'rank.players': 'of {n}', 'rank.you': 'You', 'rank.total': 'Total',
    'rank.signin': 'Sign in to join the leaderboard.',
    'gam.top.real': 'of {n} runners', 'set.nickname': 'Display name (leaderboard)',
    'set.leaderboard': 'Show on leaderboard', 'set.leaderboard.d': 'Shows your name instead of “Runner #”. Otherwise you stay anonymous.',
  },
};

/** Übersetzen mit optionalen {platzhaltern}; fällt auf DE und dann den Key zurück. */
function t(key, vars) {
  const lang = getLang();
  let s = (I18N[lang] && I18N[lang][key]) || I18N.de[key] || key;
  if (vars) for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
  return s;
}

/** <html lang> + Nav-Beschriftungen (Sprache) + Sichtbarkeit des Challenge-Tabs */
function applyNav() {
  const lang = getLang();
  document.documentElement.setAttribute('lang', lang);
  document.querySelectorAll('.nav-btn[data-tab]').forEach((btn) => {
    const span = btn.querySelector('span');
    if (span) span.textContent = t('nav.' + btn.dataset.tab);
    btn.setAttribute('aria-label', t('nav.' + btn.dataset.tab));
    if (btn.dataset.tab === 'challenge') {
      btn.classList.toggle('hidden', !state.settings.challengeEnabled);
    }
  });
}

const state = {
  loading:  true,
  data:     null,
  tab:      loadTab(),
  runs:     loadRuns(),
  disabled: new Set(load(LS.disabled, [])),   // IDs der Spiele, deren Tore NICHT zählen
  seenBadges: new Set(load(LS.badges, [])),
  selectedDay: null,                          // gewählter Kalender-Tag (startOfDay-Timestamp); null → heute
  settings: loadSettings(),                   // App-Einstellungen (Sprache, Einheit, Challenge an/aus, …)
  onboarded: load(LS.onboarded, false),       // Welcome-Screen schon gesehen?
  auth: { user: null, ready: false, syncing: false },   // Supabase-Login-Status
  community: null,                                       // Community-Ranking (vom Server)
  news: { today: null },                                // Live-News (null = noch nicht geladen)
};

function persist() {
  save(LS.runs, state.runs);
  save(LS.badges, [...state.seenBadges]);
  save(LS.disabled, [...state.disabled]);
  save(LS.tab, state.tab);
  save(LS.settings, state.settings);
  save(LS.onboarded, state.onboarded);
}

/* ------------------------------------------------------------------ *
 * 3) SELEKTOREN  (abgeleiteter Zustand)
 * ------------------------------------------------------------------ */
const team = (code) => {
  for (const g of Object.values(state.data.groups)) {
    const t = g.find((x) => x.code === code);
    if (t) return t;
  }
  return { code, name: code, flag: '🏳️' };
};

const isPlayed = (m) => m.status === 'FINISHED' || m.status === 'IN_PLAY';
const goalsOf  = (m) => isPlayed(m) ? (m.score.home || 0) + (m.score.away || 0) : 0;

/** Alle Spiele mit (Teil-)Ergebnis – Basis für Zähler & Filter */
const playedMatches = () => state.data.matches.filter(isPlayed);

/** Globaler Tor-Zähler der gesamten WM */
const totalGoals = () => playedMatches().reduce((sum, m) => sum + goalsOf(m), 0);

/** Soll-Kilometer des Nutzers = Tore aller AKTIVIERTEN Spiele */
const sollKm = () =>
  playedMatches()
    .filter((m) => !state.disabled.has(m.id))
    .reduce((sum, m) => sum + goalsOf(m), 0);

/**
 * Live-Tabelle einer Gruppe – berechnet aus den Ergebnissen (beendet + laufend).
 * Sortierung: Punkte → Tordifferenz → geschossene Tore → Name.
 */
function computeStandings(g) {
  const rows = {};
  for (const t of state.data.groups[g]) rows[t.code] = { team: t, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 };
  for (const m of state.data.matches) {
    if (m.group !== g || !isPlayed(m)) continue;
    const h = rows[m.home], a = rows[m.away];
    if (!h || !a) continue;
    const hs = m.score.home || 0, as = m.score.away || 0;
    h.P++; a.P++; h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
    if (hs > as)      { h.W++; h.Pts += 3; a.L++; }
    else if (hs < as) { a.W++; a.Pts += 3; h.L++; }
    else              { h.D++; a.D++; h.Pts++; a.Pts++; }
  }
  return Object.values(rows)
    .map((r) => ({ ...r, GD: r.GF - r.GA }))
    .sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.name.localeCompare(y.team.name));
}

/* ---- Lauf-Historie: abgeleitete Werte ---- */
const totalRan = () => Math.max(0, Math.round(state.runs.reduce((s, r) => s + r.km, 0) * 10) / 10);

const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return +d; };
const dayKey = (ts) => startOfDay(ts);

/** Tages-Streak: aufeinanderfolgende Tage mit Lauf (heute oder gestern beginnend) */
function streakDays() {
  const days = new Set(state.runs.filter((r) => r.km > 0).map((r) => dayKey(r.ts)));
  if (!days.size) return 0;
  let d = startOfDay(Date.now());
  if (!days.has(d)) d -= 86400000;                 // heute noch nichts? Streak endet ggf. gestern
  let streak = 0;
  while (days.has(d)) { streak++; d -= 86400000; }
  return streak;
}

/** Maximale Anzahl Läufe an einem einzelnen Tag (für Hattrick-Badge) */
function maxRunsPerDay() {
  const byDay = {};
  for (const r of state.runs) if (r.km > 0) byDay[dayKey(r.ts)] = (byDay[dayKey(r.ts)] || 0) + 1;
  return Object.values(byDay).reduce((m, n) => Math.max(m, n), 0);
}

/** Momentaufnahme für Badge-/Feier-Logik */
function snapshot() {
  return { ran: totalRan(), soll: sollKm(), streak: streakDays(), maxRunsPerDay: maxRunsPerDay() };
}

/* ---- Badges (Erfolge) ---- */
const BADGES = [
  { id: 'first',     icon: '👟', name: 'Erster Lauf',   desc: 'Ersten km eingetragen', test: (s) => s.ran > 0 },
  { id: 'tenk',      icon: '🔟', name: 'Zweistellig',   desc: '10 km gesamt',          test: (s) => s.ran >= 10 },
  { id: 'half',      icon: '🏃', name: 'Halbmarathon',  desc: '21,1 km gesamt',        test: (s) => s.ran >= 21.1 },
  { id: 'marathon',  icon: '🎽', name: 'Marathon',      desc: '42,2 km gesamt',        test: (s) => s.ran >= 42.2 },
  { id: 'century',   icon: '💯', name: 'Hunderter',     desc: '100 km gesamt',         test: (s) => s.ran >= 100 },
  { id: 'halfway',   icon: '⏳', name: 'Halbzeit',      desc: '50 % vom Soll',         test: (s) => s.soll > 0 && s.ran >= s.soll / 2 },
  { id: 'caughtup',  icon: '✅', name: 'Aufgeholt',     desc: 'Soll voll eingeholt',   test: (s) => s.soll > 0 && s.ran >= s.soll },
  { id: 'streak3',   icon: '🔥', name: '3-Tage-Streak', desc: '3 Tage in Folge',       test: (s) => s.streak >= 3 },
  { id: 'streak7',   icon: '🌟', name: 'Wochen-Streak', desc: '7 Tage in Folge',       test: (s) => s.streak >= 7 },
  { id: 'hattrick',  icon: '⚡', name: 'Hattrick',      desc: '3 Läufe an einem Tag',  test: (s) => s.maxRunsPerDay >= 3 },
];

/* ---- Virtuelle WM-Reise: Gastgeber-Städte mit km-Markern ---- */
const JOURNEY = [
  { city: 'Mexiko-Stadt', flag: '🇲🇽', km: 0,   note: 'Anpfiff' },
  { city: 'Guadalajara',  flag: '🇲🇽', km: 12 },
  { city: 'Monterrey',    flag: '🇲🇽', km: 24 },
  { city: 'Houston',      flag: '🇺🇸', km: 36 },
  { city: 'Dallas',       flag: '🇺🇸', km: 48 },
  { city: 'Kansas City',  flag: '🇺🇸', km: 60 },
  { city: 'Atlanta',      flag: '🇺🇸', km: 72 },
  { city: 'Miami',        flag: '🇺🇸', km: 84 },
  { city: 'Los Angeles',  flag: '🇺🇸', km: 96 },
  { city: 'San Francisco',flag: '🇺🇸', km: 108 },
  { city: 'Seattle',      flag: '🇺🇸', km: 120 },
  { city: 'Vancouver',    flag: '🇨🇦', km: 132 },
  { city: 'Toronto',      flag: '🇨🇦', km: 144 },
  { city: 'Boston',       flag: '🇺🇸', km: 156 },
  { city: 'Philadelphia', flag: '🇺🇸', km: 168 },
  { city: 'New York/NJ',  flag: '🇺🇸', km: 180, note: 'Finale 🏆' },
];

/* ------------------------------------------------------------------ *
 * 3b) GAMIFICATION  (Liga/Level, Wochenziel, Community-Einordnung)
 * ------------------------------------------------------------------ */
/** Ligen nach gelaufenen Gesamt-km. names: [de, en] */
const LEAGUES = [
  { km: 0,   icon: '🥾', names: ['Einsteiger', 'Rookie'],     color: '#94a3b8' },
  { km: 10,  icon: '🥉', names: ['Bronze', 'Bronze'],         color: '#cd7f32' },
  { km: 25,  icon: '🥈', names: ['Silber', 'Silver'],         color: '#c0c0c0' },
  { km: 50,  icon: '🥇', names: ['Gold', 'Gold'],             color: '#E4B458' },
  { km: 90,  icon: '💎', names: ['Platin', 'Platinum'],       color: '#22d3ee' },
  { km: 140, icon: '🏆', names: ['Diamant', 'Diamond'],       color: '#10B981' },
  { km: 200, icon: '👑', names: ['Legende', 'Legend'],        color: '#7C3AED' },
];

/* ---- Rang-Abzeichen als SVG (Stern → Edelstein → Krone, Farbe je Liga) ---- */
const RANK_ART = [
  { c1: '#e2e8f0', c2: '#94a3b8', glyph: 'star'  },  // Einsteiger (grau)
  { c1: '#e8a87c', c2: '#cd7f32', glyph: 'star'  },  // Bronze
  { c1: '#eef2f7', c2: '#aab4c0', glyph: 'star'  },  // Silber
  { c1: '#f6d36b', c2: '#E4B458', glyph: 'star'  },  // Gold
  { c1: '#a5f3fc', c2: '#22d3ee', glyph: 'gem'   },  // Platin
  { c1: '#6ee7b7', c2: '#10B981', glyph: 'gem'   },  // Diamant
  { c1: '#c4b5fd', c2: '#7C3AED', glyph: 'crown' },  // Legende
];
let _rbSeq = 0;
function rankBadge(idx, size) {
  const s = size || 56;
  const a = RANK_ART[idx] || RANK_ART[0];
  const id = 'rb' + (_rbSeq++);
  const glyph = a.glyph === 'crown'
    ? `<path d="M18 41 L16 26 L24 33 L32 22 L40 33 L48 26 L46 41 Z" fill="#fff"/><rect x="18" y="43.5" width="28" height="4" rx="1.5" fill="#fff"/><circle cx="32" cy="22" r="1.8" fill="#fff"/>`
    : a.glyph === 'gem'
    ? `<path d="M22 25 H42 L47 31 L32 46 L17 31 Z" fill="#fff"/><path d="M17 31 H47 M27 31 L32 46 M37 31 L32 46 M22 25 L27 31 M42 25 L37 31" stroke="${a.c2}" stroke-width="1.1" fill="none" opacity=".5"/>`
    : `<path d="M32 19 L35 27.8 L44.4 28 L37 33.6 L39.6 42.5 L32 37.2 L24.4 42.5 L27 33.6 L19.6 28 L29 27.8 Z" fill="#fff"/>`;
  // Nieten am Rand (Relief)
  let studs = '';
  for (let k = 0; k < 12; k++) { const ang = (k / 12) * Math.PI * 2; studs += `<circle cx="${(32 + 25.5 * Math.cos(ang)).toFixed(1)}" cy="${(32 + 25.5 * Math.sin(ang)).toFixed(1)}" r="1.5" fill="#fff" opacity=".45"/>`; }
  // Strahlenkranz für Top-Ligen (Platin+)
  const rays = idx >= 4 ? `<g opacity=".22">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<rect x="30.7" y="5" width="2.6" height="9" rx="1.3" fill="#fff" transform="rotate(${k * 45} 32 32)"/>`).join('')}</g>` : '';
  return `<svg viewBox="0 0 64 64" width="${s}" height="${s}" aria-hidden="true" style="display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.22))">
    <defs><radialGradient id="${id}" cx="50%" cy="36%" r="68%">
      <stop offset="0" stop-color="${a.c1}"/><stop offset="1" stop-color="${a.c2}"/></radialGradient></defs>
    <path d="M23 49 L23 62 L32 57 L41 62 L41 49 Z" fill="${a.c2}"/>
    <circle cx="32" cy="32" r="29" fill="url(#${id})"/>
    ${rays}
    <circle cx="32" cy="32" r="29" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>
    <circle cx="32" cy="32" r="23.5" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/>
    ${studs}
    <path d="M13 22 A30 30 0 0 1 51 16" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${glyph}
  </svg>`;
}

/** Aktuelle Liga + Fortschritt zur nächsten */
function leagueFor(ran) {
  let idx = 0;
  for (let i = 0; i < LEAGUES.length; i++) if (ran >= LEAGUES[i].km) idx = i;
  const cur = LEAGUES[idx], next = LEAGUES[idx + 1] || null;
  const span = next ? next.km - cur.km : 1;
  const progress = next ? Math.min(1, (ran - cur.km) / span) : 1;
  const name = cur.names[getLang() === 'en' ? 1 : 0];
  return { idx, level: idx + 1, cur, next, progress, name };
}

/** Montag-basierter Wochenstart */
function startOfWeek(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;   // Mo=0 … So=6
  d.setDate(d.getDate() - dow);
  return +d;
}

/** Gelaufene km in der laufenden Kalenderwoche */
function weeklyKm() {
  const ws = startOfWeek(Date.now());
  const km = state.runs.filter((r) => r.km > 0 && r.ts >= ws).reduce((s, r) => s + r.km, 0);
  return Math.round(km * 10) / 10;
}

/**
 * Community-Einordnung „Top X %" — Phase-1-Heuristik (lokal, ohne Server).
 * Monotone Abbildung gelaufener km → Perzentil. Wird in Phase 5 durch echte
 * Zahlen aus Supabase ersetzt (selbe Funktionssignatur).
 * Rückgabe: ganze Zahl 1..99 (kleiner = besser).
 */
function topPercent(ran) {
  if (ran <= 0) return null;
  // Ankerpunkte (km → Top-%). Dazwischen logarithmisch interpoliert.
  const anchors = [[1, 80], [5, 60], [15, 40], [30, 25], [50, 15], [90, 8], [140, 4], [200, 2], [300, 1]];
  if (ran >= anchors[anchors.length - 1][0]) return 1;
  let pct = 90;
  for (let i = 0; i < anchors.length - 1; i++) {
    const [k0, p0] = anchors[i], [k1, p1] = anchors[i + 1];
    if (ran >= k0 && ran < k1) {
      const f = (Math.log(ran) - Math.log(k0)) / (Math.log(k1) - Math.log(k0));
      pct = p0 + f * (p1 - p0);
      break;
    }
    if (ran < anchors[0][0]) { pct = anchors[0][1]; break; }
  }
  return Math.max(1, Math.min(99, Math.round(pct)));
}

/** Motivations-Text je nach Soll/Ist-Lage */
function motivationKey(ran, soll) {
  if (ran <= 0) return { key: 'gam.m.start' };
  if (soll > 0 && ran >= soll) return { key: 'gam.m.ahead' };
  const open = Math.max(0, soll - ran);
  if (open <= Math.max(2, soll * 0.15)) return { key: 'gam.m.ontrack' };
  return { key: 'gam.m.behind', vars: { km: fmtDist(open) } };
}

/** Burndown/Burnup-Daten: Soll- vs. Ist-km kumuliert über die Turniertage */
function chartData() {
  if (!state.runs.length && !playedMatches().length) return null;
  const matchTimes = state.data.matches.map((m) => +new Date(m.utcDate));
  const first = startOfDay(Math.min(...matchTimes, Date.now()));
  const last  = Math.max(startOfDay(Date.now()), ...state.runs.map((r) => startOfDay(r.ts)),
                         ...playedMatches().map((m) => startOfDay(+new Date(m.utcDate))));
  const days = [];
  for (let d = first; d <= last && days.length < 60; d += 86400000) {
    const end = d + 86400000;
    const soll = playedMatches()
      .filter((m) => !state.disabled.has(m.id) && +new Date(m.utcDate) < end)
      .reduce((s, m) => s + goalsOf(m), 0);
    const ist = Math.max(0, state.runs.filter((r) => r.ts < end).reduce((s, r) => s + r.km, 0));
    days.push({ ts: d, soll, ist });
  }
  const maxY = Math.max(1, ...days.map((p) => Math.max(p.soll, p.ist)));
  return { days, maxY };
}

/* ------------------------------------------------------------------ *
 * 4) HELFER
 * ------------------------------------------------------------------ */
const fmtKm   = (n) => (Math.round(n * 10) / 10).toLocaleString(getLang() === 'en' ? 'en-US' : 'de-DE');

/* ---- Einheiten (km ist kanonisch; Anzeige optional in Meilen) ---- */
const MI_PER_KM = 0.621371;
const uLabel  = () => (state.settings.unit === 'mi' ? 'mi' : 'km');
const fromKm  = (km) => (state.settings.unit === 'mi' ? km * MI_PER_KM : km);   // km → Anzeigeeinheit
const toKm    = (v)  => (state.settings.unit === 'mi' ? v / MI_PER_KM : v);     // Eingabe → km
const fmtDist = (km) => fmtKm(fromKm(km));                                       // Zahl in Anzeigeeinheit
const fmtDistU = (km) => `${fmtDist(km)} ${uLabel()}`;                            // Zahl + Einheit

function fmtKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
// Datum (z. B. "Sa, 14.06.2026") und Uhrzeit (z. B. "16:00") getrennt – für die Challenge-Liste
const fmtDate = (iso) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

// Live-Spielminute robust: „67'" wenn vorhanden, sonst „LIVE" (nie „undefined")
const liveMinute = (m) => (m.minute != null && m.minute !== '') ? `${m.minute}'` : 'LIVE';

const STATUS_BADGE = {
  FINISHED:  '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-ink-900/55 dark:text-ink-50/55">BEENDET</span>',
  IN_PLAY:   '<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-wm-red/15 text-wm-red"><span class="w-1.5 h-1.5 rounded-full bg-wm-red live-dot"></span>LIVE</span>',
  SCHEDULED: '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-wm-blue/10 text-wm-blue">GEPLANT</span>',
};

/* ---- Team-Wappen (echte Flaggen-/Crest-Bilder statt Emoji) ---- */
const CODE2ISO = {
  MEX:'mx', POL:'pl', KSA:'sa', AUS:'au', CAN:'ca', BEL:'be', MAR:'ma', JPN:'jp',
  USA:'us', ENG:'gb-eng', SEN:'sn', ECU:'ec', GER:'de', BRA:'br', CRO:'hr', GHA:'gh',
  FRA:'fr', NED:'nl', IRN:'ir', CRC:'cr', ESP:'es', POR:'pt', URU:'uy', KOR:'kr',
  ARG:'ar', ITA:'it', NGA:'ng', QAT:'qa', COL:'co', SUI:'ch', EGY:'eg', NZL:'nz',
  DEN:'dk', SRB:'rs', TUN:'tn', PAN:'pa', NOR:'no', AUT:'at', ALG:'dz', JAM:'jm',
  UKR:'ua', TUR:'tr', CMR:'cm', UZB:'uz', PER:'pe', PAR:'py', CIV:'ci', JOR:'jo',
  SCO:'gb-sct', WAL:'gb-wls',
};
// echtes Wappen vom Worker (football-data) bevorzugen, sonst Länderflagge via flagcdn
function crestUrl(t) {
  if (t && t.crest) return t.crest;
  const iso = t && CODE2ISO[t.code];
  return iso ? `https://flagcdn.com/w160/${iso}.png` : null;
}
function crest(t, size = 'crest-md', ring = false) {
  const cls = `crest ${size}${ring ? ' crest-ring' : ''}`;
  const url = crestUrl(t);
  if (!url) return `<span class="${cls} grid place-items-center text-base leading-none">${(t && t.flag) || '⚽️'}</span>`;
  return `<img class="${cls}" src="${url}" alt="" loading="lazy" data-emoji="${(t && t.flag) || '⚽️'}" onerror="crestErr(this)">`;
}
// Fallback, falls ein Wappen-Bild nicht lädt → Emoji-Flagge
window.crestErr = (img) => {
  const s = document.createElement('span');
  s.className = img.className + ' grid place-items-center text-base leading-none';
  s.textContent = img.dataset.emoji || '⚽️';
  img.replaceWith(s);
};

/* ------------------------------------------------------------------ *
 * 4b) WIEDERVERWENDBARE UI-BAUSTEINE (Redesign: clean & konsistent)
 * ------------------------------------------------------------------ */
/** Segmented Sub-Tab-Leiste. items: [[key,label],…] */
function segTabs(action, active, items) {
  return `<div class="seg mb-5">${items.map(([k, l]) =>
    `<button data-action="${action}" data-val="${k}" class="seg-btn press ${k === active ? 'seg-active' : ''}">${l}</button>`).join('')}</div>`;
}
/** Horizontale Filter-Chips. items: [[key,label],…] */
function chipRow(action, active, items) {
  return `<div class="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 mb-4">${items.map(([k, l]) =>
    `<button data-action="${action}" data-val="${k}" class="chip press ${k === active ? 'chip-active' : ''}">${l}</button>`).join('')}</div>`;
}
/** Konsistenter Sektions-Titel mit optionaler Aktion rechts */
function sectionTitle(title, right) {
  return `<div class="flex items-center justify-between mb-2.5 px-1">
    <h3 class="text-[13px] font-bold tracking-wide uppercase text-ink-900/45 dark:text-ink-50/45">${title}</h3>${right || ''}</div>`;
}

/* In-Screen-Navigationszustand (nicht persistiert – Default beim Start) */
let challengeTab   = 'progress';   // 'progress' | 'history' | 'ach'
let scheduleFilter = 'all';        // 'all' | 'live' | 'today' | 'upcoming' | 'finished'
let standingsGroup = 'all';        // 'all' | 'A' … 'L'

/* ------------------------------------------------------------------ *
 * 5) RENDER  ·  SCREEN 1: TICKER
 * ------------------------------------------------------------------ */
/** Einzelne, antippbare Spielzeile (öffnet Detail-Sheet) */
function matchRow(m) {
  const h = team(m.home), a = team(m.away);
  const played = isPlayed(m), live = m.status === 'IN_PLAY';
  const center = played
    ? `<div class="score text-[20px] ${live ? 'text-wm-red' : ''}">${m.score.home}<span class="opacity-25 mx-1.5">:</span>${m.score.away}</div>`
    : `<div class="text-[14px] font-bold text-ink-900/55 dark:text-ink-50/55 tabular-nums">${fmtTime(m.utcDate)}</div>`;
  const sub = live ? `<span class="text-wm-red font-bold">${liveMinute(m)}</span>`
    : (played ? `<span class="text-ink-900/35 dark:text-ink-50/35">Endstand</span>`
    : `<span class="text-ink-900/35 dark:text-ink-50/35">${fmtKickoff(m.utcDate).split(',')[0]}</span>`);
  return `
    <button data-action="open-match" data-id="${m.id}" class="w-full flex items-center gap-2 px-4 py-3 text-left press">
      <div class="flex-1 flex items-center justify-end gap-2.5 min-w-0 text-right">
        <span class="text-[14px] font-semibold truncate">${h.name}</span>${crest(h, 'crest-sm')}
      </div>
      <div class="shrink-0 min-w-[68px] text-center">${center}<div class="text-[10px] mt-0.5">${sub}</div></div>
      <div class="flex-1 flex items-center gap-2.5 min-w-0">${crest(a, 'crest-sm')}<span class="text-[14px] font-semibold truncate">${a.name}</span></div>
    </button>`;
}

/* ===================== SCREEN: SPIELPLAN ===================== */
const today0 = () => startOfDay(Date.now());
function matchPassesFilter(m, f) {
  if (f === 'live') return m.status === 'IN_PLAY';
  if (f === 'today') return startOfDay(+new Date(m.utcDate)) === today0();
  if (f === 'upcoming') return m.status === 'SCHEDULED';
  if (f === 'finished') return m.status === 'FINISHED';
  return true;
}

function viewSchedule() {
  const f = scheduleFilter;
  const chips = chipRow('sched-filter', f, [
    ['all', t('f.all')], ['live', t('f.live')], ['today', t('f.today')], ['upcoming', t('f.upcoming')], ['finished', t('f.finished')],
  ]);

  const groupsHtml = Object.keys(state.data.groups).map((g) => {
    const matches = state.data.matches
      .filter((m) => m.group === g && matchPassesFilter(m, f))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    if (!matches.length) return '';
    const rows = matches.map(matchRow).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');
    return `
      <section class="fade-up">
        ${sectionTitle(`${t('grp')} ${g}`)}
        <div class="rounded-xl2 glass-card overflow-hidden cv">${rows}</div>
      </section>`;
  }).join('');

  return `<div>
    ${chips}
    <div class="stagger space-y-6">
      ${groupsHtml || `<div class="rounded-xl2 glass-card p-8 text-center text-[13px] text-ink-900/45 dark:text-ink-50/45">${t('sec.noMatches')}</div>`}
    </div>
  </div>`;
}

/* ===================== SCREEN: HEUTE (Übersicht) ===================== */
function viewToday() {
  const liveMatches = state.data.matches
    .filter((m) => m.status === 'IN_PLAY')
    .sort((a, b) => (b.minute || 0) - (a.minute || 0));

  // EINE große Kachel: läuft ein Spiel → Live-Score, sonst → Countdown zum nächsten Spiel
  const heroLive = liveMatches[0] || null;
  const next = nextMatch();
  const lastFinished = state.data.matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))[0] || null;
  const bigTile = heroLive ? heroCard(heroLive) : (next ? countdownCard(next) : heroCard(lastFinished));

  // Weitere parallel laufende Spiele (das große oben ist hier ausgenommen → keine Doppelung)
  const others = liveMatches.slice(1);
  const liveStrip = others.length ? `
    <section>
      <div class="flex items-center gap-2 mb-2 px-1">
        <span class="w-2 h-2 rounded-full bg-wm-red live-dot"></span>
        <h3 class="text-[13px] font-bold tracking-wide text-ink-900/55 dark:text-ink-50/55">WEITERE LIVE-SPIELE</h3>
      </div>
      <div class="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1">
        ${others.map((m) => {
          const h = team(m.home), a = team(m.away);
          return `<button data-action="open-match" data-id="${m.id}" class="press shrink-0 w-[150px] rounded-xl2 glass-card p-3 text-left">
            <div class="flex items-center justify-between mb-2">
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-wm-red"><span class="w-1.5 h-1.5 rounded-full bg-wm-red live-dot"></span>${liveMinute(m)}</span>
              <span class="text-[10px] text-ink-900/40 dark:text-ink-50/40">Gr. ${m.group}</span>
            </div>
            <div class="flex items-center gap-2 mb-1.5">${crest(h, 'crest-sm')}<span class="text-[13px] font-semibold truncate flex-1">${h.name}</span><span class="score text-[15px]">${m.score.home}</span></div>
            <div class="flex items-center gap-2">${crest(a, 'crest-sm')}<span class="text-[13px] font-semibold truncate flex-1">${a.name}</span><span class="score text-[15px]">${m.score.away}</span></div>
          </button>`;
        }).join('')}
      </div>
    </section>` : '';

  return `<div class="stagger space-y-6">
    ${bigTile}
    ${liveStrip}
    ${state.settings.challengeEnabled ? challengeSnapshot() : ''}
    ${dayPicker()}
    ${sectionScorers(3, true)}
    ${newsSection()}
  </div>`;
}

/** Kalender-Streifen (Wochentag + Datum) + Spiele des gewählten Tages */
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS   = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function dayPicker() {
  const today0 = startOfDay(Date.now());

  // Alle Tage mit Spielen (Historie + Zukunft) + heute, aufsteigend sortiert
  const daySet = new Set(state.data.matches.map((m) => startOfDay(+new Date(m.utcDate))));
  daySet.add(today0);
  const days = [...daySet].sort((a, b) => a - b);

  // Gewählter Tag (Default heute), auf einen gültigen Tag begrenzen
  let sel = state.selectedDay ?? today0;
  if (!daySet.has(sel)) sel = today0;

  const matchesOn = (ts) =>
    state.data.matches.filter((m) => startOfDay(+new Date(m.utcDate)) === ts);

  const pills = days.map((ts) => {
    const d = new Date(ts);
    const active = ts === sel;
    const isToday = ts === today0;
    const count = matchesOn(ts).length;
    return `
      <button data-action="select-day" data-day="${ts}" ${active ? 'data-active="1"' : ''}
        class="press shrink-0 w-[60px] py-2.5 rounded-2xl flex flex-col items-center gap-0.5 ${active ? 'cal-active text-white' : 'glass-card'}">
        <span class="text-[10px] font-bold uppercase tracking-wide ${active ? 'text-white/80' : 'text-ink-900/45 dark:text-ink-50/45'}">${WEEKDAYS[d.getDay()]}</span>
        <span class="text-[20px] font-extrabold leading-none">${d.getDate()}</span>
        <span class="text-[9px] font-medium ${active ? 'text-white/70' : 'text-ink-900/35 dark:text-ink-50/35'}">${MONTHS[d.getMonth()]}</span>
        <span class="mt-1 w-1.5 h-1.5 rounded-full ${count ? (active ? 'bg-white/85' : 'bg-wm-emerald') : 'bg-transparent'}"></span>
        ${isToday ? `<span class="text-[8px] font-bold leading-none ${active ? 'text-white/85' : 'text-wm-emerald'}">HEUTE</span>` : ''}
      </button>`;
  }).join('');

  const dayMatches = matchesOn(sel).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const selD = new Date(sel);
  const heading = sel === today0 ? 'HEUTE' : `${WEEKDAYS[selD.getDay()]}, ${selD.getDate()}. ${MONTHS[selD.getMonth()]}`;

  const list = dayMatches.length
    ? `<div class="rounded-xl2 glass-card overflow-hidden cv">${dayMatches.map(matchRow).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>')}</div>`
    : `<div class="rounded-xl2 glass-card p-6 text-center text-[13px] text-ink-900/45 dark:text-ink-50/45">Keine Spiele an diesem Tag</div>`;

  return `
    <section>
      <div class="flex items-end justify-between mb-2 px-1">
        <h3 class="text-[13px] font-bold tracking-wide text-ink-900/45 dark:text-ink-50/45">SPIELE · ${heading}</h3>
        ${dayMatches.length ? `<span class="text-[12px] text-ink-900/35 dark:text-ink-50/35">${dayMatches.length} ${dayMatches.length === 1 ? 'Spiel' : 'Spiele'}</span>` : ''}
      </div>
      <div id="day-strip" class="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 mb-3">${pills}</div>
      ${list}
    </section>`;
}

/** Große Countdown-Kachel zum nächsten Spiel (Pitch-Verlauf) */
/** Große, dezente Wappen als Wasserzeichen hinter Hero-Cards (echte Crests) */
function heroWatermarks(h, a) {
  const img = (t, style) => { const u = crestUrl(t); return u ? `<img src="${u}" alt="" loading="lazy" aria-hidden="true" class="absolute pointer-events-none select-none" style="${style};width:152px;height:152px;object-fit:contain;opacity:.09">` : ''; };
  return img(h, 'left:-36px;top:-28px;') + img(a, 'right:-36px;bottom:-24px;');
}

function countdownCard(next) {
  if (!next) return '';
  return `
    <section>
      <div class="hero-spot rounded-xl3 pitch-grad text-white shadow-card p-6 relative overflow-hidden">
        <div class="absolute inset-0 opacity-[0.06]" style="background-image:radial-gradient(circle at 1px 1px,#fff 1px,transparent 0);background-size:22px 22px"></div>
        ${heroWatermarks(team(next.home), team(next.away))}
        ${pitchLines()}
        <div class="relative">
          <p class="text-[11px] font-bold tracking-widest uppercase text-wm-lime mb-3">Nächstes Spiel · in</p>
          <div id="countdown" data-target="${+new Date(next.utcDate)}" class="cd-num text-[38px] leading-none mb-4">––:––:––</div>
          <div class="flex items-center justify-center gap-3">
            <div class="flex items-center gap-2.5 flex-1 justify-end min-w-0"><span class="text-[14px] font-semibold truncate">${team(next.home).name}</span><div class="w-12 h-12 shrink-0 rounded-full grid place-items-center glass-chip">${crest(team(next.home), 'crest-md')}</div></div>
            <span class="text-[13px] font-bold text-white/50">vs</span>
            <div class="flex items-center gap-2.5 flex-1 min-w-0"><div class="w-12 h-12 shrink-0 rounded-full grid place-items-center glass-chip">${crest(team(next.away), 'crest-md')}</div><span class="text-[14px] font-semibold truncate">${team(next.away).name}</span></div>
          </div>
          <p class="text-center text-[11px] text-white/55 mt-4">${fmtKickoff(next.utcDate)} Uhr · Gruppe ${next.group}</p>
        </div>
      </div>
    </section>`;
}

/** Kompakte Challenge-Bilanz auf „Heute" + Brücke zur Challenge */
function challengeSnapshot() {
  const soll = sollKm(), ist = totalRan(), open = Math.max(0, soll - ist);
  const pct = soll > 0 ? Math.min(1, ist / soll) : 0;
  const done = soll > 0 && ist >= soll, en = getLang() === 'en';
  return `
    <section>
      <button data-action="switch-tab" data-tab="challenge" class="press w-full text-left rounded-xl2 glass-card p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[15px] font-bold">${t('today.challenge')}</h3>
          <span class="text-[12px] font-semibold text-wm-emerald">${t('today.open')} →</span>
        </div>
        <div class="flex items-end gap-4">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-900/40 dark:text-ink-50/40">${done ? (en ? 'Done' : 'Geschafft') : (en ? 'Open' : 'Noch offen')}</p>
            <p class="score text-[40px] leading-none ${done ? 'text-wm-emerald' : ''}">${fmtDist(open)}<span class="text-[15px] font-semibold text-ink-900/40 dark:text-ink-50/40 ml-1">${uLabel()}</span></p>
          </div>
          <div class="flex-1 pb-1">
            <div class="flex justify-between text-[11px] text-ink-900/45 dark:text-ink-50/45 mb-1"><span>${fmtDistU(ist)}</span><span>${fmtDistU(soll)}</span></div>
            <div class="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
              <div class="bar-fill h-full rounded-full" style="width:${(pct * 100).toFixed(1)}%;background:linear-gradient(90deg,#10B981,#34C759)"></div>
            </div>
          </div>
        </div>
      </button>
    </section>`;
}

/** Nächstes geplantes Spiel (für Countdown) */
function nextMatch() {
  return state.data.matches
    .filter((m) => m.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0] || null;
}

/* ===================== SCREEN: TABELLE (Gruppen + K.o.-Baum) ===================== */
function viewTable() {
  return `<div class="stagger space-y-6">
    ${viewStandings()}
    ${sectionBracket()}
    ${sectionScorers()}
  </div>`;
}

/** Große Live-Score-Kachel (Pitch-Verlauf) für ein konkretes Spiel */
function heroCard(m) {
  if (!m) return '';
  const h = team(m.home), a = team(m.away);
  const live = m.status === 'IN_PLAY', played = isPlayed(m);
  const label = live ? 'LIVE JETZT' : (played ? 'ZULETZT' : 'NÄCHSTES SPIEL');
  const topRight = live
    ? `<span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-wm-red text-white"><span class="w-1.5 h-1.5 rounded-full bg-white live-dot"></span>${liveMinute(m)}</span>`
    : `<span class="glass-chip text-[11px] font-semibold text-white/85 px-2.5 py-1 rounded-full">${played ? 'Endstand' : fmtKickoff(m.utcDate)}</span>`;
  const center = played
    ? `<div class="score text-[46px] leading-none">${m.score.home}<span class="opacity-40 mx-2">:</span>${m.score.away}</div>`
    : `<div class="text-3xl font-extrabold text-white/85">VS</div>`;
  const crestGlass = (t) => `<div class="w-16 h-16 shrink-0 rounded-full grid place-items-center glass-chip">${crest(t, 'crest-lg')}</div>`;

  return `
    <button data-action="open-match" data-id="${m.id}" class="press hero-spot block w-full text-left pitch-grad rounded-xl3 p-6 text-white shadow-card relative overflow-hidden">
      <div class="absolute inset-0 opacity-[0.06]" style="background-image:radial-gradient(circle at 1px 1px,#fff 1px,transparent 0);background-size:22px 22px"></div>
      ${heroWatermarks(h, a)}
      ${pitchLines()}
      <div class="relative">
        <div class="flex items-center justify-between mb-5">
          <span class="text-[11px] font-bold tracking-widest uppercase text-wm-lime">${label}</span>
          ${topRight}
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 flex flex-col items-center gap-2.5 text-center min-w-0">
            ${crestGlass(h)}
            <span class="text-[13px] font-semibold truncate w-full">${h.name}</span>
          </div>
          <div class="shrink-0 text-center px-1">${center}</div>
          <div class="flex-1 flex flex-col items-center gap-2.5 text-center min-w-0">
            ${crestGlass(a)}
            <span class="text-[13px] font-semibold truncate w-full">${a.name}</span>
          </div>
        </div>
        <div class="mt-5 flex items-center justify-center gap-2 text-[11px] text-white/55">
          <span>Gruppe ${m.group}</span><span>·</span><span>Tippen für Details</span>
        </div>
      </div>
    </button>`;
}

/** Dezente, generierte Stadion-/Spielfeld-Linien (SVG) als Hero-Untergrund */
function pitchLines() {
  return `<svg class="absolute bottom-0 inset-x-0 w-full opacity-[0.10]" height="90" viewBox="0 0 400 90" preserveAspectRatio="none" fill="none" stroke="#fff" stroke-width="1.5">
    <path d="M200 -40 a60 60 0 0 1 0 120" /><line x1="200" y1="0" x2="200" y2="90"/>
    <rect x="140" y="74" width="120" height="60" rx="2"/><rect x="172" y="84" width="56" height="40" rx="2"/>
  </svg>`;
}

/** Alle Gruppentabellen (live aus Ergebnissen berechnet) + Gruppen-Chips */
function viewStandings() {
  const allGroups = Object.keys(state.data.groups);
  if (!allGroups.includes(standingsGroup) && standingsGroup !== 'all') standingsGroup = 'all';
  const chips = chipRow('standings-group', standingsGroup,
    [['all', t('f.all')], ...allGroups.map((g) => [g, g])]);
  const groups = standingsGroup === 'all' ? allGroups : [standingsGroup];

  const tables = groups.map((g) => {
    const rows = computeStandings(g).map((r, i) => {
      const qual = i < 2;   // Top 2 = sicher weiter (3. teils auch, hier vereinfacht)
      return `
        <tr class="${qual ? 'bg-wm-green/[0.06]' : ''}">
          <td class="py-2 pl-3 pr-1 text-[12px] tabular-nums ${qual ? 'text-wm-green font-bold' : 'text-ink-900/45 dark:text-ink-50/45'}">${i + 1}</td>
          <td class="py-2 pr-2">
            <div class="flex items-center gap-2 min-w-0">
              ${crest(r.team, 'crest-sm')}
              <span class="text-[13px] font-medium truncate">${r.team.name}</span>
            </div>
          </td>
          <td class="py-2 px-1 text-center text-[12px] tabular-nums text-ink-900/55 dark:text-ink-50/55">${r.P}</td>
          <td class="py-2 px-1 text-center text-[12px] tabular-nums text-ink-900/55 dark:text-ink-50/55">${r.GD > 0 ? '+' : ''}${r.GD}</td>
          <td class="py-2 pl-1 pr-3 text-center text-[13px] font-bold tabular-nums">${r.Pts}</td>
        </tr>`;
    }).join('');

    return `
      <section class="fade-up">
        ${sectionTitle(`${t('grp')} ${g}`)}
        <div class="rounded-xl2 glass-card overflow-hidden cv">
          <table class="w-full border-collapse">
            <thead>
              <tr class="text-[10px] font-semibold uppercase tracking-wide text-ink-900/35 dark:text-ink-50/35">
                <th class="py-1.5 pl-3 pr-1 text-left font-semibold">#</th>
                <th class="py-1.5 text-left font-semibold">${t('tbl.team')}</th>
                <th class="py-1.5 px-1 text-center font-semibold">${t('tbl.pl')}</th>
                <th class="py-1.5 px-1 text-center font-semibold">${t('tbl.diff')}</th>
                <th class="py-1.5 pl-1 pr-3 text-center font-semibold">${t('tbl.pts')}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');

  return `<div>${chips}<div class="space-y-6">${tables}</div></div>`;
}

/** Torschützenliste – nur sichtbar, wenn der Worker echte Scorer-Daten liefert.
 *  limit = Anzahl (Default 10); seeAll = „Alle anzeigen"-Link zur Tabelle. */
function sectionScorers(limit, seeAll) {
  const scorers = Array.isArray(state.data.scorers) ? state.data.scorers : [];
  if (!scorers.length) return '';
  const goalsLabel = getLang() === 'en' ? 'goals' : 'Tore';
  const rows = scorers.slice(0, limit || 10).map((s, i) => `
    <div class="flex items-center gap-3 px-4 py-2.5">
      <span class="w-5 text-center text-[13px] font-bold tabular-nums ${i === 0 ? 'text-wm-gold' : 'text-ink-900/40 dark:text-ink-50/40'}">${i + 1}</span>
      <span class="text-lg leading-none">${s.flag || '⚽️'}</span>
      <div class="flex-1 min-w-0">
        <p class="text-[14px] font-medium truncate">${s.name}</p>
        <p class="text-[11px] text-ink-900/45 dark:text-ink-50/45 truncate">${s.team || ''}</p>
      </div>
      <span class="text-[15px] font-bold tabular-nums">${s.goals}<span class="text-[11px] font-normal text-ink-900/40 dark:text-ink-50/40 ml-0.5">${goalsLabel}</span></span>
    </div>`).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

  const right = seeAll
    ? `<button data-action="switch-tab" data-tab="table" class="text-[12px] font-semibold text-wm-emerald press">${t('sec.seeAll')} →</button>`
    : '';
  return `
    <section>
      ${sectionTitle('⚽️ ' + t('sec.scorers'), right)}
      <div class="rounded-xl2 glass-card overflow-hidden">${rows}</div>
    </section>`;
}

/* ------------------------------------------------------------------ *
 * 5c) LIVE-NEWS  (Google News RSS über den Worker, Edge-gecacht)
 * ------------------------------------------------------------------ */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function timeAgo(iso) {
  const t0 = +new Date(iso);
  if (isNaN(t0)) return '';
  const s = Math.max(0, (Date.now() - t0) / 1000), en = getLang() === 'en';
  if (s < 3600) { const m = Math.max(1, Math.round(s / 60)); return en ? `${m}m ago` : `vor ${m} Min`; }
  if (s < 86400) { const h = Math.round(s / 3600); return en ? `${h}h ago` : `vor ${h} Std`; }
  const d = Math.round(s / 86400); return en ? `${d}d ago` : `vor ${d} Tg`;
}

async function fetchNews(q, lite) {
  if (!CONFIG.apiBase) return [];
  try {
    const r = await fetch(`${CONFIG.apiBase}/api/news?q=${encodeURIComponent(q)}&lang=${getLang()}${lite ? '&lite=1' : ''}`);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.items) ? d.items : [];
  } catch { return []; }
}

/* ---- Listen-Darstellung (Spiel-Detail / Info-Tab) ---- */
function newsRows(items) {
  return items.map((it) => {
    const meta = [it.source, timeAgo(it.published)].filter(Boolean).map(esc).join(' · ');
    const safeLink = /^https?:\/\//i.test(it.link || '') ? it.link : '#';
    return `<a href="${esc(safeLink)}" target="_blank" rel="noopener noreferrer" class="press block px-4 py-3">
      <p class="text-[14px] font-semibold leading-snug">${esc(it.title)}</p>
      ${meta ? `<p class="text-[11px] text-ink-900/45 dark:text-ink-50/45 mt-1">${meta}</p>` : ''}
    </a>`;
  }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');
}

/* ---- Swipe-Carousel (Heute): Foto, Headline, Intro, „mehr dazu →" ---- */
const faviconUrl = (sourceUrl) => {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(sourceUrl).hostname}&sz=128`; }
  catch { return ''; }
};
function newsCard(it) {
  const meta = [esc(it.source), timeAgo(it.published)].filter(Boolean).join(' · ');
  const safe = /^https?:\/\//i.test(it.link || '') ? it.link : '#';
  const more = getLang() === 'en' ? 'more' : 'mehr dazu';
  const fav = it.sourceUrl ? faviconUrl(it.sourceUrl) : '';
  // Bild-Bereich: echtes Foto (GNews) → sonst Quelle-Logo auf Gradient → sonst nur Gradient
  const media = it.image
    ? `<img src="${esc(it.image)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover" onerror="this.remove()">`
    : (fav ? `<div class="absolute inset-0 grid place-items-center"><img src="${esc(fav)}" alt="" loading="lazy" class="w-12 h-12 rounded-xl bg-white/90 p-1.5 shadow" onerror="this.remove()"></div>` : '');
  return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer"
    class="snap-start shrink-0 w-[80%] max-w-[320px] rounded-xl2 glass-card overflow-hidden press flex flex-col">
    <div class="relative w-full h-36" style="background:linear-gradient(135deg,#10B981,#047857)">
      ${media}
      ${it.source ? `<span class="absolute top-2 left-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style="background:rgba(0,0,0,.5)">${esc(it.source)}</span>` : ''}
    </div>
    <div class="p-4 flex-1 flex flex-col">
      <p class="text-[15px] font-bold leading-snug clamp-2">${esc(it.title)}</p>
      ${it.intro ? `<p class="text-[12px] text-ink-900/55 dark:text-ink-50/55 leading-snug mt-1.5 clamp-2">${esc(it.intro)}</p>` : ''}
      <div class="mt-auto pt-3 flex items-center justify-between gap-2">
        <span class="text-[11px] text-ink-900/40 dark:text-ink-50/40 truncate">${meta}</span>
        <span class="text-[12px] font-semibold text-wm-emerald whitespace-nowrap">${more} →</span>
      </div>
    </div>
  </a>`;
}

/** News-Carousel auf „Heute" (horizontal swipebar) */
function newsSection() {
  if (!CONFIG.apiBase) return '';
  const items = state.news.today;
  if (items === null) {   // lädt noch
    return `<section>${sectionTitle('📰 ' + t('sec.news'))}
      <div class="flex gap-3 -mx-5 px-5 scroll-pl-5"><div class="skeleton rounded-xl2 shrink-0 w-[80%] max-w-[320px]" style="height:280px"></div></div></section>`;
  }
  if (!items.length) return '';   // keine News → Sektion ausblenden
  return `<section>${sectionTitle('📰 ' + t('sec.news'))}
    <div class="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-pl-5 -mx-5 px-5 pb-2">${items.map(newsCard).join('')}</div>
  </section>`;
}

let _newsBusy = false;
async function maybeLoadTodayNews() {
  if (state.news.today !== null || _newsBusy || !CONFIG.apiBase) return;
  _newsBusy = true;
  const q = getLang() === 'en' ? 'FIFA World Cup 2026' : 'Fußball WM 2026';
  state.news.today = await fetchNews(q);
  _newsBusy = false;
  if (state.tab === 'today') render();
}

/** Team-News im Spiel-Detail (Info-Tab) nachladen */
async function loadMatchNews(m) {
  if (m._news !== undefined) return;   // undefined=nie geladen, null=lädt, []/[…]=fertig
  m._news = null;
  const items = await fetchNews(`${team(m.home).name} ${team(m.away).name}`, true);   // lite=RSS
  m._news = items;
  if (currentSheetMatch === m && matchSheetTab === 'info') renderSheetContent();
}

/* ---- K.o.-Baum (Knockout) ---- */
const KO_STAGES = [
  ['LAST_32', 'Sechzehntelfinale'],
  ['LAST_16', 'Achtelfinale'],
  ['QUARTER_FINALS', 'Viertelfinale'],
  ['SEMI_FINALS', 'Halbfinale'],
  ['THIRD_PLACE', 'Spiel um Platz 3'],
  ['FINAL', 'Finale'],
];

function sectionBracket() {
  const ko = state.data.matches.filter((m) => KO_STAGES.some(([k]) => k === m.stage));

  if (!ko.length) {
    const en = getLang() === 'en';
    return `
      <div class="rounded-xl2 glass-card p-6 text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full grid place-items-center text-2xl" style="background:linear-gradient(135deg,#10B981,#059669)">🏆</div>
        <h3 class="text-[15px] font-bold mb-1">${t('sec.bracket')}</h3>
        <p class="text-[13px] text-ink-900/50 dark:text-ink-50/50 leading-relaxed">
          ${en
            ? 'The knockout stage starts after the group phase.<br>32 teams advance – up to the final on 19 July 2026 in New York/NJ. 🇺🇸'
            : 'Die K.-o.-Phase startet nach der Gruppenphase.<br>32 Teams ziehen weiter – bis zum Finale am 19. Juli 2026 in New York/NJ. 🇺🇸'}
        </p>
      </div>`;
  }

  const rounds = KO_STAGES.map(([key, label]) => {
    const ms = ko.filter((m) => m.stage === key).sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    if (!ms.length) return '';
    return `
      <section>
        ${sectionTitle(label)}
        <div class="rounded-xl2 glass-card overflow-hidden cv">
          ${ms.map(matchRow).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>')}
        </div>
      </section>`;
  }).join('');

  return `<div class="space-y-6">${rounds}</div>`;
}

/* ------------------------------------------------------------------ *
 * 6) RENDER  ·  SCREEN 2: CHALLENGE  (Sub-Tabs: Fortschritt/Verlauf/Erfolge)
 * ------------------------------------------------------------------ */
/** Fortschrittsring + Soll/Ist/Quote */
/** Plain Rang-Header (Badge + Name + Fortschrittsbalken zur nächsten Liga) */
function rankHeader(ist) {
  const lg = leagueFor(ist), en = getLang() === 'en';
  const comm = state.community, useServer = !!(comm && comm.total_players >= 3 && comm.percentile != null);
  const pct = useServer ? comm.percentile : topPercent(ist);
  const nextTxt = lg.next
    ? `${en ? 'next' : 'nächste'}: ${lg.next.names[en ? 1 : 0]} ${en ? 'at' : 'ab'} ${fmtDistU(lg.next.km)}`
    : (en ? 'max level reached 🏁' : 'Maximal-Level 🏁');
  return `<div class="flex items-center gap-4 px-1 mb-6">
    <div class="shrink-0">${rankBadge(lg.idx, 66)}</div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <p class="font-display text-[22px] font-extrabold leading-tight truncate" style="color:${lg.cur.color}">${lg.name}</p>
        ${pct != null ? `<span class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-wm-emerald/12 text-wm-emerald">${t('gam.top', { pct })}</span>` : ''}
      </div>
      <div class="mt-2 h-2.5 rounded-full bg-black/[0.07] dark:bg-white/[0.10] overflow-hidden">
        <div class="bar-fill h-full rounded-full" style="width:${(lg.progress * 100).toFixed(1)}%;background:linear-gradient(90deg,${lg.cur.color},#10B981)"></div>
      </div>
      <p class="text-[11px] mt-1.5 text-ink-900/45 dark:text-ink-50/45 truncate">${fmtDistU(ist)} · ${nextTxt}</p>
    </div>
  </div>`;
}

/** Kompakte Bilanz: kleiner Ring + nur das Nötigste */
function challengeRingCard() {
  const soll = sollKm(), ist = totalRan(), open = Math.max(0, soll - ist);
  const pct = soll > 0 ? Math.min(1, ist / soll) : 0, streak = streakDays();
  const R = 84, C = 2 * Math.PI * R, offset = C * (1 - pct), done = soll > 0 && ist >= soll, en = getLang() === 'en';
  return `
    <div class="rounded-xl2 glass-card p-4 mb-5 flex items-center gap-4">
      <div class="relative shrink-0 grid place-items-center" style="width:116px;height:116px">
        <svg width="116" height="116" viewBox="0 0 200 200" class="-rotate-90">
          <circle class="ring-track" cx="100" cy="100" r="${R}" fill="none" stroke-width="18"/>
          <circle id="ring-value" class="ring-value" cx="100" cy="100" r="${R}" fill="none" stroke-width="18"
                  stroke="${done ? '#34C759' : '#E4B458'}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
        </svg>
        <div class="absolute inset-0 grid place-content-center text-center">
          <p id="c-open" class="score text-[28px] leading-none ${done ? 'text-wm-green' : ''}">${fmtDist(open)}</p>
          <p class="text-[10px] text-ink-900/45 dark:text-ink-50/45">${done ? (en ? 'done 🎉' : 'fertig 🎉') : uLabel()}</p>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-[14px] font-bold">${t('ch.balance')}</h3>
          ${streak > 0 ? `<span class="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-full bg-wm-red/10 text-wm-red"><span class="flame">🔥</span>${streak}</span>` : ''}
        </div>
        <p class="text-[13px] text-ink-900/55 dark:text-ink-50/55 leading-snug">${done ? (en ? 'All goals run! 🎉' : 'Alles gelaufen! 🎉') : `${en ? 'still' : 'noch'} <b class="text-ink-900 dark:text-ink-50">${fmtDistU(open)}</b> ${en ? 'to go' : 'übrig'}`}</p>
        <p class="text-[12px] text-ink-900/45 dark:text-ink-50/45 mt-1 tabular-nums">${fmtDistU(ist)} / ${fmtDistU(soll)} · ${Math.round(pct * 100)} %</p>
      </div>
    </div>`;
}

/** Kilometer-Eingabe — aufgeräumt: Feld + Quick-Adds */
function kmTrackerCard() {
  return `
    <div class="rounded-xl2 glass-card p-5 mb-5">
      <h3 class="text-[14px] font-bold mb-3">${t('ch.trackTitle')}</h3>
      <form data-action="submit-km" class="flex items-center gap-2">
        <div class="relative flex-1">
          <input id="km-input" type="number" inputmode="decimal" step="0.1" min="0" placeholder="0"
                 class="w-full px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[18px] font-bold tabular-nums outline-none focus:ring-2 ring-wm-emerald/40 placeholder:text-ink-900/25 dark:placeholder:text-ink-50/25"/>
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-900/35 dark:text-ink-50/35">${uLabel()}</span>
        </div>
        <button data-action="submit-km-btn" type="button" aria-label="${t('ch.addRun')}"
                class="press shrink-0 w-12 h-12 rounded-xl grid place-items-center text-white text-2xl font-light shadow-glow"
                style="background:linear-gradient(135deg,#10B981,#059669)">+</button>
      </form>
      <div class="grid grid-cols-4 gap-2 mt-3">${quickBtn(0.5)} ${quickBtn(1)} ${quickBtn(3)} ${quickBtn(5)}</div>
    </div>`;
}

/** Wochenziel (kompakt) */
function weeklyGoalCard() {
  const goal = Math.max(1, Number(state.settings.weeklyGoalKm) || DEFAULT_SETTINGS.weeklyGoalKm);
  const wk = weeklyKm(), wkPct = Math.min(1, wk / goal), wkDone = wk >= goal;
  return `<div class="rounded-xl2 glass-card p-5 mb-5">
    <div class="flex items-center justify-between mb-1.5">
      <h3 class="text-[14px] font-bold">${t('gam.weekly')}</h3>
      <span class="text-[12px] font-bold tabular-nums ${wkDone ? 'text-wm-green' : 'text-ink-900/55 dark:text-ink-50/55'}">${fmtDist(wk)} / ${fmtDistU(goal)}</span>
    </div>
    <div class="h-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
      <div class="bar-fill h-full rounded-full" style="width:${(wkPct * 100).toFixed(1)}%;background:linear-gradient(90deg,#10B981,#34C759)"></div>
    </div>
    <p class="text-[12px] mt-2 font-medium ${wkDone ? 'text-wm-green' : 'text-ink-900/55 dark:text-ink-50/55'}">${wkDone ? t('gam.weekly.done') : t('gam.weekly.left', { km: fmtDist(Math.max(0, goal - wk)) })}</p>
  </div>`;
}

/** „Spiele werten" (welche Partien zählen zum Soll) */
function matchWeightingCard() {
  const en = getLang() === 'en';
  const filterRows = playedMatches()
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .map((m) => {
      const h = team(m.home), a = team(m.away);
      const on = !state.disabled.has(m.id), g = goalsOf(m);
      return `
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 text-[14px] font-medium">
              ${crest(h, 'crest-sm')}<span class="truncate">${h.name}</span>
              <span class="score text-[15px] mx-0.5">${m.score.home}:${m.score.away}</span>
              <span class="truncate">${a.name}</span>${crest(a, 'crest-sm')}
            </div>
            <div class="flex items-center gap-1.5 text-[11px] mt-0.5 text-ink-900/45 dark:text-ink-50/45">
              <span class="tabular-nums">${fmtDate(m.utcDate)} · ${fmtTime(m.utcDate)}${en ? '' : ' Uhr'}</span>
              ${m.status === 'IN_PLAY' ? `<span class="text-wm-red font-semibold">· ${liveMinute(m)}</span>` : ''}
            </div>
            <div class="text-[11px] mt-0.5 ${on ? 'text-wm-green' : 'text-ink-900/35 dark:text-ink-50/35 line-through'}">
              ${g} ${en ? (g === 1 ? 'goal' : 'goals') : (g === 1 ? 'Tor' : 'Tore')} ${on ? (en ? 'counted' : 'gewertet') : (en ? 'excluded' : 'ausgenommen')} · ${t('grp')} ${m.group}
            </div>
          </div>
          <button data-action="toggle-match" data-id="${m.id}" data-on="${on}" role="switch" aria-checked="${on}"
                  class="switch shrink-0 ${on ? 'bg-wm-green' : 'bg-black/15 dark:bg-white/20'}">
            <span class="switch-knob block bg-white rounded-full ml-0.5 mt-0.5"></span>
          </button>
        </div>`;
    }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

  return `
    <div class="fade-up rounded-xl2 glass-card overflow-hidden mb-5">
      <div class="px-4 pt-4 pb-2">
        <h3 class="text-[15px] font-bold">${t('sec.weighting')}</h3>
        <p class="text-[12px] text-ink-900/45 dark:text-ink-50/45">${t('sec.weighting.d')}</p>
      </div>
      ${filterRows || `<p class="px-4 pb-4 text-[13px] text-ink-900/45">${t('sec.noMatches')}</p>`}
    </div>`;
}

/** Wochen-Leaderboard (echte Community-Daten, anonym oder mit Anzeigename) */
function leaderboardCard() {
  // Eingeloggt + Daten vorhanden → Rangliste; konfiguriert aber ausgeloggt → dezenter Hinweis
  if (!loggedIn()) {
    if (!supaConfigured()) return '';
    return `<button data-action="open-auth" class="press w-full text-left fade-up rounded-xl2 glass-card p-4 mb-5 flex items-center gap-3">
      <span class="text-2xl">🏆</span>
      <span class="flex-1 text-[13px] font-medium text-ink-900/60 dark:text-ink-50/60">${t('rank.signin')}</span>
      <span class="text-[12px] font-semibold text-wm-emerald">${t('auth.signin')} →</span>
    </button>`;
  }
  const c = state.community;
  if (!c || !Array.isArray(c.top) || !c.top.length) return '';
  const rows = c.top.map((r) => {
    const name = r.is_me ? (state.settings.nickname || t('rank.you')) : r.name;
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '';
    return `
      <div class="flex items-center gap-3 px-4 py-2.5 ${r.is_me ? 'bg-wm-emerald/[0.08]' : ''}">
        <span class="w-6 text-center text-[13px] font-bold tabular-nums ${r.rank <= 3 ? 'text-wm-gold' : 'text-ink-900/40 dark:text-ink-50/40'}">${medal || r.rank}</span>
        <p class="flex-1 min-w-0 text-[14px] ${r.is_me ? 'font-bold' : 'font-medium'} truncate">${name}</p>
        <div class="text-right shrink-0">
          <p class="text-[14px] font-bold tabular-nums">${fmtDistU(r.week_km)}</p>
          <p class="text-[10px] text-ink-900/40 dark:text-ink-50/40">${t('rank.total')}: ${fmtDist(r.total_km)}</p>
        </div>
      </div>`;
  }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');
  const right = `<span class="text-[12px] text-ink-900/35 dark:text-ink-50/35">${t('rank.players', { n: c.total_players })}</span>`;
  return `<section class="mb-5">
    ${sectionTitle('🏆 ' + t('rank.title'), right)}
    <div class="rounded-xl2 glass-card overflow-hidden">${rows}</div>
  </section>`;
}

function chProgress()    { const ist = totalRan(); return `${rankHeader(ist)}${challengeRingCard()}${kmTrackerCard()}${sectionJourney(ist)}`; }
function chHistory()     { return `${sectionChart()}${sectionHistory()}`; }
function chAchievements() {
  return `${leaderboardCard()}${weeklyGoalCard()}${sectionBadges(snapshot())}${matchWeightingCard()}
    <button data-action="reset" class="w-full py-3 rounded-xl text-wm-red font-medium text-[14px] active:opacity-60 transition mb-2">${t('set.reset')}</button>`;
}

function viewChallenge() {
  const tabs = [['progress', t('ch.progress')], ['history', t('ch.history')], ['ach', t('ch.ach')]];
  const body = challengeTab === 'history' ? chHistory() : challengeTab === 'ach' ? chAchievements() : chProgress();
  return `<div>
    ${segTabs('challenge-tab', challengeTab, tabs)}
    <div class="stagger">${body}</div>
  </div>`;
}

const stat = (label, value, color, id = '') => `
  <div class="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-2 py-3 text-center">
    <p class="text-[10px] font-semibold tracking-wide uppercase text-ink-900/40 dark:text-ink-50/40">${label}</p>
    <p ${id ? `id="${id}"` : ''} class="text-[17px] font-bold tabular-nums mt-0.5 ${color}">${value}</p>
  </div>`;

const quickBtn = (km) => `
  <button data-action="step-km" data-amount="${km}"
          class="py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[14px] font-semibold active:scale-95 transition">
    +${fmtKm(km)}
  </button>`;

/* ------------------------------------------------------------------ *
 * 6b) CHALLENGE-SEKTIONEN
 * ------------------------------------------------------------------ */

/** Rang/Liga + „Top X %" + Wochenziel + Motivations-Zeile */
function sectionGamification(ist, soll) {
  const lg = leagueFor(ist);
  // Echte Server-Daten bevorzugen (ab 3 Läufern), sonst lokale Heuristik
  const comm = state.community;
  const useServer = !!(comm && comm.total_players >= 3 && comm.percentile != null);
  const pct = useServer ? comm.percentile : topPercent(ist);
  const subLabel = useServer ? t('gam.top.real', { n: comm.total_players }) : t('gam.top.sub');
  const goal = Math.max(1, Number(state.settings.weeklyGoalKm) || DEFAULT_SETTINGS.weeklyGoalKm);
  const wk = weeklyKm();
  const wkPct = Math.min(1, wk / goal);
  const wkDone = wk >= goal;
  const mot = motivationKey(ist, soll);

  return `
    <div class="fade-up rounded-xl2 glass-card p-5 mb-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[15px] font-bold">${t('gam.title')}</h3>
        ${pct != null
          ? `<span class="inline-flex items-baseline gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full bg-wm-emerald/12 text-wm-emerald">
               ${t('gam.top', { pct })}<span class="font-medium opacity-70">· ${subLabel}</span></span>`
          : ''}
      </div>

      <!-- Liga / Level -->
      <div class="flex items-center gap-3">
        <div class="shrink-0">${rankBadge(lg.idx, 56)}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <p class="text-[16px] font-extrabold leading-tight" style="color:${lg.cur.color}">${lg.name}</p>
            <span class="text-[11px] font-semibold text-ink-900/45 dark:text-ink-50/45">${t('gam.level')} ${lg.level}</span>
          </div>
          <div class="mt-1.5 h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
            <div class="bar-fill h-full rounded-full" style="width:${(lg.progress * 100).toFixed(1)}%;background:linear-gradient(90deg,${lg.cur.color},#10B981)"></div>
          </div>
          <p class="text-[11px] mt-1 text-ink-900/45 dark:text-ink-50/45">
            ${lg.next
              ? `${fmtDistU(ist)} · ${getLang() === 'en' ? 'next' : 'nächste'}: ${lg.next.names[getLang() === 'en' ? 1 : 0]} ${getLang() === 'en' ? 'at' : 'ab'} ${fmtDistU(lg.next.km)}`
              : `${fmtDistU(ist)} · 🏁 ${getLang() === 'en' ? 'max level reached' : 'Maximal-Level erreicht'}`}
          </p>
        </div>
      </div>

      <!-- Wochenziel -->
      <div class="mt-4 pt-4 border-t border-black/5 dark:border-white/10">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[13px] font-semibold">${t('gam.weekly')}</span>
          <span class="text-[12px] font-bold tabular-nums ${wkDone ? 'text-wm-green' : 'text-ink-900/55 dark:text-ink-50/55'}">${fmtDist(wk)} / ${fmtDistU(goal)}</span>
        </div>
        <div class="h-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
          <div class="bar-fill h-full rounded-full" style="width:${(wkPct * 100).toFixed(1)}%;background:linear-gradient(90deg,#10B981,#34C759)"></div>
        </div>
        <p class="text-[12px] mt-2 font-medium ${wkDone ? 'text-wm-green' : 'text-ink-900/55 dark:text-ink-50/55'}">
          ${wkDone ? t('gam.weekly.done') : t('gam.weekly.left', { km: fmtDist(Math.max(0, goal - wk)) })}
        </p>
      </div>

      <!-- Motivation -->
      <div class="mt-3 rounded-xl bg-wm-emerald/[0.08] px-3.5 py-2.5 text-[13px] font-medium text-wm-emerald">
        ${t(mot.key, mot.vars)}
      </div>
    </div>`;
}

/** Virtuelle WM-Reise quer durch die Gastgeberstädte */
function sectionJourney(ist) {
  const total = JOURNEY[JOURNEY.length - 1].km;
  const pct = Math.min(1, ist / total);
  let idx = 0;
  for (let i = 0; i < JOURNEY.length; i++) if (ist >= JOURNEY[i].km) idx = i;
  const reached = JOURNEY[idx];
  const next = JOURNEY[idx + 1];
  const arrived = !next;

  const dots = JOURNEY.map((s) => {
    const passed = ist >= s.km;
    return `<div class="w-1.5 h-1.5 rounded-full ${passed ? 'bg-wm-gold' : 'bg-black/15 dark:bg-white/20'}"></div>`;
  }).join('');

  return `
    <div class="fade-up rounded-xl2 glass-card p-5 mb-5">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-[15px] font-bold">Virtuelle WM-Reise</h3>
        <span class="text-[12px] text-ink-900/45 dark:text-ink-50/45">🇲🇽 🇺🇸 🇨🇦</span>
      </div>
      <p class="text-[13px] text-ink-900/55 dark:text-ink-50/55 mb-3">
        ${arrived
          ? `🏆 Angekommen in <b>${reached.city}</b> – du hast die ganze Reise zum Finale gelaufen!`
          : `Unterwegs nach <b>${next.flag} ${next.city}</b> – noch <b class="text-wm-gold">${fmtKm(next.km - ist)} km</b>.`}
      </p>

      <div class="relative h-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
        <div class="bar-fill absolute inset-y-0 left-0 rounded-full" style="width:${(pct * 100).toFixed(1)}%;background:linear-gradient(90deg,#E4B458,#34C759)"></div>
      </div>
      <div class="relative mt-1" style="height:18px">
        <span class="absolute -translate-x-1/2 text-base leading-none" style="left:${(pct * 100).toFixed(1)}%">🏃</span>
      </div>

      <div class="flex items-center justify-between gap-1 mt-1">${dots}</div>
      <div class="flex items-center justify-between mt-1 text-[11px] text-ink-900/45 dark:text-ink-50/45">
        <span>${reached.flag} ${reached.city}</span>
        <span>${arrived ? '🏁' : `${next.flag} ${next.city}`}</span>
      </div>
    </div>`;
}

/** Burndown-Chart: Soll- vs. Ist-km kumuliert */
function sectionChart() {
  const data = chartData();
  if (!data || data.days.length < 2) {
    return `
    <div class="fade-up rounded-xl2 glass-card p-5 mb-5">
      <h3 class="text-[15px] font-bold mb-1">Verlauf</h3>
      <p class="text-[13px] text-ink-900/45 dark:text-ink-50/45">Sobald ein paar Tage Daten da sind, siehst du hier Soll vs. Gelaufen.</p>
    </div>`;
  }

  const W = 320, H = 140, P = 10;
  const n = data.days.length;
  const x = (i) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / data.maxY) * (H - 2 * P);
  const pts = (key) => data.days.map((p, i) => [x(i), y(p[key])]);

  // Catmull-Rom → kubische Bézier (weiche Kurve)
  const smooth = (P2) => {
    if (P2.length < 2) return '';
    let d = `M ${P2[0][0].toFixed(1)},${P2[0][1].toFixed(1)}`;
    for (let i = 0; i < P2.length - 1; i++) {
      const p0 = P2[i - 1] || P2[i], p1 = P2[i], p2 = P2[i + 1], p3 = P2[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };

  const istPts = pts('ist'), sollPts = pts('soll');
  const istPath = smooth(istPts), sollPath = smooth(sollPts);
  const area = `${istPath} L ${x(n - 1).toFixed(1)},${H - P} L ${x(0).toFixed(1)},${H - P} Z`;
  const last = istPts[n - 1];

  return `
    <div class="fade-up rounded-xl2 glass-card p-5 mb-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[15px] font-bold">Verlauf</h3>
        <div class="flex items-center gap-3 text-[11px]">
          <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-wm-gold"></span>Soll</span>
          <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-wm-emerald"></span>Gelaufen</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="w-full" style="height:140px">
        <defs>
          <linearGradient id="istFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#10B981" stop-opacity="0.28"/>
            <stop offset="1" stop-color="#10B981" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="currentColor" stroke-opacity="0.12"/>
        <path class="chart-area" d="${area}" fill="url(#istFill)"/>
        <path class="chart-line" pathLength="1" d="${sollPath}" fill="none" stroke="#E4B458" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        <path class="chart-line" pathLength="1" d="${istPath}" fill="none" stroke="#10B981" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        <circle class="chart-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="#10B981" stroke="#fff" stroke-width="2"/>
      </svg>
      <div class="flex items-center justify-between mt-1 text-[10px] text-ink-900/40 dark:text-ink-50/40 tabular-nums">
        <span>${new Date(data.days[0].ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
        <span>${new Date(data.days[n - 1].ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
      </div>
    </div>`;
}

/** Lauf-Historie (löschbare Einträge) */
function sectionHistory() {
  const runs = state.runs.filter((r) => r.km !== 0).slice().sort((a, b) => b.ts - a.ts);
  const shown = runs.slice(0, 12);

  const rows = shown.map((r) => {
    const d = new Date(r.ts);
    const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const pos = r.km > 0;
    return `
      <div class="flex items-center gap-3 px-4 py-2.5">
        <div class="w-8 h-8 rounded-full grid place-items-center shrink-0 ${pos ? 'bg-wm-green/12 text-wm-green' : 'bg-wm-red/10 text-wm-red'}">
          ${pos ? '🏃' : '↩︎'}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-semibold tabular-nums ${pos ? '' : 'text-wm-red'}">${pos ? '+' : ''}${fmtDistU(r.km)}</p>
          <p class="text-[11px] text-ink-900/45 dark:text-ink-50/45">${date} · ${time} ${getLang() === 'en' ? '' : 'Uhr'}</p>
        </div>
        ${pos ? `<button data-action="edit-run" data-id="${r.id}" aria-label="${t('run.edit')}"
                class="w-8 h-8 grid place-items-center rounded-full text-ink-900/35 dark:text-ink-50/35 active:bg-black/5 dark:active:bg-white/10 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>` : ''}
        <button data-action="delete-run" data-id="${r.id}" aria-label="${t('common.delete')}"
                class="w-8 h-8 grid place-items-center rounded-full text-ink-900/35 dark:text-ink-50/35 active:bg-black/5 dark:active:bg-white/10 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        </button>
      </div>`;
  }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

  return `
    <div class="fade-up rounded-xl2 glass-card overflow-hidden mb-5">
      <div class="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 class="text-[15px] font-bold">Lauf-Historie</h3>
        <span class="text-[12px] text-ink-900/45 dark:text-ink-50/45">${runs.length} ${runs.length === 1 ? 'Eintrag' : 'Einträge'}</span>
      </div>
      ${rows || '<p class="px-4 pb-4 text-[13px] text-ink-900/45 dark:text-ink-50/45">Noch keine Läufe – trag deinen ersten oben ein. 👟</p>'}
      ${runs.length > 12 ? `<p class="px-4 py-2 text-[11px] text-center text-ink-900/40 dark:text-ink-50/40">… und ${runs.length - 12} weitere</p>` : ''}
    </div>`;
}

/** Badges / Erfolge */
function sectionBadges(snap) {
  const cells = BADGES.map((b) => {
    const got = b.test(snap);
    return `
      <div class="rounded-xl2 p-3 text-center ${got ? 'bg-wm-gold/10' : 'bg-black/[0.03] dark:bg-white/[0.04] opacity-50'}">
        <div class="text-2xl leading-none ${got ? '' : 'grayscale'}">${b.icon}</div>
        <p class="text-[11px] font-bold mt-1.5 leading-tight">${b.name}</p>
        <p class="text-[10px] text-ink-900/45 dark:text-ink-50/45 leading-tight">${b.desc}</p>
      </div>`;
  }).join('');
  const got = BADGES.filter((b) => b.test(snap)).length;

  return `
    <div class="fade-up rounded-xl2 glass-card p-4 mb-5">
      <div class="flex items-center justify-between mb-3 px-1">
        <h3 class="text-[15px] font-bold">Erfolge</h3>
        <span class="text-[12px] text-ink-900/45 dark:text-ink-50/45 tabular-nums">${got}/${BADGES.length}</span>
      </div>
      <div class="grid grid-cols-3 gap-2">${cells}</div>
    </div>`;
}

/* ===================== SCREEN: EINSTELLUNGEN ===================== */
const APP_VERSION = '1.12.0';

/** Segment-Control: Optionen [{v,label}], aktiver Wert val, Aktion action */
function segmented(action, val, options) {
  return `<div class="flex gap-1.5 p-1.5 rounded-2xl bg-black/[0.05] dark:bg-white/[0.06]">
    ${options.map((o) => `
      <button data-action="${action}" data-val="${o.v}"
        class="flex-1 py-2.5 px-4 rounded-xl text-[13px] font-semibold transition press
               ${String(o.v) === String(val)
                 ? 'bg-white dark:bg-ink-800 shadow text-ink-900 dark:text-ink-50'
                 : 'text-ink-900/50 dark:text-ink-50/50'}">${o.label}</button>`).join('')}
  </div>`;
}

/** Zeile mit Label + kleinem Control rechts (für Toggles, Stepper, Werte) */
function settingRow(label, control, sub) {
  return `<div class="px-4 py-3">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[14px] font-semibold">${label}</p>
        ${sub ? `<p class="text-[11px] text-ink-900/45 dark:text-ink-50/45 mt-0.5">${sub}</p>` : ''}
      </div>
      <div class="shrink-0">${control}</div>
    </div>
  </div>`;
}

/** Gestapelte Zeile: Label oben, Control volle Breite darunter (für Segment-Schalter) */
function settingBlock(label, control, sub) {
  return `<div class="px-4 py-3.5">
    <p class="text-[14px] font-semibold mb-0.5">${label}</p>
    ${sub ? `<p class="text-[11px] text-ink-900/45 dark:text-ink-50/45 mb-2.5">${sub}</p>` : '<div class="mb-2.5"></div>'}
    ${control}
  </div>`;
}

function toggleSwitch(action, on) {
  return `<button data-action="${action}" role="switch" aria-checked="${on}"
            class="switch shrink-0 ${on ? 'bg-wm-green' : 'bg-black/15 dark:bg-white/20'}" data-on="${on}">
            <span class="switch-knob block bg-white rounded-full ml-0.5 mt-0.5"></span>
          </button>`;
}

/** Konto-Sektion: je nach Konfiguration/Login-Status */
function accountCard() {
  if (!supaConfigured()) {
    return `<div class="px-4 py-4 text-[13px] text-ink-900/55 dark:text-ink-50/55">🔒 ${t('set.account.soon')}</div>`;
  }
  if (loggedIn()) {
    const status = state.auth.syncing
      ? `<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-900/50 dark:text-ink-50/50"><span class="w-1.5 h-1.5 rounded-full bg-wm-gold live-dot"></span>${t('auth.syncing')}</span>`
      : `<span class="inline-flex items-center gap-1.5 text-[12px] font-semibold text-wm-emerald"><span class="w-1.5 h-1.5 rounded-full bg-wm-emerald"></span>${t('auth.synced')}</span>`;
    return settingRow(t('auth.signedInAs'),
        `<span class="text-[13px] font-semibold text-ink-900/70 dark:text-ink-50/70 truncate max-w-[150px] inline-block align-bottom">${userEmail()}</span>`) +
      settingRow(t('set.leaderboard'), toggleSwitch('toggle-leaderboard', state.settings.leaderboardOptin), t('set.leaderboard.d')) +
      (state.settings.leaderboardOptin ? `<div class="px-4 py-3">
        <input id="nickname-input" type="text" maxlength="24" value="${(state.settings.nickname || '').replace(/"/g, '&quot;')}" placeholder="${t('set.nickname')}"
               class="w-full px-4 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[14px] outline-none focus:ring-2 ring-wm-emerald/40"/>
      </div>` : '') +
      `<div class="px-4 py-3 flex items-center justify-between">${status}
        <button data-action="logout" class="press text-[13px] font-semibold text-wm-red px-3 py-1.5 rounded-lg bg-wm-red/10">${t('auth.logout')}</button>
      </div>`;
  }
  return `<div class="px-4 py-4">
      <p class="text-[12px] text-ink-900/50 dark:text-ink-50/50 mb-3">${t('auth.cloudHint')}</p>
      <button data-action="open-auth" class="press w-full py-3 rounded-xl text-white font-semibold shadow-glow"
              style="background:linear-gradient(135deg,#10B981,#059669)">${t('auth.signin')}</button>
    </div>`;
}

function viewSettings() {
  const en = getLang() === 'en';
  const s = state.settings;
  const themeVal = load(LS.theme, null) || 'system';
  const langVal = SUPPORTED_LANGS.includes(s.lang) ? s.lang : 'auto';
  const goal = Math.max(1, Number(s.weeklyGoalKm) || DEFAULT_SETTINGS.weeklyGoalKm);

  const card = (title, inner) => `
    <h3 class="text-[12px] font-bold uppercase tracking-wide text-ink-900/40 dark:text-ink-50/40 px-1 mb-2 mt-5">${title}</h3>
    <div class="rounded-xl2 glass-card overflow-hidden divide-y divide-black/5 dark:divide-white/10">${inner}</div>`;

  return `<div class="stagger">
    <button data-action="back-from-settings" class="press inline-flex items-center gap-1.5 text-[14px] font-semibold text-wm-emerald mb-2 -ml-1">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>${t('common.back')}
    </button>

    ${card(t('set.appearance'),
      settingBlock(t('set.language'),
        segmented('set-lang', langVal, [{ v: 'auto', label: t('common.auto') }, { v: 'de', label: 'DE' }, { v: 'en', label: 'EN' }])
      ) +
      settingBlock(t('set.theme'),
        segmented('set-theme', themeVal, [
          { v: 'system', label: t('set.theme.system') }, { v: 'light', label: t('set.theme.light') }, { v: 'dark', label: t('set.theme.dark') }])
      ) +
      settingBlock(t('set.unit'),
        segmented('set-unit', s.unit, [{ v: 'km', label: 'km' }, { v: 'mi', label: 'mi' }])
      )
    )}

    ${card(t('set.challenge'),
      settingRow(t('set.challenge.on'), toggleSwitch('toggle-challenge', s.challengeEnabled), t('set.challenge.d')) +
      (s.challengeEnabled ? settingRow(t('set.weeklygoal'),
        `<div class="flex items-center gap-2">
           <button data-action="goal-step" data-amount="-5" class="w-8 h-8 rounded-full grid place-items-center bg-black/5 dark:bg-white/10 text-lg font-light active:scale-90 transition">−</button>
           <span class="text-[15px] font-bold tabular-nums w-20 text-center">${fmtDistU(goal)}</span>
           <button data-action="goal-step" data-amount="5" class="w-8 h-8 rounded-full grid place-items-center bg-black/5 dark:bg-white/10 text-lg font-light active:scale-90 transition">+</button>
         </div>`) : '')
    )}

    ${card(t('set.notifications'),
      settingRow(t('set.notifications'), toggleSwitch('toggle-notifications', s.notifications), t('set.notifications.d'))
    )}

    ${card(t('set.account'), accountCard())}

    ${card(t('set.data'),
      `<button data-action="reset" class="w-full text-left px-4 py-3.5 text-[14px] font-semibold text-wm-red active:bg-black/5 dark:active:bg-white/10 transition">${t('set.reset')}</button>`
    )}

    ${card(t('set.about'),
      settingRow(t('set.version'), `<span class="text-[13px] font-semibold text-ink-900/55 dark:text-ink-50/55 tabular-nums">${APP_VERSION}</span>`) +
      `<div class="px-4 py-3 text-[12px] text-ink-900/45 dark:text-ink-50/45">⚽️ WM 2026 · ${en ? 'Run Challenge' : 'Lauf-Challenge'}</div>`
    )}

    <div class="h-4"></div>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * 7) RENDER-DISPATCH
 * ------------------------------------------------------------------ */
function render() {
  const app = document.getElementById('app');

  if (state.loading) {
    const sk = (h) => `<div class="skeleton rounded-xl2" style="height:${h}px"></div>`;
    app.innerHTML = `<div class="space-y-4">${sk(150)}${sk(96)}${sk(120)}${sk(200)}</div>`;
    return;
  }

  // Info-Modus: Challenge-Tab existiert nicht → ggf. auf „Heute" umlenken
  if (state.tab === 'challenge' && !state.settings.challengeEnabled) state.tab = 'today';

  const VIEWS = { today: viewToday, schedule: viewSchedule, table: viewTable, challenge: viewChallenge, settings: viewSettings };
  const TITLES = {
    today: t('title.today'), schedule: t('title.schedule'), table: t('title.table'),
    challenge: t('title.challenge'), settings: t('title.settings'),
  };
  const view = VIEWS[state.tab] || viewToday;

  applyNav();   // Sprache der Nav + Sichtbarkeit des Challenge-Tabs

  app.innerHTML = `<div class="tab-enter">${view()}</div>`;
  document.getElementById('header-title').textContent = TITLES[state.tab] || 'WM 2026';
  setGreeting();

  // Aktiven Nav-Button als Kapsel hervorheben
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('nav-active', btn.dataset.tab === state.tab);
  });

  stopCountdown();
  if (state.tab === 'today') {
    startCountdown();
    maybeLoadTodayNews();   // Live-News im Hintergrund laden
    // gewählten Kalender-Tag zentriert in den sichtbaren Bereich scrollen
    document.querySelector('#day-strip [data-active]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  if (state.tab === 'challenge') onChallengeRendered();
}

/** Tageszeit-abhängige Begrüßung im Header */
function setGreeting() {
  const el = document.getElementById('header-greet');
  if (!el) return;
  const h = new Date().getHours();
  const key = h < 5 ? 'greet.night' : h < 11 ? 'greet.morning' : h < 17 ? 'greet.day' : h < 22 ? 'greet.evening' : 'greet.night';
  el.textContent = `${t(key)} 👋`;
}

/* ------------------------------------------------------------------ *
 * 7b) COUNTDOWN (nächstes Spiel, tickt jede Sekunde)
 * ------------------------------------------------------------------ */
let countdownTimer = null;
const pad2 = (n) => String(n).padStart(2, '0');

function tickCountdown() {
  const el = document.getElementById('countdown');
  if (!el) { stopCountdown(); return; }
  const diff = Number(el.dataset.target) - Date.now();
  if (diff <= 0) { el.textContent = 'Jetzt!'; return; }
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const sep = '<span class="opacity-30 mx-1">:</span>';
  el.innerHTML = (d > 0 ? `${d}<span class="text-[18px] mr-2">T</span>` : '') + `${pad2(h)}${sep}${pad2(m)}${sep}${pad2(ss)}`;
}
function startCountdown() {
  stopCountdown();
  if (document.getElementById('countdown')) { tickCountdown(); countdownTimer = setInterval(tickCountdown, 1000); }
}
function stopCountdown() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } }

/* ------------------------------------------------------------------ *
 * 7c) SPIEL-DETAIL-SHEET — echte Daten (ESPN + football-data)
 * ------------------------------------------------------------------ *
 * Aufstellung/Statistik/Verlauf: ESPN (/api/detail). Halbzeit/Schiri/
 * Stadion: football-data (/api/matchinfo). Ist (noch) kein Detail da
 * (z. B. lange vor Anpfiff), zeigt das Sheet nur Info-Felder + News.
 * ------------------------------------------------------------------ */
let currentSheetMatch = null;
let matchSheetTab = 'lineup';

function teamColor(code) { let h = 0; const s = 'j' + (code || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return `hsl(${h % 360} 60% 46%)`; }
const lastNameOf = (n) => { const p = String(n || '').trim().split(/\s+/); return p[p.length - 1] || ''; };

/* Nationale Trikotfarben [Trikot, Nummer] (Fallback: deterministische Farbe) */
const NAT_COLOR = {
  ESP:['#C8102E','#fff'], GER:['#e9eef3','#1a1a1a'], BRA:['#F7DF00','#0a7b3e'], ARG:['#86c5e8','#0b3b7a'],
  FRA:['#1f3a93','#fff'], ENG:['#eef2f7','#1d3fa8'], POR:['#aa151b','#fff'], NED:['#f36c21','#fff'],
  BEL:['#c8102e','#111'], CRO:['#d80000','#fff'], MAR:['#c1272d','#0a6b3a'], JPN:['#0b1b5c','#fff'],
  KOR:['#cd2e3a','#fff'], USA:['#1a2b6b','#fff'], MEX:['#006847','#fff'], CAN:['#d52b1e','#fff'],
  SEN:['#1c8a42','#fff'], URU:['#4aa3dd','#0b3b7a'], COL:['#fcd116','#0033a0'], SUI:['#d52b1e','#fff'],
  DEN:['#c60c30','#fff'], SRB:['#c6363c','#fff'], POL:['#e8edf2','#d4213d'], AUS:['#f4c20d','#0a6b3a'],
  KSA:['#0a7b3e','#fff'], RSA:['#0a7b3e','#fcd116'], CZE:['#d7141a','#fff'], CPV:['#1c4f9c','#fff'],
  EGY:['#c8102e','#fff'], NOR:['#c8102e','#fff'], AUT:['#ed2939','#fff'], ECU:['#ffd100','#0033a0'],
  IRN:['#e9eef3','#c8102e'], GHA:['#0a7b3e','#fcd116'], NGA:['#0a7b3e','#fff'], CMR:['#0a7b3e','#fcd116'],
  CIV:['#f36c21','#fff'], TUN:['#e70013','#fff'], ALG:['#0a7b3e','#fff'], QAT:['#8a1538','#fff'],
  ITA:['#1b458f','#fff'], PER:['#d91023','#fff'], PAR:['#d52b1e','#fff'], JOR:['#e70013','#fff'],
  UZB:['#1eb53a','#fff'], JAM:['#fcd116','#0a7b3e'], PAN:['#d21034','#fff'], NZL:['#e9eef3','#111'],
  TUR:['#e30a17','#fff'], UKR:['#ffd700','#0057b7'], CRC:['#c8102e','#fff'], HON:['#0073cf','#fff'],
};
function kitColor(code) { const c = NAT_COLOR[code]; return c ? { fill: c[0], text: c[1] } : { fill: teamColor(code), text: '#fff' }; }

function jersey(kit, number, size) {
  const s = size || 38;
  return `<span class="relative inline-block" style="width:${s}px;height:${s}px">
    <svg viewBox="0 0 48 48" width="${s}" height="${s}" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">
      <path d="M16 4 L8 8 L3 18 L11 22 L13 16 L13 44 L35 44 L35 16 L37 22 L45 18 L40 8 L32 4 C29 9 19 9 16 4 Z" fill="${kit.fill}" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
    <span class="absolute inset-x-0 font-extrabold text-center" style="color:${kit.text};bottom:${Math.round(s * 0.1)}px;font-size:${Math.round(s * 0.38)}px;text-shadow:0 1px 1px rgba(0,0,0,.25)">${esc(number)}</span>
  </span>`;
}
function pitchChip(p, xPct, yPct, kit) {
  return `<div class="absolute flex flex-col items-center" style="left:${xPct.toFixed(1)}%;top:${yPct.toFixed(1)}%;transform:translate(-50%,-50%);width:66px">
    ${jersey(kit, p.num, 38)}
    <span class="mt-0.5 text-[11px] font-semibold text-white leading-tight text-center truncate w-[64px]" style="text-shadow:0 1px 3px rgba(0,0,0,.9)">${esc(lastNameOf(p.name))}</span>
  </div>`;
}
function placeXI(xi, lines, isHome, kit) {
  const nL = lines.length, span = nL > 1 ? 0.36 / (nL - 1) : 0;
  return xi.map((p) => {
    const y = isHome ? (0.95 - p.li * span) : (0.05 + p.li * span);
    const m = p.count >= 5 ? 0.12 : p.count === 4 ? 0.16 : 0.20;
    const x = p.count <= 1 ? 0.5 : m + (p.j / (p.count - 1)) * (1 - 2 * m);
    return pitchChip(p, x * 100, y * 100, kit);
  }).join('');
}
function benchRow(label, squad, kit) {
  if (!squad.subs || !squad.subs.length) return '';
  const chips = squad.subs.map((p) => `
    <div class="flex flex-col items-center shrink-0 w-[54px]">
      ${jersey(kit, p.num, 30)}
      <span class="mt-1 text-[9px] font-medium leading-none text-center truncate w-[52px]">${esc(lastNameOf(p.name))}</span>
    </div>`).join('');
  return `<div class="mt-3">
    <p class="text-[11px] font-bold uppercase tracking-wide text-ink-900/45 dark:text-ink-50/45 mb-2">${label}</p>
    <div class="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">${chips}</div>
  </div>`;
}
function renderLineupTab(m, detail) {
  const L = detail.lineups; if (!L || !L.home) return '';
  const h = team(m.home), a = team(m.away);
  const hc = kitColor(h.code), ac = kitColor(a.code), H = L.home, A = L.away;
  return `
    <div class="flex items-center justify-between text-[12px] font-semibold mb-2 px-1">
      <span class="inline-flex items-center gap-1.5">${crest(h, 'crest-sm')} ${esc(H.formation)}</span>
      <span class="inline-flex items-center gap-1.5">${esc(A.formation)} ${crest(a, 'crest-sm')}</span>
    </div>
    <div class="relative rounded-2xl overflow-hidden" style="height:620px;background:linear-gradient(180deg,#15803d,#166534 50%,#15803d)">
      <div class="absolute inset-2 rounded-xl" style="border:2px solid rgba(255,255,255,.18)"></div>
      <div class="absolute left-2 right-2" style="top:50%;height:0;border-top:2px solid rgba(255,255,255,.18)"></div>
      <div class="absolute rounded-full" style="left:50%;top:50%;width:84px;height:84px;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.18)"></div>
      ${placeXI(A.startXI, A.lines, false, ac)}
      ${placeXI(H.startXI, H.lines, true, hc)}
    </div>
    ${benchRow(`${t('md.bench')} · ${h.name}`, H, hc)}
    ${benchRow(`${t('md.bench')} · ${a.name}`, A, ac)}`;
}
function statBar(label, hv, av, sfx) {
  const total = (hv + av) || 1, hp = (hv / total) * 100; sfx = sfx || '';
  return `<div class="py-2.5">
    <div class="flex items-center justify-between text-[13px] font-semibold tabular-nums mb-1.5">
      <span>${hv}${sfx}</span><span class="text-[11px] font-medium text-ink-900/50 dark:text-ink-50/50">${label}</span><span>${av}${sfx}</span>
    </div>
    <div class="flex h-2 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/[0.08]">
      <div class="h-full" style="width:${hp.toFixed(1)}%;background:#10B981"></div>
      <div class="h-full flex-1" style="background:#0A84FF"></div>
    </div>
  </div>`;
}
function renderStatsTab(m, detail) {
  const S = detail.stats; if (!S) return '';
  const h = team(m.home), a = team(m.away);
  const rows = [
    ['st.possession', S.home.possession, S.away.possession, '%'],
    ['st.shots', S.home.shots, S.away.shots, ''],
    ['st.shotsOn', S.home.shotsOn, S.away.shotsOn, ''],
    ['st.corners', S.home.corners, S.away.corners, ''],
    ['st.fouls', S.home.fouls, S.away.fouls, ''],
    ['st.offsides', S.home.offsides, S.away.offsides, ''],
    ['st.yellow', S.home.yellow, S.away.yellow, ''],
    ['st.saves', S.home.saves, S.away.saves, ''],
  ];
  return `
    <div class="flex items-center justify-between text-[12px] font-bold mb-2 px-1">
      <span class="inline-flex items-center gap-1.5">${crest(h, 'crest-sm')} ${h.name}</span>
      <span class="inline-flex items-center gap-1.5">${a.name} ${crest(a, 'crest-sm')}</span>
    </div>
    <div class="rounded-xl2 glass-card px-4 divide-y divide-black/5 dark:divide-white/10">
      ${rows.map((r) => statBar(t(r[0]), r[1], r[2], r[3])).join('')}
    </div>`;
}
const EV_ICON = { goal: '⚽️', penalty: '⚽️', owngoal: '🥅', yellow: '🟨', red: '🟥', subst: '🔁' };
function renderEventsTab(m, detail) {
  const evs = detail.events || []; if (!evs.length) return '';
  const rows = evs.map((e) => {
    const homeSide = e.side === 'home';
    const cell = `<div class="flex items-center gap-2 ${homeSide ? '' : 'flex-row-reverse text-right'}">
        <span class="text-base leading-none">${EV_ICON[e.type] || '•'}</span>
        <div class="min-w-0"><p class="text-[13px] font-semibold truncate">${esc(e.player) || t('ev.' + e.type)}</p>
        <p class="text-[10px] text-ink-900/45 dark:text-ink-50/45">${t('ev.' + e.type)}</p></div></div>`;
    return `<div class="flex items-center gap-2 py-2">
      <div class="flex-1 min-w-0">${homeSide ? cell : ''}</div>
      <span class="shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">${esc(e.minute)}</span>
      <div class="flex-1 min-w-0">${homeSide ? '' : cell}</div>
    </div>`;
  }).join('<div class="h-px bg-black/5 dark:bg-white/10"></div>');
  return `<div class="rounded-xl2 glass-card px-3">${rows}</div>`;
}

function renderInfoTab(m) {
  const en = getLang() === 'en', live = m.status === 'IN_PLAY', played = isPlayed(m);
  const d = new Date(m.utcDate), locale = en ? 'en-GB' : 'de-DE';
  const stageLabel = (KO_STAGES.find(([k]) => k === m.stage) || [])[1] || (m.group && m.group !== '–' ? `${en ? 'Group' : 'Gruppe'} ${m.group}` : 'WM 2026');
  const info = (label, val) => val ? `<div class="flex items-center justify-between py-3 gap-3"><span class="text-[13px] text-ink-900/50 dark:text-ink-50/50 shrink-0">${label}</span><span class="text-[14px] font-semibold text-right">${val}</span></div>` : '';
  const inf = m._info || {};
  const ht = (inf.halfTime && inf.halfTime.home != null) ? `${inf.halfTime.home}:${inf.halfTime.away}` : '';
  const ref = inf.referee ? esc(inf.referee.name + (inf.referee.nationality ? ` (${inf.referee.nationality})` : '')) : '';
  const venue = m.venue || inf.venue || '';
  let news = '';
  if (CONFIG.apiBase) {
    if (m._news === undefined || m._news === null)
      news = `<div class="mt-5">${sectionTitle('📰 ' + t('sec.news'))}<div class="rounded-xl2 glass-card overflow-hidden"><div class="skeleton" style="height:64px"></div></div></div>`;
    else if (m._news.length)
      news = `<div class="mt-5">${sectionTitle('📰 ' + t('sec.news'))}<div class="rounded-xl2 glass-card overflow-hidden">${newsRows(m._news)}</div></div>`;
  }
  return `
    <div class="rounded-xl2 glass-card px-4 divide-y divide-black/5 dark:divide-white/10">
      ${info(en ? 'Competition' : 'Wettbewerb', 'FIFA WM 2026')}
      ${info(en ? 'Round' : 'Runde', stageLabel)}
      ${info(en ? 'Date' : 'Datum', d.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' }))}
      ${info(en ? 'Kick-off' : 'Anstoß', fmtTime(m.utcDate) + (en ? '' : ' Uhr'))}
      ${played ? info(en ? 'Half-time' : 'Halbzeit', ht) : ''}
      ${info(en ? 'Stadium' : 'Stadion', venue ? esc(venue) : '')}
      ${info(en ? 'Referee' : 'Schiedsrichter', ref)}
      ${info('Status', live ? `${en ? 'Live' : 'Läuft'} – ${liveMinute(m)}` : (played ? (en ? 'Finished' : 'Beendet') : (en ? 'Not started' : 'Noch nicht angepfiffen')))}
    </div>${news}`;
}

/** Echtes Detail (Aufstellung/Statistik/Verlauf) via ESPN nachladen */
async function loadDetail(m) {
  if (m._detail !== undefined) return;
  m._detail = null;
  if (!CONFIG.apiBase) { m._detail = {}; return; }
  const d = new Date(m.utcDate);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  try {
    const r = await fetch(`${CONFIG.apiBase}/api/detail?home=${encodeURIComponent(team(m.home).name)}&away=${encodeURIComponent(team(m.away).name)}&date=${ymd}`);
    m._detail = r.ok ? await r.json() : {};
  } catch { m._detail = {}; }
  if (currentSheetMatch === m) renderSheetContent();
}

/** Echte Zusatzinfos (Halbzeit, Schiri, Stadion) von football-data */
async function loadMatchInfo(m) {
  if (m._info !== undefined) return;
  m._info = null;
  if (!CONFIG.apiBase) { m._info = {}; return; }
  try {
    const r = await fetch(`${CONFIG.apiBase}/api/matchinfo?id=${encodeURIComponent(m.id)}`);
    m._info = r.ok ? await r.json() : {};
  } catch { m._info = {}; }
  if (currentSheetMatch === m) renderSheetContent();
}

function renderSheetContent() {
  const m = currentSheetMatch;
  const host = document.getElementById('sheet-content');
  if (!m || !host) return;
  const det = m._detail;
  const tabs = [];
  if (det && det.lineups && det.lineups.home) tabs.push(['lineup', 'md.lineup']);
  if (det && det.stats) tabs.push(['stats', 'md.stats']);
  if (det && det.events && det.events.length) tabs.push(['events', 'md.events']);
  tabs.push(['info', 'md.info']);
  if (!tabs.some(([k]) => k === matchSheetTab)) matchSheetTab = tabs[0][0];

  const seg = tabs.length > 1 ? `<div class="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10 mb-4">
    ${tabs.map(([k, lk]) => `<button data-action="sheet-tab" data-tab="${k}"
      class="flex-1 py-2 rounded-lg text-[12px] font-semibold transition press ${k === matchSheetTab
        ? 'bg-white dark:bg-ink-800 shadow text-ink-900 dark:text-ink-50' : 'text-ink-900/50 dark:text-ink-50/50'}">${t(lk)}</button>`).join('')}
  </div>` : '';

  let panel;
  if (matchSheetTab === 'lineup') panel = renderLineupTab(m, det);
  else if (matchSheetTab === 'stats') panel = renderStatsTab(m, det);
  else if (matchSheetTab === 'events') panel = renderEventsTab(m, det);
  else panel = renderInfoTab(m);
  host.innerHTML = seg + `<div>${panel}</div>`;

  loadDetail(m);
  loadMatchInfo(m);
  loadMatchNews(m);
}

function openMatchSheet(id) {
  const m = state.data.matches.find((x) => x.id === id);
  if (!m) return;
  currentSheetMatch = m;
  matchSheetTab = 'lineup';
  const h = team(m.home), a = team(m.away);
  const live = m.status === 'IN_PLAY', played = isPlayed(m), en = getLang() === 'en';

  const statusPill = live
    ? `<span class="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full bg-wm-red text-white"><span class="w-1.5 h-1.5 rounded-full bg-white live-dot"></span>${liveMinute(m)}</span>`
    : played ? `<span class="text-[12px] font-semibold px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-ink-900/55 dark:text-ink-50/55">${en ? 'Full time' : 'Endstand'}</span>`
    : `<span class="text-[12px] font-semibold px-3 py-1 rounded-full bg-wm-emerald/12 text-wm-emerald">${en ? 'Scheduled' : 'Geplant'}</span>`;
  const center = played
    ? `<div class="score text-[44px] leading-none ${live ? 'text-wm-red' : ''}">${m.score.home}<span class="opacity-30 mx-2">:</span>${m.score.away}</div>`
    : `<div class="text-3xl font-extrabold text-ink-900/40 dark:text-ink-50/40">VS</div>`;

  const sheet = document.createElement('div');
  sheet.id = 'match-sheet';
  sheet.innerHTML = `
    <div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet max-w-md mx-auto bg-ink-50 dark:bg-ink-950 rounded-t-[28px] px-5 pb-8 pt-1 max-h-[92vh] overflow-y-auto">
      <div class="grabber" data-drag-handle></div>
      <div class="flex justify-center mb-4">${statusPill}</div>
      <div class="flex items-center justify-between gap-3 mb-5">
        <div class="flex-1 flex flex-col items-center gap-2 text-center min-w-0">${crest(h, 'crest-lg', true)}<span class="text-[14px] font-semibold">${h.name}</span></div>
        <div class="shrink-0 text-center">${center}</div>
        <div class="flex-1 flex flex-col items-center gap-2 text-center min-w-0">${crest(a, 'crest-lg', true)}<span class="text-[14px] font-semibold">${a.name}</span></div>
      </div>
      <div id="sheet-content"></div>
      <button data-action="close-sheet" class="press w-full mt-5 py-3 rounded-xl bg-black/5 dark:bg-white/10 font-semibold text-[14px]">${t('common.close')}</button>
    </div>`;
  document.body.appendChild(sheet);
  renderSheetContent();
  makeSheetDraggable(sheet, closeSheet);
  if (navigator.vibrate) navigator.vibrate(8);
}
function closeSheet() {
  currentSheetMatch = null;   // Cleanup zuerst (auch wenn das Sheet per Drag schon weg ist)
  const s = document.getElementById('match-sheet');
  if (!s) return;
  s.querySelector('.sheet-backdrop')?.classList.add('closing');
  s.querySelector('.sheet')?.classList.add('closing');
  setTimeout(() => s.remove(), 260);
}

/**
 * Natives Bottom-Sheet-Gefühl per Griff (data-drag-handle/.grabber):
 *  - großzügige Grifffläche (CSS ::before)
 *  - nach unten ziehen → folgt dem Finger; weit ODER schneller Swipe → schließen
 *  - nach oben ziehen → Sheet wird größer (bis ~96 vh), schnappt beim Loslassen ein
 *  - geschwindigkeitsbasiert (Flick) wie bei iOS-Sheets
 */
function makeSheetDraggable(root, closeFn) {
  const sheet = root.querySelector('.sheet');
  const handle = root.querySelector('[data-drag-handle], .grabber');
  const backdrop = root.querySelector('.sheet-backdrop');
  if (!sheet || !handle) return;
  handle.style.touchAction = 'none';
  handle.style.cursor = 'grab';

  const VH = () => window.innerHeight;
  let startY = 0, curDy = 0, baseH = 0, dragging = false;
  let lastY = 0, lastT = 0, vel = 0;     // vel: px/ms, + = nach unten
  let committedH = '';                    // gemerkte (vergrößerte) Höhe

  const snapBack = () => {
    sheet.style.transition = 'transform .28s cubic-bezier(.22,1,.36,1), height .28s cubic-bezier(.22,1,.36,1)';
    sheet.style.transform = 'translateY(0)';
    sheet.style.height = committedH || '';
    if (backdrop) backdrop.style.opacity = '';
    setTimeout(() => { sheet.style.transition = ''; }, 300);
  };

  const dragClose = () => {
    sheet.style.transition = 'transform .24s cubic-bezier(.4,0,1,1)';
    sheet.style.transform = 'translateY(110%)';
    if (backdrop) { backdrop.style.transition = 'opacity .24s'; backdrop.style.opacity = '0'; }
    setTimeout(() => { try { root.remove(); } catch (e) {} closeFn(); }, 220);
  };

  const onMove = (e) => {
    if (!dragging) return;
    const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
    const now = e.timeStamp || Date.now();
    if (now > lastT) { vel = (y - lastY) / (now - lastT); lastY = y; lastT = now; }
    curDy = y - startY;
    if (curDy >= 0) {                       // nach unten: verschieben + Backdrop ausblenden
      sheet.style.height = committedH || '';
      sheet.style.transform = `translateY(${curDy}px)`;
      if (backdrop) backdrop.style.opacity = String(Math.max(0, 1 - curDy / (baseH || 500)));
    } else {                                // nach oben: vergrößern
      sheet.style.transform = 'translateY(0)';
      sheet.style.height = Math.min(VH() * 0.96, baseH - curDy) + 'px';
    }
  };

  const end = () => {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    // Schnell nach unten ODER weit genug → schließen (etwas weniger empfindlicher Flick)
    if (curDy > 0 && (vel > 0.7 || curDy > Math.max(130, baseH * 0.3))) { dragClose(); return; }
    // Schnell nach oben ODER weit genug → vergrößert lassen
    if (curDy < 0 && (vel < -0.7 || curDy < -80)) {
      committedH = Math.round(Math.min(VH() * 0.96, baseH - curDy)) + 'px';
    }
    snapBack();
  };

  const onDown = (e) => {
    dragging = true;
    startY = lastY = e.clientY != null ? e.clientY : (e.touches && e.touches[0].clientY);
    lastT = e.timeStamp || Date.now();
    vel = 0; curDy = 0;
    baseH = sheet.getBoundingClientRect().height;
    sheet.style.maxHeight = '96vh';        // erlaubt Vergrößern über die Standard-Kappung hinaus
    sheet.style.transition = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  handle.addEventListener('pointerdown', onDown);
}

/* ------------------------------------------------------------------ *
 * 8) AKTIONEN / EVENTS  (Event-Delegation)
 * ------------------------------------------------------------------ */
let runSeq = 0;
let prevTab = 'today';   // gemerkter Tab, um aus den Einstellungen zurückzukehren

function addRun(delta) {
  delta = Math.round(delta * 10) / 10;
  if (!delta) return;

  const before = snapshot();
  const run = { id: `${Date.now()}-${runSeq++}`, km: delta, ts: Date.now() };
  state.runs.push(run);
  persist();
  if (delta > 0) cloudInsertRun(run).then(refreshCommunity);   // Cloud + Ranking (No-Op wenn ausgeloggt)
  const after = snapshot();

  // Neu freigeschaltete Badges ermitteln & merken
  const newBadges = BADGES.filter((b) => b.test(after) && !state.seenBadges.has(b.id));
  newBadges.forEach((b) => state.seenBadges.add(b.id));
  if (newBadges.length) persist();

  if (delta > 0) {
    const crossedTen = Math.floor(after.ran / 10) > Math.floor(before.ran / 10);
    const caughtUp = after.soll > 0 && before.ran < before.soll && after.ran >= after.soll;
    pendingCelebration = {
      delta,
      newBadges,
      milestoneKm: crossedTen ? Math.floor(after.ran / 10) * 10 : 0,
      caughtUp,
      big: newBadges.length > 0 || caughtUp || crossedTen,
    };
  }
  render();
}

/** Badge-Set mit dem aktuellen Stand abgleichen (nur halten, was noch erfüllt ist) */
function reconcileBadges() {
  const snap = snapshot();
  state.seenBadges = new Set([...state.seenBadges].filter((bid) => {
    const def = BADGES.find((b) => b.id === bid);
    return def ? def.test(snap) : false;
  }));
}

function removeRun(id) {
  const gone = state.runs.find((r) => r.id === id);
  state.runs = state.runs.filter((r) => r.id !== id);
  reconcileBadges();   // Badges neu bewerten (nur entfernen, nicht neu feiern)
  persist();
  if (gone && gone.rid) cloudDeleteRun(gone.rid).then(refreshCommunity);
  render();
}

/* ---- Lauf bearbeiten (Distanz + Datum/Uhrzeit) ---- */
const pad0 = (n) => String(n).padStart(2, '0');
/** ts → Wert für <input type="datetime-local"> (lokale Zeit) */
function tsToLocalInput(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad0(d.getMonth() + 1)}-${pad0(d.getDate())}T${pad0(d.getHours())}:${pad0(d.getMinutes())}`;
}

function openRunEditor(id) {
  const r = state.runs.find((x) => x.id === id);
  if (!r) return;
  const en = getLang() === 'en';
  const dval = Math.round(fromKm(r.km) * 10) / 10;   // Rohwert (Punkt) für number-Input

  const sheet = document.createElement('div');
  sheet.id = 'run-editor';
  sheet.innerHTML = `
    <div class="sheet-backdrop" data-action="close-run-editor"></div>
    <div class="sheet max-w-md mx-auto bg-ink-50 dark:bg-ink-950 rounded-t-[28px] px-5 pb-8 pt-1">
      <div class="grabber" data-drag-handle></div>
      <h3 class="text-[17px] font-bold text-center mt-1 mb-5">${t('run.edit')}</h3>

      <label class="block text-[12px] font-semibold text-ink-900/50 dark:text-ink-50/50 mb-1.5">${t('run.distance')} (${uLabel()})</label>
      <input id="edit-km" type="number" inputmode="decimal" step="0.1" min="0.1" value="${dval}"
             class="w-full mb-4 px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[16px] font-semibold tabular-nums outline-none focus:ring-2 ring-wm-emerald/40"/>

      <label class="block text-[12px] font-semibold text-ink-900/50 dark:text-ink-50/50 mb-1.5">${t('run.date')} & ${t('run.time')}</label>
      <input id="edit-dt" type="datetime-local" value="${tsToLocalInput(r.ts)}"
             class="w-full mb-6 px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[16px] font-semibold outline-none focus:ring-2 ring-wm-emerald/40"/>

      <div class="flex gap-3">
        <button data-action="close-run-editor" class="press flex-1 py-3 rounded-xl bg-black/5 dark:bg-white/10 font-semibold text-[14px]">${t('common.cancel')}</button>
        <button data-action="save-run" data-id="${r.id}" class="press flex-1 py-3 rounded-xl text-white font-semibold text-[14px] shadow-glow" style="background:linear-gradient(135deg,#10B981,#059669)">${t('common.save')}</button>
      </div>
    </div>`;
  document.body.appendChild(sheet);
  makeSheetDraggable(sheet, closeRunEditor);
  if (navigator.vibrate) navigator.vibrate(6);
}

function closeRunEditor() {
  const s = document.getElementById('run-editor');
  if (!s) return;
  s.querySelector('.sheet-backdrop')?.classList.add('closing');
  s.querySelector('.sheet')?.classList.add('closing');
  setTimeout(() => s.remove(), 260);
}

function saveRunEdit(id) {
  const r = state.runs.find((x) => x.id === id);
  if (!r) return;
  const kmEl = document.getElementById('edit-km');
  const dtEl = document.getElementById('edit-dt');
  const val = parseFloat(kmEl && kmEl.value);
  const km = toKm(val);
  if (isNaN(km) || km <= 0) { kmEl?.focus(); return; }
  r.km = Math.round(km * 10) / 10;
  if (dtEl && dtEl.value) {
    const ts = +new Date(dtEl.value);
    if (!isNaN(ts)) r.ts = ts;
  }
  reconcileBadges();
  persist();
  cloudUpdateRun(r).then(refreshCommunity);
  closeRunEditor();
  render();
}

function submitKmFromInput() {
  const input = document.getElementById('km-input');
  if (!input) return;
  const val = parseFloat(input.value);
  // Eingabe erfolgt in der Anzeigeeinheit → kanonisch in km speichern
  if (!isNaN(val) && val !== 0) addRun(toKm(val));
  else input.value = '';
}

/** +/− und Quick-Buttons füllen NUR das Eingabefeld (committet wird erst per „Lauf hinzufügen") */
function stepInput(delta) {
  const input = document.getElementById('km-input');
  if (!input) return;
  const cur = parseFloat(input.value) || 0;
  const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
  input.value = next === 0 ? '' : String(next);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'switch-tab':
      state.tab = el.dataset.tab;
      persist();
      render();
      window.scrollTo({ top: 0 });
      break;

    case 'select-day':
      state.selectedDay = Number(el.dataset.day);
      render();
      break;

    case 'challenge-tab':
      challengeTab = el.dataset.val;
      render();
      break;

    case 'sched-filter':
      scheduleFilter = el.dataset.val;
      render();
      break;

    case 'standings-group':
      standingsGroup = el.dataset.val;
      render();
      break;

    case 'open-match':
      openMatchSheet(el.dataset.id);
      break;

    case 'close-sheet':
      closeSheet();
      break;

    case 'sheet-tab':
      matchSheetTab = el.dataset.tab;
      renderSheetContent();
      break;

    case 'install':
      triggerInstall();
      break;

    case 'dismiss-install':
      save(LS.install, true);
      document.getElementById('install-banner')?.remove();
      break;

    case 'toggle-theme':
      toggleTheme();
      break;

    case 'open-settings':
      if (state.tab !== 'settings') prevTab = state.tab;
      state.tab = 'settings';
      render();
      window.scrollTo({ top: 0 });
      break;

    case 'back-from-settings':
      state.tab = VALID_TABS.includes(prevTab) ? prevTab : 'today';
      render();
      window.scrollTo({ top: 0 });
      break;

    case 'onb-choose':
      finishOnboarding(el.dataset.mode);
      break;

    case 'set-lang':
      state.settings.lang = (el.dataset.val === 'auto') ? null : el.dataset.val;
      persist(); cloudPushSettings(); applyNav(); render();
      break;

    case 'set-theme': {
      const v = el.dataset.val;
      save(LS.theme, v === 'system' ? null : v);
      applyTheme(v === 'system' ? null : v);
      render();
      break;
    }

    case 'set-unit':
      state.settings.unit = (el.dataset.val === 'mi') ? 'mi' : 'km';
      persist(); cloudPushSettings(); render();
      break;

    case 'toggle-challenge':
      state.settings.challengeEnabled = !state.settings.challengeEnabled;
      if (!state.settings.challengeEnabled && state.tab === 'challenge') state.tab = 'today';
      persist(); cloudPushSettings(); applyNav(); render();
      break;

    case 'goal-step': {
      const amt = parseFloat(el.dataset.amount) || 0;
      const cur = Math.max(1, Number(state.settings.weeklyGoalKm) || DEFAULT_SETTINGS.weeklyGoalKm);
      state.settings.weeklyGoalKm = Math.max(1, Math.min(200, cur + amt));
      persist(); cloudPushSettings(); render();
      break;
    }

    case 'toggle-notifications':
      state.settings.notifications = !state.settings.notifications;
      persist(); cloudPushSettings(); render();
      break;

    case 'toggle-leaderboard':
      state.settings.leaderboardOptin = !state.settings.leaderboardOptin;
      persist(); cloudPushSettings().then(refreshCommunity); render();
      break;

    case 'open-auth':
      openAuthSheet();
      break;

    case 'close-auth':
      closeAuthSheet();
      break;

    case 'auth-mode':
      authMode = el.dataset.val;
      refreshAuthSheet();
      break;

    case 'auth-submit':
      authSubmit();
      break;

    case 'auth-magic':
      authMagic();
      break;

    case 'auth-forgot':
      authForgot();
      break;

    case 'logout':
      authLogout();
      break;

    case 'step-km':
      stepInput(parseFloat(el.dataset.amount));
      break;

    case 'submit-km-btn':
      submitKmFromInput();
      break;

    case 'delete-run':
      removeRun(el.dataset.id);
      break;

    case 'edit-run':
      openRunEditor(el.dataset.id);
      break;

    case 'close-run-editor':
      closeRunEditor();
      break;

    case 'save-run':
      saveRunEdit(el.dataset.id);
      break;

    case 'toggle-match': {
      const id = el.dataset.id;
      if (state.disabled.has(id)) state.disabled.delete(id);
      else state.disabled.add(id);
      persist();
      render();
      break;
    }

    case 'reset':
      if (confirm('Läufe, Erfolge und Spiel-Ausnahmen wirklich zurücksetzen?')) {
        state.runs = [];
        state.disabled.clear();
        state.seenBadges.clear();
        displayedChallenge = null;
        persist();
        render();
      }
      break;
  }
});

// Enter im km-Feld bestätigt die Eingabe
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-action="submit-km"]');
  if (!form) return;
  e.preventDefault();
  submitKmFromInput();
});

// Anzeigename (Rangliste) beim Verlassen des Feldes speichern + in die Cloud
document.addEventListener('change', (e) => {
  const el = e.target.closest && e.target.closest('#nickname-input');
  if (!el) return;
  state.settings.nickname = el.value.trim().slice(0, 24);
  persist();
  cloudPushSettings().then(refreshCommunity);
});

/* ------------------------------------------------------------------ *
 * 9) THEME (Hell/Dunkel)
 * ------------------------------------------------------------------ */
function applyTheme(theme) {
  const dark = theme === 'dark' || (theme == null && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
function toggleTheme() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  save(LS.theme, next);
  applyTheme(next);
}

/* ------------------------------------------------------------------ *
 * 10) LIVE-POLLING
 * ------------------------------------------------------------------ *
 * Holt im Hintergrund neue Daten – aber nur:
 *   - wenn ein Worker konfiguriert ist (Mock ändert sich nie),
 *   - schnell (pollLiveMs) solange ein Spiel LÄUFT, sonst träge (pollIdleMs),
 *   - nicht, während der Tab versteckt ist (spart Requests).
 * Neu gerendert wird nur bei echter Änderung und nicht, während km getippt wird.
 * ------------------------------------------------------------------ */
const anyLive = () => !!state.data && state.data.matches.some((m) => m.status === 'IN_PLAY');

const dataSignature = (data) =>
  data.matches.map((m) => `${m.id}:${m.status}:${m.score.home}-${m.score.away}:${m.minute || ''}`).join('|');

let pollTimer = null;

async function poll() {
  if (document.hidden) return;
  const fresh = await fetchMatches();
  const changed = !state.data || dataSignature(fresh) !== dataSignature(state.data);
  state.data = fresh;
  if (changed && !(document.activeElement && document.activeElement.id === 'km-input')) {
    render();
  }
}

function scheduleNextPoll() {
  if (!CONFIG.apiBase) return;                 // Demo-Modus: kein Polling nötig
  clearTimeout(pollTimer);
  const wait = anyLive() ? CONFIG.pollLiveMs : CONFIG.pollIdleMs;
  pollTimer = setTimeout(async () => { await poll(); scheduleNextPoll(); }, wait);
}

// Bei Rückkehr zum Tab sofort aktualisieren
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && CONFIG.apiBase) { poll().then(scheduleNextPoll); }
});

/* ------------------------------------------------------------------ *
 * 11) INSTALL  ("Zum Homescreen hinzufügen")
 * ------------------------------------------------------------------ */
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

let deferredPrompt = null;

// Android/Desktop-Chrome: natives Install-Event abfangen
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner('android');
});
window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner')?.remove();
  deferredPrompt = null;
});

async function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-banner')?.remove();
}

function showInstallBanner(kind) {
  if (isStandalone() || load(LS.install, false) || document.getElementById('install-banner')) return;

  const body = kind === 'ios'
    ? `Tippe auf <span class="inline-flex items-center gap-1 font-semibold">Teilen
         <svg class="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg></span>
       und dann „Zum Home-Bildschirm".`
    : `Installiere die App für den nativen Vollbild-Look.`;

  const action = kind === 'ios'
    ? `<button data-action="dismiss-install" class="text-[13px] font-semibold text-wm-blue px-2 py-1">Verstanden</button>`
    : `<button data-action="install" class="press text-[13px] font-semibold text-white px-4 py-1.5 rounded-full" style="background:linear-gradient(135deg,#10B981,#059669)">Installieren</button>`;

  const el = document.createElement('div');
  el.id = 'install-banner';
  el.className = 'fixed inset-x-0 z-50 px-4 fade-up';
  el.style.bottom = 'calc(env(safe-area-inset-bottom) + 4.75rem)';
  el.innerHTML = `
    <div class="max-w-md mx-auto rounded-2xl glass-card
                border border-black/5 dark:border-white/10 p-3 flex items-center gap-3">
      <img src="./icons/icon-192.png" alt="" class="w-10 h-10 rounded-xl shrink-0"/>
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-bold leading-tight">WM Lauf-Challenge</p>
        <p class="text-[12px] text-ink-900/55 dark:text-ink-50/55 leading-snug">${body}</p>
      </div>
      <div class="shrink-0 flex items-center gap-1">
        ${action}
        ${kind === 'android' ? `<button data-action="dismiss-install" aria-label="Schließen" class="w-7 h-7 grid place-items-center text-ink-900/40 dark:text-ink-50/40">✕</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(el);
}

/* ------------------------------------------------------------------ *
 * 12) FEIER & ANIMATION  (Push-Gefühl beim Lauf eintragen)
 * ------------------------------------------------------------------ */
let displayedChallenge = null;   // zuletzt im Ring gezeigte Werte → für Count-up-Animation
let pendingCelebration = null;   // wird beim nächsten Challenge-Render abgefeuert

/** Nach jedem Render der Challenge: Ring animieren + ggf. feiern */
function onChallengeRendered() {
  animateRing();
  if (pendingCelebration) { celebrate(pendingCelebration); pendingCelebration = null; }
}

/** Ring + zentrale Zahl + Stats sanft von alt → neu zählen (Apple-Watch-Feeling) */
function animateRing() {
  const ring = document.getElementById('ring-value');
  if (!ring) return;
  const openEl = document.getElementById('c-open');
  const istEl = document.getElementById('c-ist');
  const quoteEl = document.getElementById('c-quote');

  const to = { ran: totalRan(), soll: sollKm() };
  const from = displayedChallenge || { ran: 0, soll: to.soll };  // erster Aufruf: von 0 hochfüllen
  displayedChallenge = to;

  const R = 84, C = 2 * Math.PI * R;
  const apply = (ran, soll) => {
    const open = Math.max(0, soll - ran);
    const pct = soll > 0 ? Math.min(1, ran / soll) : 0;
    ring.setAttribute('stroke-dashoffset', (C * (1 - pct)).toFixed(1));
    ring.setAttribute('stroke', soll > 0 && ran >= soll - 1e-9 ? '#34C759' : '#E4B458');
    if (openEl) openEl.textContent = fmtDist(open);
    if (istEl) istEl.textContent = fmtDistU(ran);
    if (quoteEl) quoteEl.textContent = Math.round(pct * 100) + ' %';
  };

  if (Math.abs(to.ran - from.ran) < 0.05 && Math.abs(to.soll - from.soll) < 0.05) { apply(to.ran, to.soll); return; }

  apply(from.ran, from.soll);                         // Startbild sofort (kein Flackern)
  const t0 = performance.now(), dur = 750;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);                 // easeOutCubic
    apply(from.ran + (to.ran - from.ran) * e, from.soll + (to.soll - from.soll) * e);
    if (t < 1) requestAnimationFrame(step); else apply(to.ran, to.soll);
  };
  requestAnimationFrame(step);
}

/** Feier nach einem Lauf: Haptik + Toast + Konfetti, bei Meilenstein zusätzlich Overlay */
function celebrate(c) {
  if (navigator.vibrate) navigator.vibrate(c.big ? [0, 35, 30, 35, 60] : 25);
  floatingToast(`+${fmtDistU(c.delta)} 🔥`);
  burstConfetti(c.big ? 90 : 36);

  if (c.big) {
    let title, sub;
    if (c.newBadges.length) { title = `${c.newBadges[0].icon} ${c.newBadges[0].name}`; sub = 'Erfolg freigeschaltet!'; }
    else if (c.caughtUp)    { title = '✅ Aufgeholt!'; sub = 'Du bist wieder im Soll – stark!'; }
    else                    { title = `🎉 ${c.milestoneKm} km`; sub = 'Meilenstein erreicht!'; }
    milestoneOverlay(title, sub);
  }
}

/** Aufsteigendes „+X km"-Toast */
function floatingToast(text) {
  const el = document.createElement('div');
  el.className = 'celebrate-toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/** Zentrales Meilenstein-Overlay */
function milestoneOverlay(title, sub) {
  const el = document.createElement('div');
  el.className = 'milestone-overlay';
  el.innerHTML = `<div class="milestone-card">
      <div class="text-4xl mb-1">${title}</div>
      <div class="text-[13px] font-medium text-ink-900/60 dark:text-ink-50/60">${sub}</div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

/** Leichtgewichtiges Canvas-Konfetti (ohne Abhängigkeit) in WM-Farben */
function burstConfetti(count) {
  const cvs = document.createElement('canvas');
  cvs.className = 'confetti-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cvs.width = W * dpr; cvs.height = H * dpr;
  document.body.appendChild(cvs);
  const ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr);

  const colors = ['#E4B458', '#34C759', '#FF3B30', '#0A84FF', '#ffffff'];
  const parts = Array.from({ length: count }, (_, i) => ({
    x: W / 2 + (i / count - 0.5) * 120,
    y: H * 0.42,
    vx: (((i * 73) % 100) / 100 - 0.5) * 9,
    vy: -6 - ((i * 37) % 100) / 100 * 7,
    s: 5 + (i % 4) * 2,
    rot: (i * 0.6) % Math.PI,
    vr: ((i % 5) - 2) * 0.2,
    color: colors[i % colors.length],
  }));

  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    frame++;
    for (const p of parts) {
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - frame / 70);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (frame < 70) requestAnimationFrame(tick); else cvs.remove();
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ *
 * 13) BOOTSTRAP
 * ------------------------------------------------------------------ */
// Optionaler Theme-Override per URL (?theme=dark|light) – praktisch für Vorschauen/Deeplinks
const urlTheme = (typeof location !== 'undefined') ? new URLSearchParams(location.search).get('theme') : null;
applyTheme(urlTheme === 'dark' || urlTheme === 'light' ? urlTheme : load(LS.theme, null));

// Optionaler Tab-Deeplink (?tab=today|schedule|table|challenge)
const urlTab = (typeof location !== 'undefined') ? new URLSearchParams(location.search).get('tab') : null;
if (VALID_TABS.includes(urlTab)) state.tab = urlTab;

/* ------------------------------------------------------------------ *
 * 13a) AUTH & CLOUD-SYNC  (Supabase – ruhend, bis CONFIG.supabase gefüllt)
 * ------------------------------------------------------------------ *
 * Ist CONFIG.supabase leer, bleibt alles lokal (wie bisher). Mit URL+anon-Key:
 *  - E-Mail/Passwort-Login, Registrierung, Magic-Link, Passwort-Reset
 *  - Läufe & Einstellungen werden geräteübergreifend in Supabase gespiegelt
 *  - Offline-first: lokaler State bleibt Quelle, Cloud ist Spiegel/Backup
 * Sicherheit: nur der öffentliche anon-Key im Client; Row Level Security in der
 * DB stellt sicher, dass jeder Nutzer ausschließlich seine eigenen Daten sieht.
 * ------------------------------------------------------------------ */
let supa = null;                 // Supabase-Client (lazy via ESM-CDN geladen)
const supaConfigured = () => !!(CONFIG.supabase && CONFIG.supabase.url && CONFIG.supabase.anonKey);
const loggedIn = () => !!(supa && state.auth.user);
const userEmail = () => (state.auth.user && (state.auth.user.email || state.auth.user.user_metadata?.email)) || '';

/** Re-render, falls gerade die Einstellungen offen sind (Login-Status sichtbar machen) */
function renderIfSettings() { if (state.tab === 'settings') render(); }

async function initSupabase() {
  state.auth.ready = false;
  if (!supaConfigured()) { state.auth.ready = true; return; }
  try {
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    supa = mod.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data } = await supa.auth.getSession();
    state.auth.user = (data && data.session && data.session.user) || null;
    supa.auth.onAuthStateChange((_evt, session) => {
      const prev = state.auth.user && state.auth.user.id;
      state.auth.user = (session && session.user) || null;
      if (state.auth.user && state.auth.user.id !== prev) cloudSyncOnLogin();
      else renderIfSettings();
    });
    state.auth.ready = true;
    if (state.auth.user) cloudSyncOnLogin();
    else renderIfSettings();
  } catch (e) {
    console.warn('[Supabase] Init fehlgeschlagen – bleibe lokal:', e.message);
    supa = null; state.auth.ready = true;
  }
}

/* ---- Cloud-Schreiboperationen (No-Op, wenn nicht eingeloggt) ---- */
async function cloudInsertRun(run) {
  if (!loggedIn()) return;
  try {
    const { data, error } = await supa.from('runs')
      .insert({ user_id: state.auth.user.id, km: run.km, ran_at: new Date(run.ts).toISOString() })
      .select('id').single();
    if (!error && data) { run.rid = data.id; persist(); }
  } catch (e) { console.warn('[Supabase] insert run:', e.message); }
}
async function cloudUpdateRun(run) {
  if (!loggedIn() || !run.rid) return;
  try { await supa.from('runs').update({ km: run.km, ran_at: new Date(run.ts).toISOString() }).eq('id', run.rid); }
  catch (e) { console.warn('[Supabase] update run:', e.message); }
}
async function cloudDeleteRun(rid) {
  if (!loggedIn() || !rid) return;
  try { await supa.from('runs').delete().eq('id', rid); }
  catch (e) { console.warn('[Supabase] delete run:', e.message); }
}
async function cloudPushSettings() {
  if (!loggedIn()) return;
  try {
    await supa.from('profiles').update({
      challenge_enabled: state.settings.challengeEnabled,
      lang: state.settings.lang || 'auto',
      unit: state.settings.unit,
      weekly_goal_km: state.settings.weeklyGoalKm,
      nickname: state.settings.nickname || null,
      leaderboard_optin: !!state.settings.leaderboardOptin,
    }).eq('id', state.auth.user.id);
    await supa.from('settings').upsert({ user_id: state.auth.user.id, data: state.settings, updated_at: new Date().toISOString() });
  } catch (e) { console.warn('[Supabase] push settings:', e.message); }
}

/** Erst-Login / Geräte-Wechsel: Remote ↔ Lokal zusammenführen */
async function cloudSyncOnLogin() {
  if (!loggedIn()) return;
  state.auth.syncing = true; renderIfSettings();
  try {
    // 1) Remote-Einstellungen übernehmen (falls vorhanden), sonst lokale hochladen
    const { data: srow } = await supa.from('settings').select('data').eq('user_id', state.auth.user.id).maybeSingle();
    if (srow && srow.data && typeof srow.data === 'object') {
      state.settings = { ...DEFAULT_SETTINGS, ...srow.data };
      save(LS.settings, state.settings);
      applyNav();
    }
    // 2) Läufe zusammenführen (Remote-Quelle + lokale, noch nicht gesyncte)
    const { data: remote } = await supa.from('runs').select('id,km,ran_at');
    const remoteRuns = (remote || []).map((r) => ({ id: r.id, rid: r.id, km: Number(r.km), ts: +new Date(r.ran_at) }));
    const matches = (lr) => remoteRuns.some((rr) => Math.abs(rr.km - lr.km) < 0.05 && Math.abs(rr.ts - lr.ts) < 60000);
    const localOnly = state.runs.filter((lr) => lr.km > 0 && !lr.rid && !matches(lr));
    for (const lr of localOnly) {
      const { data, error } = await supa.from('runs')
        .insert({ user_id: state.auth.user.id, km: lr.km, ran_at: new Date(lr.ts).toISOString() })
        .select('id').single();
      if (!error && data) remoteRuns.push({ id: data.id, rid: data.id, km: lr.km, ts: lr.ts });
    }
    state.runs = remoteRuns.sort((a, b) => a.ts - b.ts);
    reconcileBadges();
    persist();
    await cloudPushSettings();
  } catch (e) { console.warn('[Supabase] Sync fehlgeschlagen:', e.message); }
  state.auth.syncing = false;
  render();
  refreshCommunity();   // Ranking laden
}

/* ---- Community-Ranking (echte „Top X %" + Wochen-Leaderboard) ---- */
async function fetchCommunity() {
  if (!loggedIn()) { state.community = null; return; }
  try {
    const { data, error } = await supa.rpc('community_stats');
    if (!error && data) state.community = data;
  } catch (e) { console.warn('[Supabase] community_stats:', e.message); }
}
async function refreshCommunity() {
  await fetchCommunity();
  if (state.tab === 'challenge') render();
}

/* ---- Auth-UI (Bottom-Sheet) ---- */
let authMode = 'signin';   // 'signin' | 'signup'

function authMsg(text, kind) {
  const el = document.getElementById('auth-msg');
  if (!el) return;
  el.textContent = text || '';
  el.className = `text-[12px] font-medium min-h-[16px] mt-1 ${kind === 'err' ? 'text-wm-red' : 'text-wm-emerald'}`;
}
const authVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const authRedirect = () => (typeof location !== 'undefined' ? location.origin + location.pathname : undefined);

function openAuthSheet() {
  if (!supa) return;
  authMode = 'signin';
  const sheet = document.createElement('div');
  sheet.id = 'auth-sheet';
  sheet.innerHTML = renderAuthSheet();
  document.body.appendChild(sheet);
  makeSheetDraggable(sheet, closeAuthSheet);
  if (navigator.vibrate) navigator.vibrate(6);
}
function closeAuthSheet() {
  const s = document.getElementById('auth-sheet');
  if (!s) return;
  s.querySelector('.sheet-backdrop')?.classList.add('closing');
  s.querySelector('.sheet')?.classList.add('closing');
  setTimeout(() => s.remove(), 260);
}
function renderAuthSheet() {
  return `
    <div class="sheet-backdrop" data-action="close-auth"></div>
    <div class="sheet max-w-md mx-auto bg-ink-50 dark:bg-ink-950 rounded-t-[28px] px-5 pb-8 pt-1">
      <div class="grabber" data-drag-handle></div>
      <div class="w-12 h-12 mx-auto mt-2 mb-3 rounded-2xl grid place-items-center text-2xl shadow-glow" style="background:linear-gradient(135deg,#10B981,#059669)">☁️</div>
      <h3 class="text-[18px] font-bold text-center">${t('auth.welcome')}</h3>
      <p class="text-[12px] text-center text-ink-900/50 dark:text-ink-50/50 mb-4 px-4">${t('auth.cloudHint')}</p>
      ${segTabs('auth-mode', authMode, [['signin', t('auth.signin')], ['signup', t('auth.signup')]])}
      <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${t('auth.email')}"
             class="w-full mb-3 px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[15px] outline-none focus:ring-2 ring-wm-emerald/40"/>
      <input id="auth-pass" type="password" autocomplete="current-password" placeholder="${t('auth.password')}"
             class="w-full px-4 py-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[15px] outline-none focus:ring-2 ring-wm-emerald/40"/>
      <p id="auth-msg" class="text-[12px] font-medium min-h-[16px] mt-1"></p>
      <button data-action="auth-submit" class="press w-full mt-3 py-3 rounded-xl text-white font-semibold shadow-glow"
              style="background:linear-gradient(135deg,#10B981,#059669)">${t(authMode === 'signup' ? 'auth.signup' : 'auth.signin')}</button>
      <div class="flex items-center justify-between mt-4 text-[13px] font-semibold">
        <button data-action="auth-forgot" class="text-ink-900/55 dark:text-ink-50/55 press">${t('auth.forgot')}</button>
        <button data-action="auth-magic" class="text-wm-emerald press">${t('auth.magic')}</button>
      </div>
    </div>`;
}
/** Aktiven Auth-Tab + Submit-Beschriftung aktualisieren, ohne neu zu mounten */
function refreshAuthSheet() {
  const host = document.getElementById('auth-sheet');
  if (!host) return;
  host.querySelectorAll('[data-action="auth-mode"]').forEach((b) => b.classList.toggle('seg-active', b.dataset.val === authMode));
  const submit = host.querySelector('[data-action="auth-submit"]');
  if (submit) submit.textContent = t(authMode === 'signup' ? 'auth.signup' : 'auth.signin');
}

async function authSubmit() {
  if (!supa) return;
  const email = authVal('auth-email'), pass = authVal('auth-pass');
  if (!email || !pass) { authMsg(t('auth.needFields'), 'err'); return; }
  authMsg(t('auth.busy'));
  try {
    if (authMode === 'signup') {
      const { data, error } = await supa.auth.signUp({ email, password: pass, options: { emailRedirectTo: authRedirect() } });
      if (error) return authMsg(error.message, 'err');
      if (!data.session) return authMsg(t('auth.checkEmail'));   // E-Mail-Bestätigung nötig
    } else {
      const { error } = await supa.auth.signInWithPassword({ email, password: pass });
      if (error) return authMsg(error.message, 'err');
    }
    closeAuthSheet();   // onAuthStateChange → Sync + Re-Render
  } catch (e) { authMsg(e.message, 'err'); }
}
async function authMagic() {
  if (!supa) return;
  const email = authVal('auth-email');
  if (!email) { authMsg(t('auth.needEmail'), 'err'); return; }
  authMsg(t('auth.busy'));
  try {
    const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirect() } });
    authMsg(error ? error.message : t('auth.magicSent'), error ? 'err' : 'ok');
  } catch (e) { authMsg(e.message, 'err'); }
}
async function authForgot() {
  if (!supa) return;
  const email = authVal('auth-email');
  if (!email) { authMsg(t('auth.needEmail'), 'err'); return; }
  authMsg(t('auth.busy'));
  try {
    const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: authRedirect() });
    authMsg(error ? error.message : t('auth.resetSent'), error ? 'err' : 'ok');
  } catch (e) { authMsg(e.message, 'err'); }
}
async function authLogout() {
  if (!supa) return;
  try { await supa.auth.signOut(); } catch (e) {}
  state.auth.user = null;
  state.community = null;
  render();   // lokale Läufe bleiben als Cache erhalten
}

/* ------------------------------------------------------------------ *
 * 13) ONBOARDING / WELCOME  (einmalig beim ersten Start)
 * ------------------------------------------------------------------ */
function showOnboarding() {
  if (document.getElementById('onboarding')) return;
  const en = getLang() === 'en';
  const feat = (icon, tk, dk) => `
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 rounded-xl grid place-items-center text-xl shrink-0 glass-chip">${icon}</div>
      <div class="min-w-0">
        <p class="text-[15px] font-bold leading-tight">${t(tk)}</p>
        <p class="text-[13px] text-white/70 leading-snug">${t(dk)}</p>
      </div>
    </div>`;

  const el = document.createElement('div');
  el.id = 'onboarding';
  el.className = 'fixed inset-0 z-[90] overflow-y-auto pitch-grad text-white';
  el.innerHTML = `
    <div class="hero-spot relative max-w-md mx-auto min-h-full px-6 pt-16 pb-10 flex flex-col"
         style="padding-top:max(env(safe-area-inset-top),3rem)">
      <div class="text-center mb-8">
        <div class="text-6xl mb-3">⚽️</div>
        <div class="text-2xl mb-1">🇲🇽 🇺🇸 🇨🇦</div>
        <h1 class="text-[30px] font-extrabold leading-tight mt-3">WM 2026</h1>
        <p class="text-[16px] font-semibold text-wm-lime mt-1">${t('onb.tagline')}</p>
        <p class="text-[13px] text-white/70 mt-3 max-w-xs mx-auto">${t('onb.rule')}</p>
      </div>

      <div class="space-y-4 mb-8">
        ${feat('📡', 'onb.f1.t', 'onb.f1.d')}
        ${feat('🏃', 'onb.f2.t', 'onb.f2.d')}
        ${feat('🏅', 'onb.f3.t', 'onb.f3.d')}
      </div>

      <div class="mt-auto">
        <p class="text-center text-[14px] font-semibold text-white/85 mb-3">${t('onb.q')}</p>
        <button data-action="onb-choose" data-mode="challenge"
                class="press w-full mb-3 p-4 rounded-2xl text-left glass-chip border border-white/25 active:scale-[.98] transition">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🏃‍♂️</span>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-bold">${t('onb.challenge.t')}</p>
              <p class="text-[12px] text-white/70">${t('onb.challenge.d')}</p>
            </div>
            <svg class="w-5 h-5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </button>
        <button data-action="onb-choose" data-mode="info"
                class="press w-full p-4 rounded-2xl text-left bg-white/5 border border-white/10 active:scale-[.98] transition">
          <div class="flex items-center gap-3">
            <span class="text-2xl">📰</span>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-bold">${t('onb.info.t')}</p>
              <p class="text-[12px] text-white/70">${t('onb.info.d')}</p>
            </div>
            <svg class="w-5 h-5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </button>
        <p class="text-center text-[11px] text-white/45 mt-4">${t('onb.hint')}</p>
      </div>
    </div>`;
  document.body.appendChild(el);
}

function finishOnboarding(mode) {
  state.settings.challengeEnabled = (mode === 'challenge');
  state.onboarded = true;
  if (!state.settings.challengeEnabled && state.tab === 'challenge') state.tab = 'today';
  persist();
  document.getElementById('onboarding')?.remove();
  applyNav();
  render();
  if (navigator.vibrate) navigator.vibrate(12);
}

(async function init() {
  applyNav();                       // Sprache/Tabs sofort setzen
  if (!state.onboarded) showOnboarding();
  render();                         // Lade-Spinner
  state.data = await fetchMatches();
  state.loading = false;
  render();

  scheduleNextPoll();               // Live-Updates starten (nur falls Worker konfiguriert)
  initSupabase();                   // Login/Cloud-Sync (nur falls CONFIG.supabase gefüllt)

  // iOS bietet kein beforeinstallprompt → eigener Hinweis (nur Safari, nicht installiert)
  if (isIOS() && !isStandalone()) showInstallBanner('ios');
})();
