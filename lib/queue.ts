import { Queue } from "bullmq";
import Redis from "ioredis";

// BullMQ queue for asynchronous submission judging.
// PostgreSQL remains the source of truth: jobs carry only the submission id.
export const SUBMISSIONS_QUEUE_NAME = "leetcode-submissions";

export type SubmissionJobData = {
  submissionId: string;
};

export function getRedisUrl(): string {
  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }
  return url;
}

let queue: Queue<SubmissionJobData> | undefined;

export function getSubmissionQueue(): Queue<SubmissionJobData> {
  if (!queue) {
    queue = new Queue<SubmissionJobData>(SUBMISSIONS_QUEUE_NAME, {
      connection: {
        url: getRedisUrl(),
        // Fail fast when Redis is unreachable: the submission endpoint
        // must return 503 quickly instead of hanging on a dead queue.
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
      defaultJobOptions: {
        // Infrastructure failures only: user-code outcomes (ACCEPTED,
        // WRONG_ANSWER, TLE, MLE, RUNTIME_ERROR) are returned as results
        // and never thrown, so they are never retried.
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    });
    // Prevent unhandled 'error' events from crashing the process when
    // Redis drops; enqueue calls still reject and are handled by callers.
    queue.on("error", (err) => {
      console.error(`Submission queue error: ${err.message}`);
    });
  }
  return queue;
}

// Enqueue one judging job per submission. jobId = submissionId prevents
// accidental duplicate queueing of the same submission.
// Bounded by a timeout so a dead Redis fails fast (503) instead of hanging
// the request: BullMQ waits for Redis to return on its own.
const ENQUEUE_TIMEOUT_MS = 5000;

export async function enqueueSubmission(submissionId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Queue enqueue timed out")),
      ENQUEUE_TIMEOUT_MS,
    );
    getSubmissionQueue()
      .add("judge", { submissionId }, { jobId: submissionId })
      .then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
  });
}

let redis: Redis | undefined;

// Lightweight Redis ping for the readiness endpoint.
export async function pingRedis(): Promise<void> {
  if (!redis) {
    redis = new Redis(getRedisUrl(), { maxRetriesPerRequest: 1 });
    // Swallow background error events; ping() still rejects on failure.
    redis.on("error", () => {});
  }
  await redis.ping();
}
