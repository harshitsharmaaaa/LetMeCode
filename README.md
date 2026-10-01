# LeetCode Platform

A LeetCode-style coding platform powered by BlackBox for sandboxed code execution.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Backend**: Next.js Route Handlers
- **Database**: Neon PostgreSQL (via Prisma ORM)
- **Queue**: Redis + BullMQ
- **Execution Engine**: BlackBox (external)

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- PostgreSQL (local or Neon)
- Redis (local or Upstash)
- BlackBox running on port 3001

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```
4. Seed the database:
   ```bash
   bun run db:seed
   ```
5. Start the development server:
   ```bash
   bun run dev
   ```
6. Start the judge worker (in a separate terminal):
   ```bash
   bun run worker
   ```

## Running BlackBox Locally

BlackBox is a separate project located at `./TheBlackBox`. See its README for setup instructions.

To run BlackBox alongside this app:

```bash
# In TheBlackBox directory
PORT=3001 bun run dev
```

Set `BLACKBOX_URL=http://localhost:3001` in your `.env` file.

## API Endpoints

### Public

- `GET /api/problems` - List all problems
- `GET /api/problems/:slug` - Get problem details (public test cases only)
- `POST /api/submissions` - Create a new submission
- `GET /api/submissions/:id` - Get submission status/result
- `GET /api/submissions?problemId=xxx` - List submissions for a problem
- `GET /api/health` - Health check
- `GET /api/health/ready` - Readiness check (PostgreSQL + Redis)

### Internal (development only)

- `POST /api/internal/judge/:submissionId/run` - Synchronous judge
- `POST /api/internal/judge/:submissionId/execute` - Execute single test case
- `POST /api/internal/harness/:submissionId` - Generate harness source

## Submission Flow

1. User submits code via `POST /api/submissions`
2. Submission is saved to PostgreSQL with status `QUEUED`
3. Job is enqueued to Redis via BullMQ
4. Worker picks up the job, sets status to `RUNNING`
5. Worker generates harness source and sends to BlackBox
6. BlackBox executes code in Docker sandbox
7. Worker compares output with expected output
8. Worker updates submission with final status and results

## Submission Statuses

- `QUEUED` - Waiting in queue
- `RUNNING` - Being judged
- `ACCEPTED` - All tests passed
- `WRONG_ANSWER` - Output mismatch
- `TIME_LIMIT_EXCEEDED` - Execution exceeded time limit
- `MEMORY_LIMIT_EXCEEDED` - Execution exceeded memory limit
- `RUNTIME_ERROR` - Runtime error in user code
- `COMPILE_ERROR` - Compilation failed (when distinguishable)
- `INTERNAL_ERROR` - Infrastructure failure (BlackBox unreachable, etc.)

## Project Structure

```
app/
  api/
    problems/          # Problem routes
    submissions/       # Submission routes
    health/            # Health check routes
    internal/          # Internal development routes
  problems/            # Problem pages
  submissions/         # Submission history page
  page.tsx             # Home page
lib/
  blackbox.ts          # BlackBox HTTP client
  judge/
    judge.ts           # Judge logic
    harness.ts         # Harness generation
  prisma.ts            # Database client
  queue.ts             # BullMQ queue
prisma/
  schema.prisma        # Database schema
  seed.ts              # Seed script
worker.ts              # BullMQ worker
```

## License

MIT
