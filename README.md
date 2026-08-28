# Simul

Turn-based idle nation sim. Guest play uses an httpOnly cookie — no Google keys required.

The Next.js app lives in `apps/web` and persists guests, saves, and assignment drafts on **Convex** (not SQLite). Simulation math stays in `packages/sim` and is unchanged.

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env.local` once Convex prints your deployment URL.

## Local development

In one terminal, push functions and watch the Convex backend:

```bash
npx convex dev
```

The first run logs in (or starts a local backend) and writes `CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. If codegen overwrites `convex/_generated/`, that is expected.

In another terminal:

```bash
pnpm --filter web dev
```

Open http://localhost:3000. Guest cookies (`simul_guest`, httpOnly, 180 days) are minted by `POST /api/guest`.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install workspace deps |
| `npx convex dev` | Convex dev loop + codegen |
| `pnpm --filter web dev` | Next.js app |
| `pnpm test` | sim + db + content + Convex unit tests |
| `pnpm typecheck` | all packages + `convex/` |

## Tests

Catch-up week math and assignment weights do not need Convex or SQLite:

- `packages/db/test/catchup.test.ts` — `catchupWeeks` / `planCatchupWeeks` (216 cap, `clientNow` 400)
- `packages/sim/test/assign.test.ts` — YAML country weights
- `convex/*.test.ts` — guests, assignment drafts, catch-up (convex-test)

```bash
pnpm --filter @simul/sim --filter @simul/content --filter @simul/db test
pnpm test:convex
```

## Deploy

1. **Convex** (functions + tables)

   ```bash
   npx convex deploy
   ```

   Production CI uses `CONVEX_DEPLOY_KEY` from the Convex dashboard (Settings → Deploy Keys). Do not commit it.

2. **Vercel** (Next.js)

   - Root Directory: repository root (this `vercel.json` runs `pnpm --filter web build`)
   - Node.js 22
   - Environment variables:
     - `NEXT_PUBLIC_CONVEX_URL` — production Convex URL (`https://….convex.cloud`)
     - `CONVEX_URL` — same URL, used by Next server routes
     - `CONVEX_DEPLOY_KEY` — only if you deploy Convex from Vercel/CI

   Optional Vercel build command that deploys Convex then Next:

   ```bash
   npx convex deploy --cmd "pnpm --filter web build"
   ```

Guest play on Vercel still needs no Google OAuth keys.

## Layout

- `apps/web` — Next.js App Router (`/api/guest`, `/api/saves`, `/api/saves/assign`, `/api/saves/:id/catchup`)
- `convex/` — schema + queries/mutations/actions
- `packages/sim` — pure tick / assign / events
- `packages/content` — YAML season pack
- `packages/db` — catch-up helpers (no native SQLite)
