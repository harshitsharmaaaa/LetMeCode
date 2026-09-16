import { Job, Worker } from "bullmq";
import { getDb } from "./lib/prisma";
import {
  SUBMISSIONS_QUEUE_NAME,
  getRedisUrl,
  type SubmissionJobData,
} from "./lib/queue";
import { JudgeError, runJudge } from "./lib/judge/judge";

// Background judge worker: one submission at a time (concurrency 1).
// Reuses the existing synchronous runJudge(); this process only moves
// Submission QUEUED -> RUNNING -> final status and persists the result.
//
// Retry policy lives in the queue's defaultJobOptions (3 attempts,
// exponential backoff). Only infrastructure failures throw and retry:
// valid judge outcomes are returned as statuses, never thrown. A missing
// submission (e.g. deleted after enqueue) is a no-op, not an error.

async function processSubmission(job: Job<SubmissionJobData>): Promise<void> {
  const submissionId = job.data?.submissionId;
  if (typeof submissionId !== "string" || submissionId === "") {
    throw new Error("Job is missing submissionId");
  }

  const db = getDb();

  const submission = await db.orm.public.Submission.where((s) =>
    s.id.eq(submissionId),
  )
    .select("id", "status")
    .first();

  if (submission === null) {
    return;
  }

  // Already final (e.g. a retry after the result was persisted).
  if (submission.status !== "QUEUED" && submission.status !== "RUNNING") {
    return;
  }

  await db.orm.public.Submission.where((s) => s.id.eq(submissionId)).update({
    status: "RUNNING",
  });

  let result;
  try {
    result = await runJudge(submissionId);
  } catch (err) {
    if (err instanceof JudgeError && err.status === 404) {
      // Submission disappeared mid-run; nothing to update.
      return;
    }
    throw err;
  }

  const failedIndex = result.testResults.findIndex((t) => !t.passed);

  await db.orm.public.Submission.where((s) => s.id.eq(submissionId)).update({
    status: result.status,
    passedTests: result.passedTests,
    totalTests: result.totalTests,
    executionTimeMs: result.executionTimeMs,
    failedTestNumber: failedIndex === -1 ? null : failedIndex + 1,
  });

  console.log(`Submission ${submissionId} judged: ${result.status}`);
}

const worker = new Worker<SubmissionJobData>(
  SUBMISSIONS_QUEUE_NAME,
  processSubmission,
  { connection: { url: getRedisUrl() }, concurrency: 1 },
);

worker.on("failed", (job, err) => {
  console.error(`Submission ${job?.data?.submissionId} failed: ${err.message}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, closing worker...`);
  await worker.close();
  const db = getDb();
  await db.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`Judge worker listening on "${SUBMISSIONS_QUEUE_NAME}"`);
