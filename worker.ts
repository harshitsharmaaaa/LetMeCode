import { Job, Worker } from "bullmq";
import { getDb } from "./lib/prisma";
import {
  SUBMISSIONS_QUEUE_NAME,
  getRedisUrl,
  type SubmissionJobData,
} from "./lib/queue";
import { JudgeError, runJudge } from "./lib/judge/judge";

const STALE_RUNNING_THRESHOLD_MS = 5 * 60 * 1000;

async function recoverStaleRunning(): Promise<void> {
  const db = getDb();
  const cutoff = new Date(Date.now() - STALE_RUNNING_THRESHOLD_MS);

  const running = await db.orm.public.Submission.where((s) =>
    s.status.eq("RUNNING"),
  )
    .select("id", "updatedAt")
    .all();

  for (const s of running) {
    if (new Date(s.updatedAt) < cutoff) {
      await db.orm.public.Submission.where((row) => row.id.eq(s.id)).update({
        status: "INTERNAL_ERROR",
      });
      console.log(
        `Recovered stale RUNNING submission ${s.id} -> INTERNAL_ERROR`,
      );
    }
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof JudgeError) {
    return false;
  }
  if (err instanceof Error) {
    const msg = err.message;
    return (
      msg.includes("BlackBox is unreachable") ||
      msg.includes("Timed out waiting for BlackBox") ||
      msg.includes("BlackBox create execution failed") ||
      msg.includes("BlackBox get execution failed")
    );
  }
  return false;
}

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
      return;
    }
    if (isRetryableError(err)) {
      throw err;
    }
    await db.orm.public.Submission.where((s) => s.id.eq(submissionId)).update({
      status: "INTERNAL_ERROR",
    });
    console.error(
      `Submission ${submissionId} marked INTERNAL_ERROR:`,
      err instanceof Error ? err.message : String(err),
    );
    return;
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
  const submissionId = job?.data?.submissionId;
  console.error(`Submission ${submissionId} failed: ${err.message}`);

  if (submissionId && job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    const db = getDb();
    db.orm.public.Submission.where((s) => s.id.eq(submissionId))
      .update({ status: "INTERNAL_ERROR" })
      .catch((updateErr) => {
        console.error(
          `Failed to mark ${submissionId} as INTERNAL_ERROR:`,
          updateErr,
        );
      });
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, closing worker...`);
  await worker.close();

  const db = getDb();
  const running = await db.orm.public.Submission.where((s) =>
    s.status.eq("RUNNING"),
  ).select("id").all();

  for (const s of running) {
    await db.orm.public.Submission.where((row) => row.id.eq(s.id)).update({
      status: "INTERNAL_ERROR",
    });
  }
  if (running.length > 0) {
    console.log(`Marked ${running.length} in-flight submission(s) as INTERNAL_ERROR`);
  }

  await db.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function main() {
  await recoverStaleRunning();
  console.log(`Judge worker listening on "${SUBMISSIONS_QUEUE_NAME}"`);
}

void main();
