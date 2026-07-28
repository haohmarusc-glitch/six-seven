---
name: run-six-seven
description: Launch and drive the six-seven app (Vite/React client + Express/Drizzle/Postgres server) in this sandbox, including a headless-Chromium driver for testing camera/upload, vote, leaderboard, and admin flows. Use when asked to run, start, test, or screenshot six-seven, or to confirm a change works in the real app.
---

# Running six-seven

Single Express process serves both the API and the built client on one
port (`server/src/index.ts`) — no separate dev server or CORS/proxy
needed once the client is built. Confirmed working end-to-end in this
sandbox on 2026-07-28 (record→upload, vote, report, leaderboard, admin
approve/reject/delete).

## 0. Check for an already-configured DATABASE_URL

On Replit (`.replit` declares a `postgresql-16` module + object storage
bucket) `DATABASE_URL` and `REPL_ID` are injected automatically, and
`REPL_ID` being set switches `server/src/storage.ts` to Replit Object
Storage instead of local disk. In a plain sandbox neither is set — steps
1 and the `REPL_ID`-unset path apply.

```bash
echo "DATABASE_URL=$DATABASE_URL"   # if non-empty, skip step 1
```

## 1. Postgres (skip if DATABASE_URL already set)

This sandbox ships a stopped local Postgres 16 cluster on port 5432.

```bash
pg_lsclusters                                  # confirms cluster name/port if unsure
service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE sixseven;"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sixseven"
```

## 2. Push the schema

`server/drizzle.config.ts` reads `DATABASE_URL` and throws if unset.

```bash
cd server && npx drizzle-kit push --force && cd ..
```

## 3. Build the client

`server/src/index.ts` serves `../../dist` (i.e. repo-root `dist/`) as
static files. Build it once before starting the server:

```bash
npm run build   # tsc -b && vite build, from repo root
```

## 4. Start the server

Required env: `DATABASE_URL`. Optional: `PORT` (default 5173),
`ADMIN_TOKEN` (moderation panel is fail-closed without it — every
`/api/admin/*` route 503s), `ANTHROPIC_API_KEY` (enables Haiku
pre-screening of uploads in `server/src/moderation.ts`; without it every
upload just falls back to `pending`, which is fine for local testing).

```bash
cd server
DATABASE_URL="$DATABASE_URL" PORT=5055 ADMIN_TOKEN=testtoken123 \
  npx tsx src/index.ts &
cd ..
timeout 15 bash -c 'until curl -sf http://localhost:5055/api/health >/dev/null; do sleep 1; done'
```

## 5. Stop

```bash
lsof -ti:5055 -sTCP:LISTEN | xargs -r kill
```
(The npm/tsx process tree doesn't forward `SIGTERM` cleanly — kill the
port's listener, not the shell job.)

## Driving it with a real browser

No `chromium-cli` in this sandbox. Use Playwright directly — it's
already installed globally, and the pre-installed Chromium is a direct
executable, not nested under a versioned dir:

```js
executablePath: "/opt/pw-browsers/chromium"   // symlink straight to `chrome`
```

`playwright` isn't resolvable from an arbitrary scratch directory and
neither is `pg` (needed to seed data directly — see below). Run driver
scripts from **inside this repo** (`server/node_modules` already has
`pg`) and symlink in `playwright`:

```bash
mkdir -p node_modules
ln -sf /opt/node22/lib/node_modules/playwright node_modules/playwright
```

[`drive.mjs`](drive.mjs) in this skill dir is a ready-to-run driver:
launches Chromium with fake-camera flags, exercises every screen
(record/upload, "Meus clipes" delete, battle vote, report, leaderboard,
admin login + approve/reject/delete), screenshots each step to
`./screenshots/`, and prints a pass/fail summary. Copy or symlink it
into the repo root and run with `node drive.mjs` after starting the
server (adjust `BASE`/`DATABASE_URL`/`ADMIN_TOKEN` consts at the top if
you changed the defaults above).

### Gotchas

- **Fake camera flags are required** for the record flow to get past
  `getUserMedia`: `--use-fake-device-for-media-stream
  --use-fake-ui-for-media-stream`, plus `--no-sandbox`.
- **Timing, not bugs**: the "enviado pra revisão" upload toast fades
  after 1.4s, and the battle view's "VENCEU" flash reverts (and loads
  the next round) 700ms after a vote. A `screenshot` taken >1s after
  the triggering click will legitimately show neither — check the
  *next* screenshot (list updated / new round loaded) instead of
  re-asserting on the transient one.
- **Nav is button text, not routes**: bottom tabs are plain React state
  in `src/App.tsx` (`Tab = "record" | "vote" | "rank"`), button labels
  "Farmar" / "Batalha" / "Ranking". `/admin` is a real separate route
  (checks `window.location.pathname`), not reachable from the nav.
- **Empty vote/leaderboard/admin screens**: recording needs a real
  (if garbage) video blob and only produces one clip owned by whatever
  `device_id` the browser generated — not enough for a battle (needs 2
  approved clips from *different* devices). Fastest path to non-empty
  screens is seeding rows directly:
  ```sql
  INSERT INTO clips (device_id, label, video_key, content_type, status, wins, losses, report_count)
  VALUES ('seed-device-a', 'Aura máxima A', 'clipA', 'video/webm', 'approved', 0, 0, 0),
         ('seed-device-b', 'Aura sombria B', 'clipB', 'video/webm', 'approved', 0, 0, 0);
  ```
  and creating matching dummy files in `server/uploads/<video_key>` (any
  bytes — the UI never actually decodes them in headless tests unless
  you assert on video playback).
- To seed a clip owned by *this test browser* (e.g. to test the user
  "excluir" button on `src/components/RecordView.tsx`'s "Meus clipes"
  list), read `localStorage.getItem("six-seven:device-id")` from the
  page **after** its first load (that's when the client generates and
  persists it — see `src/lib/deviceId.ts`), then `INSERT` a clip row
  with that exact `device_id`.
