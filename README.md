# LetMeCode

A LeetCode-style coding platform. Users browse problems, run their code
against public test cases, and submit for judging against the full suite
(public + hidden). All user code executes only through the external
BlackBox sandbox — never in this app.

## Architecture

```
Browser (Next.js App Router + React)
  │  GET /api/problems, /api/problems/:slug (public tests only)
  │  POST /api/runtime (Run Code — one public test, synchronous)
  │  POST /api/submissions → GET /api/submissions/:id (Submit — poll ~2s)
  ▼
Next.js Route Handlers
  │  Prisma ORM                        BullMQ job { submissionId }
  ▼                                     ▼
Neon PostgreSQL ◄────────────── Judge Worker (bun run worker)
(problems, test cases,        │  harness + BlackBox + output compare
 submissions)                 ▼
                    BlackBox HTTP API → Docker sandbox
                    (python · node · cpp · java)
```

Boundary: this app owns problems, test cases, submissions, judging, and
result presentation. BlackBox owns compilation, runtime, containers, and
limits. No `eval`, no `child_process`, no user code in Next.js.

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- A PostgreSQL database ([Neon](https://neon.tech/) recommended)
- Redis (local `redis-server` or Upstash)
- The BlackBox project checked out alongside this repo (sibling directory)

## Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable       | Example                         | Notes                                              |
| -------------- | ------------------------------- | -------------------------------------------------- |
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Neon pooled connection string (`sslmode=require`) |
| `REDIS_URL`    | `redis://localhost:6379`        | Queue + readiness check                            |
| `BLACKBOX_URL` | `http://localhost:3001`         | Server-side only. Never expose to the browser      |

`DATABASE_URL` and `BLACKBOX_URL` are read only on the server. The client
bundle contains no secrets, no hidden tests, and no generated harness code.

## Neon setup

1. Create a Neon project and copy the pooled connection string.
2. Put it in `.env` as `DATABASE_URL`.
3. Apply the schema and seed the three starter problems (each has 2 public
   + 2 hidden test cases):

```bash
bun install
bunx prisma migrate dev   # or `bunx prisma db push` for a fresh Neon DB
bun run db:seed
```

## Running the app

Three processes, three terminals:

```bash
# 1. Next.js (http://localhost:3000)
bun run dev

# 2. Judge worker (drains the BullMQ queue)
bun run worker

# 3. BlackBox — from the sibling checkout, on a NON-conflicting port
#    (Next.js already uses 3000, so use 3001; needs no file changes there)
cd ../TheBlackBox
PORT=3001 bun run dev
```

With `BLACKBOX_URL=http://localhost:3001` in `.env`, check
`GET /api/health/ready` (reports `{ postgres, redis }`) before testing.

## Test workflow (definition of done)

1. Open `/problems`, pick **Two Sum**.
2. Confirm the starter template matches the selected language.
3. Select public **Case 1**, press **Run Code** — see actual vs expected output.
4. Break the code (e.g. `return []`), run again — see **Failed**.
5. Press **Submit** — see `QUEUED → RUNNING → ACCEPTED` (or `WRONG_ANSWER`
   with `Test case N failed`, never hidden data).
6. Check `/submissions` for the new row with tests + runtime.

## API Endpoints

### Public

- `GET /api/problems` - List all problems (with supported languages)
- `GET /api/problems/:slug` - Problem details (**public test cases only**)
- `POST /api/runtime` - Run code against one public test case (`{ problemId, language, code, testCaseId }`)
- `POST /api/submissions` - Create a judged submission (all tests, async)
- `GET /api/submissions/:id` - Submission status/result (never includes `code`)
- `GET /api/submissions?problemId=xxx` - Submissions for a problem (omit `problemId` for latest 50)
- `GET /api/health` - Liveness check
- `GET /api/health/ready` - Readiness check (PostgreSQL + Redis)

### Internal (development only, 404 in production)

- `POST /api/internal/judge/:submissionId` - Judge preparation plan
- `POST /api/internal/judge/:submissionId/run` - Synchronous full judge
- `POST /api/internal/judge/:submissionId/execute` - First-test BlackBox execution (via harness)
- `POST /api/internal/harness/:submissionId` - Generated harness source

## Submission Flow

1. User submits code via `POST /api/submissions` (validated, rate-limited, max 64 KB)
2. Submission is saved to PostgreSQL with status `QUEUED`
3. Job is enqueued to Redis via BullMQ (`jobId = submissionId` dedupes)
4. Worker picks up the job, sets status to `RUNNING`
5. Worker generates per-test harness source and sends to BlackBox
6. BlackBox executes code in Docker sandbox (2 s / 128 MB defaults)
7. Worker compares stdout with expected output (trimmed exact match)
8. Worker updates submission with final status, `passedTests/totalTests`, `executionTimeMs`, `failedTestNumber`

Run Code (`POST /api/runtime`) skips the queue: one public test, direct
BlackBox call, returns stdout/stderr for the user to inspect.

## Submission Statuses

- `QUEUED` - Waiting in queue
- `RUNNING` - Being judged
- `ACCEPTED` - All tests passed
- `WRONG_ANSWER` - Output mismatch
- `TIME_LIMIT_EXCEEDED` - Execution exceeded time limit
- `MEMORY_LIMIT_EXCEEDED` - Execution exceeded memory limit
- `RUNTIME_ERROR` - Runtime error in user code
- `COMPILE_ERROR` - Compilation failed (conservative stderr heuristic over BlackBox `FAILED`; falls back to `RUNTIME_ERROR`)
- `INTERNAL_ERROR` - Infrastructure failure (BlackBox unreachable, queue failure, worker crash). User-code outcomes are never retried; infra failures are retried 3x with backoff.

## Rate limiting (limitation)

`POST /api/submissions` (20/min) and `POST /api/runtime` (30/min) use a
simple **process-local** in-memory bucket per client IP. It stops casual
spam without extra infrastructure, but each server instance enforces its own
budget — for multi-instance deployments, replace with a Redis counter.

## Project Structure

```
app/
  api/
    problems/          # Problem routes (public tests only)
    runtime/           # Run Code: one public test, synchronous
    submissions/       # Submission routes (no `code` in responses)
    health/            # Liveness + readiness routes
    internal/          # Dev-only judge/harness inspection (gated)
  problems/            # Problem list + detail workspace pages
  submissions/         # Submission history page
  page.tsx             # Home page
lib/
  blackbox.ts          # BlackBox HTTP client (server-side only)
  judge/
    judge.ts           # Judge logic + output comparison
    harness.ts         # Per-problem/per-language harness generation
  prisma.ts            # Database client
  queue.ts             # BullMQ queue
  ratelimit.ts         # Process-local rate limiter + shared guards
  starter.ts           # Per-problem/per-language starter templates
prisma/
  schema.prisma        # Database schema (Problem, TestCase, Submission)
  seed.ts              # Seed script (3 problems x 4 test cases)
worker.ts              # BullMQ judge worker
```

## License

MIT
