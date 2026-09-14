import { getDb } from "@/lib/prisma";

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
    .select("id", "supportedLanguages")
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
    language: submission.language,
    code: submission.code,
    testCases: ordered.map((t) => ({
      id: t.id,
      input: t.input,
      expectedOutput: t.expectedOutput,
    })),
  };
}
