import { getDb } from "@/lib/prisma";
import { executeWithBlackBox } from "@/lib/blackbox";
import { generateHarnessSource } from "@/lib/judge/harness";

// A single test execution the future executor will run.
export type JudgeTestCase = {
  id: string;
  input: string;
  expectedOutput: string;
};

// Normalized execution plan: everything the future execution layer needs.
// Includes hidden test cases — server-side only, never send to the frontend.
export type JudgePlan = {
  submissionId: string;
  problemId: string;
  problemSlug: string;
  language: string;
  code: string;
  testCases: JudgeTestCase[];
};

// Normalized result statuses the future executor can produce.
// Designed now so the execution layer can map to Submission.status later.
// Not persisted yet.
export type JudgeResultStatus =
  | "SUCCESS"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILE_ERROR"
  | "INTERNAL_ERROR";

export class JudgeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Final per-test / aggregate statuses for the synchronous judge run.
// These mirror SubmissionStatus values so the future worker can persist
// them directly. COMPILE_ERROR is intentionally unused: BlackBox reports
// compilation failures as FAILED with exit code 1 and compiler text on
// stderr (see TheBlackBox packages/sandbox/src/docker.ts), which is
// indistinguishable from a runtime failure at the HTTP boundary.
export type JudgeRunStatus =
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR";

// Safe per-test result: no input, no expected output, no generated source,
// no stdout/stderr. Safe to return even for hidden test cases.
export type JudgeTestResult = {
  testCaseId: string;
  passed: boolean;
  status: JudgeRunStatus;
  executionTimeMs: number | null;
};

// Aggregated result of judging one submission across all its test cases.
export type JudgeRunResult = {
  submissionId: string;
  status: JudgeRunStatus;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  testResults: JudgeTestResult[];
};

// Load a submission and prepare its execution plan.
// Does NOT execute code and does NOT change submission status.
export async function prepareJudgePlan(
  submissionId: string,
): Promise<JudgePlan> {
  const db = getDb();

  const submission = await db.orm.public.Submission.where((s) =>
    s.id.eq(submissionId),
  )
    .select("id", "problemId", "language", "code")
    .first();

  if (submission === null) {
    throw new JudgeError("Submission not found", 404);
  }

  const problem = await db.orm.public.Problem.where((p) =>
    p.id.eq(submission.problemId),
  )
    .select("id", "slug", "supportedLanguages")
    .first();

  if (problem === null) {
    throw new JudgeError("Problem for submission not found", 500);
  }

  if (!problem.supportedLanguages.includes(submission.language)) {
    throw new JudgeError(
      `Language "${submission.language}" is not supported by this problem`,
      400,
    );
  }

  const testCases = await db.orm.public.TestCase.where((t) =>
    t.problemId.eq(problem.id),
  )
    .select("id", "input", "expectedOutput", "createdAt")
    .orderBy((t) => t.createdAt.asc())
    .all();

  if (testCases.length === 0) {
    throw new JudgeError("No test cases found for problem", 400);
  }

  // Deterministic order: createdAt, then id as tiebreaker.
  const ordered = [...testCases].sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  return {
    submissionId: submission.id,
    problemId: problem.id,
    problemSlug: problem.slug,
    language: submission.language,
    code: submission.code,
    testCases: ordered.map((t) => ({
      id: t.id,
      input: t.input,
      expectedOutput: t.expectedOutput,
    })),
  };
}

// Trim leading/trailing whitespace, then compare the exact remaining content.
export function normalizeOutput(output: string | null): string {
  return (output ?? "").trim();
}

export function compareOutput(
  actual: string | null,
  expected: string,
): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

// Map a BlackBox final status to a judge failure status.
// Returns null for COMPLETED, where the caller compares stdout instead.
function mapBlackboxStatus(status: string): JudgeRunStatus | null {
  switch (status) {
    case "COMPLETED":
      return null;
    case "TIME_LIMIT_EXCEEDED":
      return "TIME_LIMIT_EXCEEDED";
    case "MEMORY_LIMIT_EXCEEDED":
      return "MEMORY_LIMIT_EXCEEDED";
    case "OUTPUT_LIMIT_EXCEEDED":
    case "FAILED":
    default:
      return "RUNTIME_ERROR";
  }
}

// Priority: TLE > MLE > runtime failure > wrong answer > accepted.
function aggregateStatus(results: JudgeTestResult[]): JudgeRunStatus {
  if (results.some((r) => r.status === "TIME_LIMIT_EXCEEDED")) {
    return "TIME_LIMIT_EXCEEDED";
  }
  if (results.some((r) => r.status === "MEMORY_LIMIT_EXCEEDED")) {
    return "MEMORY_LIMIT_EXCEEDED";
  }
  if (results.some((r) => r.status === "RUNTIME_ERROR")) {
    return "RUNTIME_ERROR";
  }
  if (results.some((r) => r.status === "WRONG_ANSWER")) {
    return "WRONG_ANSWER";
  }
  return "ACCEPTED";
}

// Judge one submission across ALL its test cases, sequentially.
// Synchronous by design: no queues, no workers, no parallelism.
// Returns the aggregated result WITHOUT persisting it and WITHOUT
// changing Submission.status.
export async function runJudge(
  submissionId: string,
): Promise<JudgeRunResult> {
  const plan = await prepareJudgePlan(submissionId);

  const testResults: JudgeTestResult[] = [];
  let passedTests = 0;
  let executionTimeMs = 0;

  for (const testCase of plan.testCases) {
    const { sourceCode } = generateHarnessSource({
      language: plan.language,
      code: plan.code,
      problemSlug: plan.problemSlug,
      testCaseInput: testCase.input,
    });

    const result = await executeWithBlackBox({
      language: plan.language,
      code: sourceCode,
      stdin: testCase.input,
    });

    executionTimeMs += result.executionTimeMs ?? 0;

    const failureStatus = mapBlackboxStatus(result.status);
    let status: JudgeRunStatus;
    let passed: boolean;
    if (failureStatus !== null) {
      status = failureStatus;
      passed = false;
    } else if (compareOutput(result.stdout, testCase.expectedOutput)) {
      status = "ACCEPTED";
      passed = true;
      passedTests += 1;
    } else {
      status = "WRONG_ANSWER";
      passed = false;
    }

    testResults.push({
      testCaseId: testCase.id,
      passed,
      status,
      executionTimeMs: result.executionTimeMs,
    });
  }

  return {
    submissionId: plan.submissionId,
    status: aggregateStatus(testResults),
    passedTests,
    totalTests: testResults.length,
    executionTimeMs,
    testResults,
  };
}
