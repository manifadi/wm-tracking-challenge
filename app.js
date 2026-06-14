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
  apiBase: 'http://localhost:8787',   // lokaler Worker (npx wrangler dev). Für Produktion: deine workers.dev-URL
  pollLiveMs: 60000,           // Abfrage-Intervall, wenn mind. ein Spiel LÄUFT
  pollIdleMs: 600000,          // Abfrage-Intervall sonst (Ergebnisse ändern sich selten)
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
async function fetchMatches() {
  if (!CONFIG.apiBase) {
    await new Promise((r) => setTimeout(r, 350));    // simulierte Latenz im Demo-Modus
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

const state = {
  loading:  true,
  data:     null,
  tab:      load(LS.tab, 'ticker'),
  tickerView: load(LS.tickerView, 'matches'),
  runs:     loadRuns(),
  disabled: new Set(load(LS.disabled, [])),   // IDs der Spiele, deren Tore NICHT zählen
  seenBadges: new Set(load(LS.badges, [])),
};

function persist() {
  save(LS.runs, state.runs);
  save(LS.badges, [...state.seenBadges]);
  save(LS.disabled, [...state.disabled]);
  save(LS.tab, state.tab);
  save(LS.tickerView, state.tickerView);
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
const fmtKm   = (n) => (Math.round(n * 10) / 10).toLocaleString('de-DE');

function fmtKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
// Datum (z. B. "Sa, 14.06.2026") und Uhrzeit (z. B. "16:00") getrennt – für die Challenge-Liste
const fmtDate = (iso) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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
 * 5) RENDER  ·  SCREEN 1: TICKER
 * ------------------------------------------------------------------ */
function viewTicker() {
  const goals = totalGoals();
  const groups = Object.keys(state.data.groups);

  const groupsHtml = groups.map((g) => {
    const matches = state.data.matches
      .filter((m) => m.group === g)
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    const rows = matches.map((m) => {
      const h = team(m.home), a = team(m.away);
      const played = isPlayed(m);
      const live = m.status === 'IN_PLAY';
      const center = played
        ? `<div class="score text-[20px] ${live ? 'text-wm-red' : ''}">${m.score.home}<span class="opacity-25 mx-1.5">:</span>${m.score.away}</div>`
        : `<div class="text-[14px] font-bold text-ink-900/55 dark:text-ink-50/55 tabular-nums">${new Date(m.utcDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>`;
      const sub = live ? `<span class="text-wm-red font-bold">${m.minute}'</span>`
        : (played ? `<span class="text-ink-900/35 dark:text-ink-50/35">Endstand</span>`
        : `<span class="text-ink-900/35 dark:text-ink-50/35">${fmtKickoff(m.utcDate).split(',')[0]}</span>`);

      return `
        <div class="flex items-center gap-2 px-4 py-3">
          <div class="flex-1 flex items-center justify-end gap-2.5 min-w-0 text-right">
            <span class="text-[14px] font-semibold truncate">${h.name}</span>
            ${crest(h, 'crest-sm')}
          </div>
          <div class="shrink-0 min-w-[68px] text-center">
            ${center}
            <div class="text-[10px] mt-0.5">${sub}</div>
          </div>
          <div class="flex-1 flex items-center gap-2.5 min-w-0">
            ${crest(a, 'crest-sm')}
            <span class="text-[14px] font-semibold truncate">${a.name}</span>
          </div>
        </div>`;
    }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

    return `
      <section class="fade-up">
        <div class="flex items-center justify-between mb-2 px-1">
          <h3 class="text-[13px] font-bold tracking-wide text-ink-900/50 dark:text-ink-50/50">GRUPPE ${g}</h3>
        </div>
        <div class="rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark overflow-hidden">
          ${rows}
        </div>
      </section>`;
  }).join('');

  const isMatches = state.tickerView !== 'table';

  return `
    ${sectionHero()}

    <!-- Globaler Tor-Zähler (Bridge zur Challenge) -->
    <div class="fade-up rounded-xl2 px-5 py-4 mb-5 text-white shadow-card relative overflow-hidden"
         style="background:linear-gradient(135deg,#10B981 0%,#0e3b22 60%,#0a0f0d 100%)">
      <div class="absolute -right-5 -top-7 text-[110px] leading-none opacity-10 select-none">⚽️</div>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold tracking-widest uppercase text-white/70">Tore bei der WM 2026</p>
          <div class="flex items-end gap-2 mt-0.5">
            <span class="score text-4xl">${goals}</span>
            <span class="mb-1 text-[13px] text-white/70">= ${goals} km Soll</span>
          </div>
        </div>
        <p class="text-[12px] text-white/70 text-right leading-tight">${playedMatches().length}/${state.data.matches.length}<br>Spiele</p>
      </div>
    </div>

    <!-- Segment: Spielplan / Tabellen -->
    <div class="fade-up grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl bg-black/[0.05] dark:bg-white/[0.06]">
      <button data-action="ticker-view" data-view="matches"
              class="py-1.5 rounded-lg text-[13px] font-semibold transition ${isMatches ? 'bg-white dark:bg-ink-900 shadow-sm' : 'text-ink-900/50 dark:text-ink-50/50'}">Spielplan</button>
      <button data-action="ticker-view" data-view="table"
              class="py-1.5 rounded-lg text-[13px] font-semibold transition ${!isMatches ? 'bg-white dark:bg-ink-900 shadow-sm' : 'text-ink-900/50 dark:text-ink-50/50'}">Tabellen</button>
    </div>

    ${isMatches ? `<div class="space-y-6">${groupsHtml}</div>` : viewStandings()}

    ${sectionScorers()}

    <p class="text-center text-[11px] text-ink-900/35 dark:text-ink-50/35 mt-8">
      ${CONFIG.apiBase ? 'Live-Daten via Worker · Tabellen live berechnet' : 'Demo-Daten · mit Worker + API-Key werden alle Ergebnisse echt & live'}
    </p>`;
}

/** Wählt das „Spiel des Moments": laufend → als nächstes → zuletzt beendet */
function heroMatch() {
  const ms = state.data.matches;
  const live = ms.filter((m) => m.status === 'IN_PLAY').sort((a, b) => (b.minute || 0) - (a.minute || 0));
  if (live.length) return live[0];
  const next = ms.filter((m) => m.status === 'SCHEDULED').sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  if (next.length) return next[0];
  const done = ms.filter((m) => m.status === 'FINISHED').sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
  return done[0] || null;
}

/** Großes Featured-Match (Pitch-Verlauf) – wie „Top Event" in den Inspo-Designs */
function sectionHero() {
  if (state.tickerView === 'table') return '';
  const m = heroMatch();
  if (!m) return '';
  const h = team(m.home), a = team(m.away);
  const live = m.status === 'IN_PLAY', played = isPlayed(m);
  const label = live ? 'LIVE JETZT' : (played ? 'ZULETZT' : 'NÄCHSTES SPIEL');
  const topRight = live
    ? `<span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-wm-red text-white"><span class="w-1.5 h-1.5 rounded-full bg-white live-dot"></span>${m.minute}'</span>`
    : `<span class="text-[11px] font-medium text-white/70">${played ? 'Endstand' : fmtKickoff(m.utcDate)}</span>`;
  const center = played
    ? `<div class="score text-[40px] leading-none">${m.score.home}<span class="opacity-40 mx-2">:</span>${m.score.away}</div>`
    : `<div class="text-2xl font-extrabold text-white/85">VS</div>`;

  return `
    <div class="fade-up pitch-grad rounded-xl2 p-5 mb-5 text-white shadow-card relative overflow-hidden">
      <div class="absolute inset-0 opacity-[0.06]" style="background-image:radial-gradient(circle at 1px 1px,#fff 1px,transparent 0);background-size:22px 22px"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-4">
          <span class="text-[11px] font-bold tracking-widest uppercase text-wm-lime">${label}</span>
          ${topRight}
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
            ${crest(h, 'crest-lg', true)}
            <span class="text-[13px] font-semibold truncate w-full">${h.name}</span>
          </div>
          <div class="shrink-0 text-center px-1">${center}</div>
          <div class="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
            ${crest(a, 'crest-lg', true)}
            <span class="text-[13px] font-semibold truncate w-full">${a.name}</span>
          </div>
        </div>
        <div class="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/55">
          <span>Gruppe ${m.group}</span><span>·</span><span>FIFA WM 2026</span>
        </div>
      </div>
    </div>`;
}

/** Alle Gruppentabellen (live aus Ergebnissen berechnet) */
function viewStandings() {
  const groups = Object.keys(state.data.groups);
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
        <h3 class="text-[13px] font-bold tracking-wide text-ink-900/50 dark:text-ink-50/50 mb-2 px-1">GRUPPE ${g}</h3>
        <div class="rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark overflow-hidden">
          <table class="w-full border-collapse">
            <thead>
              <tr class="text-[10px] font-semibold uppercase tracking-wide text-ink-900/35 dark:text-ink-50/35">
                <th class="py-1.5 pl-3 pr-1 text-left font-semibold">#</th>
                <th class="py-1.5 text-left font-semibold">Team</th>
                <th class="py-1.5 px-1 text-center font-semibold">Sp</th>
                <th class="py-1.5 px-1 text-center font-semibold">Diff</th>
                <th class="py-1.5 pl-1 pr-3 text-center font-semibold">Pkt</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');

  return `<div class="space-y-6">${tables}</div>`;
}

/** Torschützenliste – nur sichtbar, wenn der Worker echte Scorer-Daten liefert */
function sectionScorers() {
  const scorers = Array.isArray(state.data.scorers) ? state.data.scorers : [];
  if (!scorers.length) return '';
  const rows = scorers.slice(0, 10).map((s, i) => `
    <div class="flex items-center gap-3 px-4 py-2.5">
      <span class="w-5 text-center text-[13px] font-bold tabular-nums ${i === 0 ? 'text-wm-gold' : 'text-ink-900/40 dark:text-ink-50/40'}">${i + 1}</span>
      <span class="text-lg leading-none">${s.flag || '⚽️'}</span>
      <div class="flex-1 min-w-0">
        <p class="text-[14px] font-medium truncate">${s.name}</p>
        <p class="text-[11px] text-ink-900/45 dark:text-ink-50/45 truncate">${s.team || ''}</p>
      </div>
      <span class="text-[15px] font-bold tabular-nums">${s.goals}<span class="text-[11px] font-normal text-ink-900/40 dark:text-ink-50/40 ml-0.5">Tore</span></span>
    </div>`).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

  return `
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark overflow-hidden mt-6">
      <div class="px-4 pt-4 pb-2"><h3 class="text-[15px] font-bold">⚽️ Torschützenkönige</h3></div>
      ${rows}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * 6) RENDER  ·  SCREEN 2: CHALLENGE
 * ------------------------------------------------------------------ */
function viewChallenge() {
  const soll = sollKm();
  const ist  = totalRan();
  const open = Math.max(0, soll - ist);
  const pct  = soll > 0 ? Math.min(1, ist / soll) : 0;
  const streak = streakDays();
  const snap = snapshot();

  // Ring-Geometrie
  const R = 84, C = 2 * Math.PI * R;
  const offset = C * (1 - pct);
  const done = soll > 0 && ist >= soll;

  // Spiel-Filter-Liste (nur gespielte Spiele)
  const filterRows = playedMatches()
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .map((m) => {
      const h = team(m.home), a = team(m.away);
      const on = !state.disabled.has(m.id);
      const g  = goalsOf(m);
      return `
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 text-[14px] font-medium">
              ${crest(h, 'crest-sm')}<span class="truncate">${h.name}</span>
              <span class="score text-[15px] mx-0.5">${m.score.home}:${m.score.away}</span>
              <span class="truncate">${a.name}</span>${crest(a, 'crest-sm')}
            </div>
            <div class="flex items-center gap-1.5 text-[11px] mt-0.5 text-ink-900/45 dark:text-ink-50/45">
              <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              <span class="tabular-nums">${fmtDate(m.utcDate)} · ${fmtTime(m.utcDate)} Uhr</span>
              ${m.status === 'IN_PLAY' ? `<span class="text-wm-red font-semibold">· ${m.minute}'</span>` : ''}
            </div>
            <div class="text-[11px] mt-0.5 ${on ? 'text-wm-green' : 'text-ink-900/35 dark:text-ink-50/35 line-through'}">
              ${g} ${g === 1 ? 'Tor' : 'Tore'} ${on ? 'gewertet' : 'ausgenommen'} · Gruppe ${m.group}
            </div>
          </div>
          <button data-action="toggle-match" data-id="${m.id}" data-on="${on}" role="switch" aria-checked="${on}"
                  class="switch shrink-0 ${on ? 'bg-wm-green' : 'bg-black/15 dark:bg-white/20'}">
            <span class="switch-knob block bg-white rounded-full ml-0.5 mt-0.5"></span>
          </button>
        </div>`;
    }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

  return `
    <!-- Fortschrittsring -->
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark p-6 mb-5">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-[15px] font-bold">Deine Bilanz</h3>
        ${streak > 0
          ? `<span class="inline-flex items-center gap-1 text-[13px] font-bold px-2.5 py-1 rounded-full bg-wm-red/10 text-wm-red">
               <span class="flame">🔥</span>${streak} ${streak === 1 ? 'Tag' : 'Tage'}</span>`
          : `<span class="text-[12px] text-ink-900/40 dark:text-ink-50/40">noch kein Streak</span>`}
      </div>
      <div class="relative grid place-items-center">
        <svg width="200" height="200" viewBox="0 0 200 200" class="-rotate-90">
          <circle class="ring-track" cx="100" cy="100" r="${R}" fill="none" stroke-width="16"/>
          <circle id="ring-value" class="ring-value" cx="100" cy="100" r="${R}" fill="none" stroke-width="16"
                  stroke="${done ? '#34C759' : '#E4B458'}"
                  stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
        </svg>
        <div class="absolute inset-0 grid place-content-center text-center">
          <p class="text-[11px] font-semibold tracking-widest uppercase text-ink-900/45 dark:text-ink-50/45">${done ? 'Geschafft' : 'Offen'}</p>
          <p id="c-open" class="text-[44px] font-extrabold leading-none tabular-nums ${done ? 'text-wm-green' : ''}">${fmtKm(open)}</p>
          <p class="text-[13px] text-ink-900/45 dark:text-ink-50/45">${done ? 'alles gelaufen 🎉' : 'km übrig'}</p>
        </div>
      </div>

      <!-- Soll / Ist / % -->
      <div class="grid grid-cols-3 gap-2 mt-5">
        ${stat('Soll', fmtKm(soll) + ' km', 'text-wm-gold')}
        ${stat('Gelaufen', fmtKm(ist) + ' km', 'text-wm-green', 'c-ist')}
        ${stat('Quote', Math.round(pct * 100) + ' %', 'text-wm-blue', 'c-quote')}
      </div>
    </div>

    ${sectionJourney(ist)}

    <!-- Kilometer-Tracker -->
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark p-5 mb-5">
      <h3 class="text-[15px] font-bold mb-1">Kilometer eintragen</h3>
      <p class="text-[12px] text-ink-900/45 dark:text-ink-50/45 mb-4">Trag deine gerade gelaufene Strecke ein.</p>

      <div class="flex items-center gap-3">
        <button data-action="add-km" data-amount="-1" aria-label="1 km abziehen"
                class="w-12 h-12 rounded-full grid place-items-center text-2xl font-light bg-black/5 dark:bg-white/10 active:scale-90 transition select-none">−</button>

        <form data-action="submit-km" class="flex-1">
          <div class="relative">
            <input id="km-input" type="number" inputmode="decimal" step="0.1" min="0" placeholder="0"
                   class="w-full text-center text-3xl font-bold tabular-nums bg-transparent outline-none py-1
                          placeholder:text-ink-900/20 dark:placeholder:text-ink-50/20"/>
            <span class="absolute right-1 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-900/35 dark:text-ink-50/35">km</span>
          </div>
        </form>

        <button data-action="add-km" data-amount="1" aria-label="1 km hinzufügen"
                class="w-12 h-12 rounded-full grid place-items-center text-2xl font-light bg-black/5 dark:bg-white/10 active:scale-90 transition select-none">+</button>
      </div>

      <div class="grid grid-cols-4 gap-2 mt-4">
        ${quickBtn(0.5)} ${quickBtn(1)} ${quickBtn(3)} ${quickBtn(5)}
      </div>

      <button data-action="submit-km-btn"
              class="w-full mt-4 py-3 rounded-xl bg-wm-blue text-white font-semibold active:scale-[.98] transition">
        Lauf hinzufügen
      </button>
    </div>

    ${sectionChart()}

    ${sectionHistory()}

    <!-- Spiel-Filter -->
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark overflow-hidden mb-5">
      <div class="px-4 pt-4 pb-2">
        <h3 class="text-[15px] font-bold">Spiele werten</h3>
        <p class="text-[12px] text-ink-900/45 dark:text-ink-50/45">Schalter aus = Tore dieses Spiels werden vom Soll abgezogen.</p>
      </div>
      ${filterRows || '<p class="px-4 pb-4 text-[13px] text-ink-900/45">Noch keine gespielten Partien.</p>'}
    </div>

    ${sectionBadges(snap)}

    <button data-action="reset"
            class="w-full py-3 rounded-xl text-wm-red font-medium text-[14px] active:opacity-60 transition mb-2">
      Fortschritt zurücksetzen
    </button>`;
}

const stat = (label, value, color, id = '') => `
  <div class="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-2 py-3 text-center">
    <p class="text-[10px] font-semibold tracking-wide uppercase text-ink-900/40 dark:text-ink-50/40">${label}</p>
    <p ${id ? `id="${id}"` : ''} class="text-[17px] font-bold tabular-nums mt-0.5 ${color}">${value}</p>
  </div>`;

const quickBtn = (km) => `
  <button data-action="add-km" data-amount="${km}"
          class="py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[14px] font-semibold active:scale-95 transition">
    +${fmtKm(km)}
  </button>`;

/* ------------------------------------------------------------------ *
 * 6b) CHALLENGE-SEKTIONEN
 * ------------------------------------------------------------------ */

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
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark p-5 mb-5">
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
        <div class="absolute inset-y-0 left-0 rounded-full" style="width:${(pct * 100).toFixed(1)}%;background:linear-gradient(90deg,#E4B458,#34C759)"></div>
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
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark p-5 mb-5">
      <h3 class="text-[15px] font-bold mb-1">Verlauf</h3>
      <p class="text-[13px] text-ink-900/45 dark:text-ink-50/45">Sobald ein paar Tage Daten da sind, siehst du hier Soll vs. Gelaufen.</p>
    </div>`;
  }

  const W = 320, H = 130, P = 8;
  const n = data.days.length;
  const x = (i) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / data.maxY) * (H - 2 * P);
  const line = (key) => data.days.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const istArea = `${P},${H - P} ${line('ist')} ${(W - P)},${H - P}`;

  return `
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark p-5 mb-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[15px] font-bold">Verlauf</h3>
        <div class="flex items-center gap-3 text-[11px]">
          <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-wm-gold"></span>Soll</span>
          <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-wm-green"></span>Gelaufen</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="w-full" preserveAspectRatio="none" style="height:130px">
        <polygon points="${istArea}" fill="#34C759" opacity="0.12"/>
        <polyline points="${line('soll')}" fill="none" stroke="#E4B458" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        <polyline points="${line('ist')}"  fill="none" stroke="#34C759" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
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
          <p class="text-[14px] font-semibold tabular-nums ${pos ? '' : 'text-wm-red'}">${pos ? '+' : ''}${fmtKm(r.km)} km</p>
          <p class="text-[11px] text-ink-900/45 dark:text-ink-50/45">${date} · ${time} Uhr</p>
        </div>
        <button data-action="delete-run" data-id="${r.id}" aria-label="Eintrag löschen"
                class="w-8 h-8 grid place-items-center rounded-full text-ink-900/35 dark:text-ink-50/35 active:bg-black/5 dark:active:bg-white/10 transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        </button>
      </div>`;
  }).join('<div class="h-px bg-black/5 dark:bg-white/10 mx-4"></div>');

  return `
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark overflow-hidden mb-5">
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
    <div class="fade-up rounded-xl2 bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark p-4 mb-5">
      <div class="flex items-center justify-between mb-3 px-1">
        <h3 class="text-[15px] font-bold">Erfolge</h3>
        <span class="text-[12px] text-ink-900/45 dark:text-ink-50/45 tabular-nums">${got}/${BADGES.length}</span>
      </div>
      <div class="grid grid-cols-3 gap-2">${cells}</div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * 7) RENDER-DISPATCH
 * ------------------------------------------------------------------ */
function render() {
  const app = document.getElementById('app');

  if (state.loading) {
    app.innerHTML = `<div class="py-24 grid place-items-center text-ink-900/40 dark:text-ink-50/40">
      <svg class="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".2"/><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
    </div>`;
    return;
  }

  app.innerHTML = state.tab === 'ticker' ? viewTicker() : viewChallenge();
  document.getElementById('header-title').textContent = state.tab === 'ticker' ? 'Live-Ticker' : 'Lauf-Challenge';
  setGreeting();

  // Aktiven Nav-Button als Kapsel hervorheben
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('nav-active', btn.dataset.tab === state.tab);
  });

  if (state.tab === 'challenge') onChallengeRendered();
}

/** Tageszeit-abhängige Begrüßung im Header */
function setGreeting() {
  const el = document.getElementById('header-greet');
  if (!el) return;
  const h = new Date().getHours();
  const greet = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  el.textContent = `${greet} 👋`;
}

/* ------------------------------------------------------------------ *
 * 8) AKTIONEN / EVENTS  (Event-Delegation)
 * ------------------------------------------------------------------ */
let runSeq = 0;

function addRun(delta) {
  delta = Math.round(delta * 10) / 10;
  if (!delta) return;

  const before = snapshot();
  state.runs.push({ id: `${Date.now()}-${runSeq++}`, km: delta, ts: Date.now() });
  persist();
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

function removeRun(id) {
  state.runs = state.runs.filter((r) => r.id !== id);
  // Badges neu bewerten (nur entfernen, nicht neu feiern)
  const snap = snapshot();
  state.seenBadges = new Set([...state.seenBadges].filter((bid) => {
    const def = BADGES.find((b) => b.id === bid);
    return def ? def.test(snap) : false;
  }));
  persist();
  render();
}

function submitKmFromInput() {
  const input = document.getElementById('km-input');
  if (!input) return;
  const val = parseFloat(input.value);
  if (!isNaN(val) && val !== 0) addRun(val);
  else input.value = '';
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

    case 'ticker-view':
      if (state.tickerView !== el.dataset.view) {
        state.tickerView = el.dataset.view;
        persist();
        render();
      }
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

    case 'add-km':
      addRun(parseFloat(el.dataset.amount));
      break;

    case 'submit-km-btn':
      submitKmFromInput();
      break;

    case 'delete-run':
      removeRun(el.dataset.id);
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
    : `<button data-action="install" class="text-[13px] font-semibold text-white bg-wm-blue px-4 py-1.5 rounded-full active:scale-95 transition">Installieren</button>`;

  const el = document.createElement('div');
  el.id = 'install-banner';
  el.className = 'fixed inset-x-0 z-50 px-4 fade-up';
  el.style.bottom = 'calc(env(safe-area-inset-bottom) + 4.75rem)';
  el.innerHTML = `
    <div class="max-w-md mx-auto rounded-2xl bg-white dark:bg-ink-900 shadow-card dark:shadow-card-dark
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
    if (openEl) openEl.textContent = fmtKm(open);
    if (istEl) istEl.textContent = fmtKm(ran) + ' km';
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
  floatingToast(`+${fmtKm(c.delta)} km 🔥`);
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

// Optionaler Tab-Deeplink (?tab=ticker|challenge)
const urlTab = (typeof location !== 'undefined') ? new URLSearchParams(location.search).get('tab') : null;
if (urlTab === 'ticker' || urlTab === 'challenge') state.tab = urlTab;

(async function init() {
  render();                         // Lade-Spinner
  state.data = await fetchMatches();
  state.loading = false;
  render();

  scheduleNextPoll();               // Live-Updates starten (nur falls Worker konfiguriert)

  // iOS bietet kein beforeinstallprompt → eigener Hinweis (nur Safari, nicht installiert)
  if (isIOS() && !isStandalone()) showInstallBanner('ios');
})();
