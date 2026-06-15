/* =====================================================================
 * WM 2026 · Lauf-Challenge — Caching-Proxy (Cloudflare Worker)
 * ---------------------------------------------------------------------
 * Aufgabe:
 *   - Mischt zwei Quellen:  football-data.org (Plan + Endergebnisse, Basis)
 *                           API-Football      (Live-Minute + Live-Stand, Overlay)
 *   - Cacht das Ergebnis am Edge → die Zahl der Upstream-Requests ist
 *     UNABHÄNGIG von der Nutzerzahl (entkoppelt Last von Usern).
 *   - Liefert exakt das App-Schema { competition, groups, matches } → kein
 *     Mapping in der App nötig.
 *   - Stale-Fallback: fällt eine API aus, kommt der letzte gute Stand.
 *
 * Endpoint:  GET /api/matches
 *
 * Secrets (via `wrangler secret put …`):
 *   FOOTBALL_DATA_KEY   – Token von football-data.org   (Basis/Plan/Ergebnisse)
 *   API_FOOTBALL_KEY    – Key von api-sports.io          (Live-Overlay)
 * Vars (wrangler.toml):
 *   DEMO_MODE = "true"  – ignoriert die Keys, liefert Demo-Daten (zum Testen)
 * ===================================================================== */

const TTL_LIVE = 60;     // s: Cache-Dauer, solange ein Spiel läuft
const TTL_BASE = 600;    // s: Cache-Dauer sonst (Ergebnisse ändern sich selten)
const FD_COMPETITION = 'WC';   // football-data: FIFA World Cup
const SEASON = 2026;

/* ---- CORS (Browser-Zugriff aus der App erlauben) ---- */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/* ---- Länder-Flaggen (Emoji) aus englischem Teamnamen ---- */
const NAME2ISO = {
  Germany:'DE', Brazil:'BR', Argentina:'AR', France:'FR', Spain:'ES', England:'GB',
  Portugal:'PT', Netherlands:'NL', Belgium:'BE', Italy:'IT', Croatia:'HR', Switzerland:'CH',
  Poland:'PL', Denmark:'DK', Serbia:'RS', Austria:'AT', Ukraine:'UA', Wales:'GB',
  Mexico:'MX', 'United States':'US', USA:'US', Canada:'CA', Uruguay:'UY', Colombia:'CO',
  Ecuador:'EC', Chile:'CL', Peru:'PE', Paraguay:'PY', 'Costa Rica':'CR',
  Japan:'JP', 'South Korea':'KR', 'Korea Republic':'KR', 'Saudi Arabia':'SA', Iran:'IR',
  Australia:'AU', Qatar:'QA', 'United Arab Emirates':'AE', Iraq:'IQ', China:'CN',
  Morocco:'MA', Senegal:'SN', Tunisia:'TN', Egypt:'EG', Algeria:'DZ', Nigeria:'NG',
  Ghana:'GH', Cameroon:'CM', 'Ivory Coast':'CI', "Côte d'Ivoire":'CI', 'South Africa':'ZA',
  Mali:'ML', 'New Zealand':'NZ', Jamaica:'JM', Panama:'PA', Honduras:'HN',
};
const toFlag = (iso) => iso
  ? iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
  : '🏳️';
const flagFor = (name) => toFlag(NAME2ISO[name]);

/* ---- Status-Mapping ---- */
const FD_STATUS = { FINISHED:'FINISHED', IN_PLAY:'IN_PLAY', PAUSED:'IN_PLAY', SUSPENDED:'IN_PLAY' };
const AF_STATUS = { '1H':'IN_PLAY','2H':'IN_PLAY','ET':'IN_PLAY','P':'IN_PLAY','HT':'IN_PLAY','LIVE':'IN_PLAY',
                    FT:'FINISHED', AET:'FINISHED', PEN:'FINISHED' };

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
const pairKey = (home, away) => `${norm(home)}|${norm(away)}`;

/* =====================================================================
 * QUELLE 1 — football-data.org  (Plan + Ergebnisse, Basis-Schema)
 * ===================================================================== */
async function fetchBase(env) {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${FD_COMPETITION}/matches?season=${SEASON}`,
    { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_KEY }, cf: { cacheTtl: 60 } }
  );
  if (!res.ok) throw new Error(`football-data ${res.status}`);
  const data = await res.json();

  const groups = {};
  const matches = (data.matches || []).map((m) => {
    const grp = (m.group || '').replace(/^GROUP_/, '') || '–';
    const home = m.homeTeam?.name ?? '—';
    const away = m.awayTeam?.name ?? '—';
    const hCode = m.homeTeam?.tla ?? norm(home).slice(0, 3).toUpperCase();
    const aCode = m.awayTeam?.tla ?? norm(away).slice(0, 3).toUpperCase();

    // Teams je Gruppe sammeln (für die Ticker-Ansicht), inkl. echtem Wappen
    if (grp !== '–') {
      groups[grp] ??= [];
      for (const [code, name, crest] of [[hCode, home, m.homeTeam?.crest], [aCode, away, m.awayTeam?.crest]]) {
        if (!groups[grp].some((t) => t.code === code)) {
          groups[grp].push({ code, name, flag: flagFor(name), crest: crest || null });
        }
      }
    }

    return {
      id: String(m.id),
      group: grp,
      stage: m.stage ?? null,            // GROUP_STAGE | LAST_16 | … (für K.o.-Baum)
      venue: m.venue ?? null,            // Stadion (fürs Detail-Sheet, falls vorhanden)
      status: FD_STATUS[m.status] ?? 'SCHEDULED',
      utcDate: m.utcDate,
      _home: home, _away: away,          // intern: für Live-Matching
      home: hCode, away: aCode,
      _hName: home, _aName: away,
      score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
    };
  });

  return { competition: 'FIFA World Cup 2026', groups, matches };
}

/* =====================================================================
 * QUELLE 2 — API-Football  (Live-Overlay: Minute + Live-Stand)
 * ===================================================================== */
async function fetchLiveOverlay(env) {
  const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY }, cf: { cacheTtl: 30 },
  });
  if (!res.ok) throw new Error(`api-football ${res.status}`);
  const data = await res.json();

  const map = new Map();
  for (const f of data.response || []) {
    map.set(pairKey(f.teams?.home?.name, f.teams?.away?.name), {
      status: AF_STATUS[f.fixture?.status?.short] ?? 'IN_PLAY',
      minute: f.fixture?.status?.elapsed ?? null,
      fixtureId: f.fixture?.id ?? null,
      score: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    });
  }
  return map;
}

/* =====================================================================
 * QUELLE 3 — football-data.org  (Torschützenliste)
 * ===================================================================== */
async function fetchScorers(env) {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${FD_COMPETITION}/scorers?limit=10`,
    { headers: { 'X-Auth-Token': env.FOOTBALL_DATA_KEY }, cf: { cacheTtl: 120 } }
  );
  if (!res.ok) throw new Error(`scorers ${res.status}`);
  const data = await res.json();
  return (data.scorers || []).map((s) => ({
    name: s.player?.name ?? '—',
    team: s.team?.name ?? '',
    flag: flagFor(s.team?.name),
    goals: s.goals ?? 0,
  }));
}

/* =====================================================================
 * QUELLE 4 — API-Football  (Spiel-Detail: Aufstellung, Statistik, Events)
 * ===================================================================== */
const AF_BASE = 'https://v3.football.api-sports.io';
const photoUrl = (id) => id ? `https://media.api-sports.io/football/players/${id}.png` : null;

async function afGet(env, path) {
  const res = await fetch(`${AF_BASE}${path}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY }, cf: { cacheTtl: 60 },
  });
  if (!res.ok) throw new Error(`api-football ${res.status}`);
  return (await res.json()).response || [];
}

/** API-Football-Aufstellung → App-Schema (Zeilen aus grid „row:col") */
function mapLineup(l) {
  const grid = (g) => { const [r, c] = (g || '1:1').split(':').map(Number); return { r: r || 1, c: c || 1 }; };
  const players = (l.startXI || []).map((x) => ({ ...x.player, _g: grid(x.player.grid) }));
  const rows = {};
  for (const p of players) (rows[p._g.r] ??= []).push(p);
  const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b);
  const lines = rowKeys.map((rk) => rows[rk].length);
  const startXI = [];
  rowKeys.forEach((rk, li) => {
    rows[rk].sort((a, b) => a._g.c - b._g.c).forEach((p, j) => {
      startXI.push({ num: p.number, name: p.name, pos: p.pos, li, j, count: rows[rk].length, photo: photoUrl(p.id) });
    });
  });
  const subs = (l.substitutes || []).map((x) => ({ num: x.player.number, name: x.player.name, pos: x.player.pos, photo: photoUrl(x.player.id) }));
  return { formation: l.formation || '', coach: (l.coach && l.coach.name) || '', startXI, subs, lines, teamId: l.team && l.team.id };
}

function mapStats(arr, homeId) {
  const pick = (s, type) => { const f = (s.statistics || []).find((x) => x.type === type); let v = f ? f.value : 0; if (typeof v === 'string') v = parseInt(v) || 0; return v || 0; };
  const one = (s) => ({
    possession: pick(s, 'Ball Possession'), shots: pick(s, 'Total Shots'), shotsOn: pick(s, 'Shots on Goal'),
    passes: pick(s, 'Total passes'), passAcc: pick(s, 'Passes %'), corners: pick(s, 'Corner Kicks'),
    fouls: pick(s, 'Fouls'), yellow: pick(s, 'Yellow Cards'), offsides: pick(s, 'Offsides'), saves: pick(s, 'Goalkeeper Saves'),
  });
  const home = arr.find((s) => s.team && s.team.id === homeId) || arr[0];
  const away = arr.find((s) => s.team && s.team.id !== homeId) || arr[1];
  return (home && away) ? { home: one(home), away: one(away) } : null;
}

function mapEvents(arr, homeId) {
  return (arr || []).map((e) => {
    let type;
    if (e.type === 'Goal') type = e.detail === 'Penalty' ? 'penalty' : (e.detail === 'Own Goal' ? 'owngoal' : 'goal');
    else if (e.type === 'Card') type = e.detail === 'Red Card' ? 'red' : 'yellow';
    else if (e.type === 'subst') type = 'subst';
    else return null;
    return { minute: (e.time && e.time.elapsed) || 0, type, side: (e.team && e.team.id === homeId) ? 'home' : 'away', player: (e.player && e.player.name) || '' };
  }).filter(Boolean).sort((a, b) => a.minute - b.minute);
}

async function fetchMatchDetail(env, fixtureId) {
  const [lineups, stats, events] = await Promise.all([
    afGet(env, `/fixtures/lineups?fixture=${fixtureId}`).catch(() => []),
    afGet(env, `/fixtures/statistics?fixture=${fixtureId}`).catch(() => []),
    afGet(env, `/fixtures/events?fixture=${fixtureId}`).catch(() => []),
  ]);
  if (!lineups.length) return { lineups: null };   // App nutzt dann ihren eigenen Fallback
  const home = mapLineup(lineups[0]);
  const away = mapLineup(lineups[1] || lineups[0]);
  return { lineups: { home, away }, stats: mapStats(stats, home.teamId), events: mapEvents(events, home.teamId), predicted: false };
}

/* ---- Basis + Live verschmelzen (Live „veredelt" laufende Spiele) ---- */
function merge(base, liveMap) {
  if (liveMap && liveMap.size) {
    for (const m of base.matches) {
      const live = liveMap.get(pairKey(m._home, m._away));
      if (live) {
        m.status = live.status;
        m.minute = live.minute;
        if (live.fixtureId) m.fixtureId = live.fixtureId;   // für /api/match (Detail)
        if (live.score.home !== null) m.score = live.score;
      }
    }
  }
  // interne Felder entfernen
  for (const m of base.matches) { delete m._home; delete m._away; delete m._hName; delete m._aName; }
  return base;
}

/* =====================================================================
 * DEMO-DATEN  (DEMO_MODE oder fehlende Keys → App-Chain sofort testbar)
 * ===================================================================== */
const DEMO = {
  competition: 'FIFA World Cup 2026 (Demo)',
  groups: {
    A: [{code:'MEX',name:'Mexiko',flag:'🇲🇽'},{code:'POL',name:'Polen',flag:'🇵🇱'},{code:'KSA',name:'Saudi-Arab.',flag:'🇸🇦'},{code:'AUS',name:'Australien',flag:'🇦🇺'}],
    B: [{code:'CAN',name:'Kanada',flag:'🇨🇦'},{code:'BEL',name:'Belgien',flag:'🇧🇪'},{code:'MAR',name:'Marokko',flag:'🇲🇦'},{code:'JPN',name:'Japan',flag:'🇯🇵'}],
  },
  matches: [
    {id:'A1',group:'A',status:'FINISHED',utcDate:'2026-06-11T18:00:00Z',home:'MEX',away:'KSA',score:{home:3,away:1}},
    {id:'A2',group:'A',status:'FINISHED',utcDate:'2026-06-11T21:00:00Z',home:'POL',away:'AUS',score:{home:1,away:1}},
    {id:'A3',group:'A',status:'IN_PLAY', utcDate:'2026-06-14T16:00:00Z',home:'MEX',away:'POL',score:{home:2,away:0},minute:67},
    {id:'B1',group:'B',status:'FINISHED',utcDate:'2026-06-12T16:00:00Z',home:'CAN',away:'MAR',score:{home:2,away:2}},
    {id:'B2',group:'B',status:'FINISHED',utcDate:'2026-06-12T19:00:00Z',home:'BEL',away:'JPN',score:{home:4,away:1}},
  ],
  scorers: [
    { name: 'Kylian Mbappé', team: 'Frankreich', flag: '🇫🇷', goals: 4 },
    { name: 'Harry Kane',    team: 'England',    flag: '🏴', goals: 3 },
  ],
};

/* ---- Response-Helfer ---- */
const json = (obj, ttl) => new Response(JSON.stringify(obj), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${ttl}`, ...CORS },
});

/* =====================================================================
 * WORKER-ENTRY
 * ===================================================================== */
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (url.pathname === '/' ) {
      return json({ ok: true, service: 'WM 2026 Lauf-Challenge Proxy', endpoints: ['/api/matches', '/api/match?fixture=ID'] }, 60);
    }

    // Spiel-Detail (Aufstellung, Statistik, Events) — Edge-gecacht
    if (url.pathname === '/api/match') {
      const fixture = url.searchParams.get('fixture');
      if (!fixture) return new Response('missing fixture', { status: 400, headers: CORS });
      if (env.DEMO_MODE === 'true' || !env.API_FOOTBALL_KEY) return json({ lineups: null, demo: true }, 60);

      const cache = caches.default;
      const cacheKey = new Request(url.toString());
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      let payload, ttl = 120;
      try { payload = await fetchMatchDetail(env, fixture); }
      catch (e) { console.error('Detail-Fehler:', e.message); payload = { lineups: null, error: e.message }; ttl = 30; }
      const res = json(payload, ttl);
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }

    if (url.pathname !== '/api/matches') {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    // 1) Edge-Cache: kein Upstream-Call, solange frisch → entkoppelt von Nutzerzahl
    const cache = caches.default;
    const cacheKey = new Request(url.toString());
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    // 2) Frisch bauen
    let payload, ttl;
    try {
      if (env.DEMO_MODE === 'true' || !env.FOOTBALL_DATA_KEY) {
        payload = DEMO; ttl = TTL_BASE;
      } else {
        const base = await fetchBase(env);
        let liveMap = null;
        if (env.API_FOOTBALL_KEY) {
          try { liveMap = await fetchLiveOverlay(env); }
          catch (e) { console.warn('Live-Overlay übersprungen:', e.message); } // Basis bleibt nutzbar
        }
        payload = merge(base, liveMap);
        try { payload.scorers = await fetchScorers(env); }
        catch (e) { console.warn('Torschützen übersprungen:', e.message); }
        ttl = payload.matches.some((m) => m.status === 'IN_PLAY') ? TTL_LIVE : TTL_BASE;
      }
    } catch (e) {
      console.error('Upstream-Fehler:', e.message);
      payload = DEMO; ttl = 30;                 // Notfall: Demo statt Absturz
    }

    const res = json(payload, ttl);
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
