# Setup-Anleitung (Klick für Klick)

Diese Anleitung ist für **dich**. Überall wo `🙋` steht, machst du etwas im Browser.
Code-Teile (`🤖`) übernehme ich danach – du musst nur die **Keys/URLs** liefern, die hier
markiert sind mit 👉 **KOPIEREN**.

> Tipp: Lege dir eine Notiz an mit den Werten, die du kopierst (URL, anon-Key,
> Resend-Key, VAPID-Keys). Die brauche ich, um den Code zu verdrahten.

---

## §1 — Supabase-Projekt anlegen

1. Gehe auf **https://supabase.com** → **Start your project** / **Sign in**
   (mit GitHub oder E-Mail).
2. Im Dashboard: **New project**.
3. Felder:
   - **Name:** `wm-lauf-challenge`
   - **Database Password:** ein starkes Passwort → 👉 **KOPIEREN & sicher speichern**
     (brauchst du selten, aber unbedingt aufheben).
   - **Region:** `Central EU (Frankfurt)` (nah an dir = schnell + DSGVO-freundlich).
   - **Plan:** **Free**.
4. **Create new project** → ~1–2 Min warten, bis es „grün" ist.

## §2 — URL & anon-Key holen

1. Linke Sidebar unten: **Project Settings** (Zahnrad) → **API Keys** (bzw. **API**).
2. Kopiere:
   - **Project URL** (z. B. `https://abcdxyz.supabase.co`) 👉 **KOPIEREN**
   - **anon public** Key (langer `eyJ...`-String) 👉 **KOPIEREN**
3. ⚠️ Den **`service_role`** Key NICHT in die App kopieren — der ist geheim und gehört
   nur in Server/Edge-Functions. Der **anon**-Key darf öffentlich sein (durch RLS abgesichert).

**Eintragen (das kannst du selbst):** In `app.js` ganz oben im `CONFIG`-Block die zwei
Werte einsetzen — sobald sie da stehen, schaltet sich Login & Cloud-Sync automatisch ein:

```js
const CONFIG = {
  // …
  supabase: {
    url:     'https://DEINPROJEKT.supabase.co',   // ← Project URL
    anonKey: 'eyJhbGciOi…',                        // ← anon public Key
  },
};
```

> Ist der Block leer (Standard), läuft die App wie bisher rein lokal. Mit Werten
> erscheint in **Einstellungen → Konto** der Anmelden-Button und deine Läufe/Einstellungen
> werden geräteübergreifend synchronisiert.

## §3 — Datenbank-Tabellen + Sicherheit (RLS)

1. Linke Sidebar: **SQL Editor** → **+ New query**.
2. Füge das komplette SQL unten ein → **Run** (rechts unten).

```sql
-- 1) Profile (1:1 zum Auth-User)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  challenge_enabled boolean not null default true,
  lang text not null default 'de',
  unit text not null default 'km',
  weekly_goal_km numeric not null default 15,
  created_at timestamptz not null default now()
);

-- 2) Läufe
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  km numeric not null check (km > 0),
  ran_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists runs_user_idx on public.runs(user_id, ran_at);

-- 3) Einstellungen (frei erweiterbar als JSON)
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 4) Push-Abos
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ===== Row Level Security: jeder sieht/ändert NUR seine eigenen Zeilen =====
alter table public.profiles            enable row level security;
alter table public.runs                enable row level security;
alter table public.settings            enable row level security;
alter table public.push_subscriptions  enable row level security;

create policy "own profile"  on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own runs"     on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own push"     on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profil automatisch beim Registrieren anlegen
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

3. Du solltest „Success. No rows returned" sehen. Fertig — die DB ist sicher:
   ohne gültigen Login kommt **niemand** an fremde Daten.

## §3b — Community-Ranking (Phase 5)

Für das echte „Top X %" + den Wochen-Leaderboard. **SQL Editor → New query → einfügen → Run:**

```sql
-- Profil um Ranglisten-Felder erweitern
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists leaderboard_optin boolean not null default false;

-- Aggregiertes Ranking (anonymisiert, RLS-sicher via security definer)
create or replace function public.community_stats()
returns jsonb language sql security definer set search_path = public stable as $$
  with totals as (
    select user_id, sum(km) as total_km,
           sum(km) filter (where ran_at >= date_trunc('week', now())) as week_km
    from public.runs group by user_id
  ),
  ranked as (
    select t.*, row_number() over (order by total_km desc, user_id) as rnk,
           count(*) over () as n
    from totals t
  )
  select jsonb_build_object(
    'total_players', coalesce((select max(n) from ranked), 0),
    'percentile', (select case when n>0 then greatest(1, ceil(rnk::numeric/n*100)) end
                   from ranked where user_id = auth.uid()),
    'me', (select jsonb_build_object('rank', rnk, 'total_km', round(total_km,1), 'week_km', round(coalesce(week_km,0),1))
           from ranked where user_id = auth.uid()),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', rnk,
               'name', case
                 when user_id = auth.uid() then coalesce(nullif(p.nickname,''), 'Du')
                 when p.leaderboard_optin then coalesce(nullif(p.nickname,''), nullif(p.display_name,''), 'Läufer #'||rnk)
                 else 'Läufer #'||rnk end,
               'total_km', round(total_km,1),
               'week_km', round(coalesce(week_km,0),1),
               'is_me', user_id = auth.uid()
             ) order by rnk)
      from ranked r left join public.profiles p on p.id = r.user_id
      where rnk <= 20
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.community_stats() to authenticated, anon;
```

Datenschutz: Die Funktion gibt **nur Aggregate** zurück. Andere erscheinen als
„Läufer #N", außer sie haben in den App-Einstellungen „In Rangliste anzeigen"
aktiviert. Niemand kann darüber fremde Einzeldaten lesen.

## §4 — Login-Methoden aktivieren

1. Sidebar: **Authentication** → **Sign In / Providers** (bzw. **Providers**).
2. **Email** muss **enabled** sein (Standard). Optionen:
   - **Confirm email**: AN lassen (sicherer).
   - **Magic Link** ist über E-Mail automatisch möglich.
3. **Authentication** → **URL Configuration**:
   - **Site URL:** die Adresse deiner App
     (lokal: `http://localhost:8080`; später deine Domain/Pages-URL).
   - **Redirect URLs:** dieselbe(n) Adresse(n) hinzufügen
     (z. B. `http://localhost:8080`, `https://deine-domain`).
   - 👉 Sag mir, welche URL du nutzt, dann passe ich die Auth-Redirects im Code an.

> Ohne Schritt §5 verschickt Supabase Mails über seinen eigenen Test-Absender
> (begrenzt, nicht gebrandet). Für **echte, eigene** Mails → §5.

## §5 — Gebrandete E-Mails (eigener Absender) via Resend

Ziel: Login-/Bestätigungs-Mails kommen von **deiner** Absenderadresse, schön gestaltet.

### 5a) Resend-Account + Domain

1. **https://resend.com** → registrieren (Free: 3.000 Mails/Monat).
2. **Domains** → **Add Domain** → deine Domain eingeben (z. B. `wm-challenge.app`).
   - **Kein eigene Domain?** Zwei Wege:
     a) Günstig eine Domain kaufen (Namecheap/Cloudflare ~10 €/Jahr) — empfohlen für „echt".
     b) Vorerst Supabase-Standard-Mails nutzen (§4) und §5 später nachholen.
3. Resend zeigt dir **DNS-Einträge** (SPF, DKIM, evtl. DMARC). Diese trägst du bei
   deinem Domain-Anbieter unter **DNS** ein (Typ/Name/Wert genau übernehmen).
   - Bei **Cloudflare** als DNS: Dashboard → deine Domain → **DNS** → **Add record**.
4. Zurück bei Resend → **Verify**. Warte bis alle Einträge ✅ sind (kann Minuten dauern).
5. **API Keys** → **Create API Key** → 👉 **KOPIEREN** (brauche ich für Edge Functions/Push-Mails).

### 5b) Resend als SMTP in Supabase (für Auth-Mails)

1. Supabase → **Project Settings** → **Authentication** → **SMTP Settings**
   → **Enable Custom SMTP**.
2. Werte (aus Resend, Menü **SMTP**):
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) oder `587`
   - **Username:** `resend`
   - **Password:** dein **Resend API Key**
   - **Sender email:** z. B. `login@deine-domain` (muss zur verifizierten Domain gehören)
   - **Sender name:** `WM Lauf-Challenge`
3. **Save**.

### 5c) Mail-Texte branden

1. Supabase → **Authentication** → **Email Templates**.
2. Passe **Confirm signup**, **Magic Link**, **Reset password** an
   (Betreff + HTML). 👉 Sag mir die gewünschte Tonalität/Logo — ich liefere dir
   fertige HTML-Vorlagen zum Einfügen.

## §6 — (Später, Phase 6) Web-Push / VAPID

Erst nötig, wenn wir Benachrichtigungen bauen.

1. VAPID-Schlüsselpaar erzeugen — ich gebe dir den genauen Befehl
   (`npx web-push generate-vapid-keys`), du führst ihn aus und schickst mir
   **Public + Private Key** 👉 **KOPIEREN**.
2. Supabase → **Edge Functions** → **Secrets**: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`,
   `RESEND_API_KEY` hinterlegen. (Genaue Klicks gebe ich dir in Phase 6.)

## §7 — (Optional) API-Football für Aufstellungen/Stats

Die Spiel-Tiefe (Phase 3) nutzt API-Football. Du hast den Key evtl. schon (Worker).

1. **https://www.api-sports.io** (bzw. dein bestehender RapidAPI/api-sports-Account)
   → Dashboard → dein **API-Key**.
2. Free-Tier = 100 Requests/Tag. Durch den **Edge-Cache** im Worker reicht das meist,
   da alle Nutzer denselben gecachten Stand teilen.
3. Reicht es nicht (viele Live-Spiele parallel): kleinstes bezahltes Paket wählen.
   Sag mir Bescheid, ich baue Cache-TTLs entsprechend defensiv.

---

## Checkliste „Was ich von dir brauche"

Sobald du diese Werte hast, schick sie mir (oder trag sie selbst in `app.js` ein,
ich zeige dir genau wo):

- [ ] Supabase **Project URL**
- [ ] Supabase **anon public** Key
- [ ] App-URL (Site URL / Redirect, z. B. `http://localhost:8080`)
- [ ] (für §5) Resend **API Key** + verifizierte **Absender-Adresse**
- [ ] (für Phase 3) API-Football **Key** (falls noch nicht im Worker)
- [ ] (für Phase 6) VAPID **Public/Private** Keys

> Der `service_role`-Key und das DB-Passwort bleiben bei dir — die brauche ich **nicht**
> im App-Code.
</content>
