import { getDb } from "@/lib/prisma";
import { executeWithBlackBox } from "@/lib/blackbox";
import { generateHarnessSource, HarnessError } from "@/lib/judge/harness";
import { compareOutput, JudgeError } from "@/lib/judge/judge";
import {
  MAX_CODE_BYTES,
  clientKey,
  isRateLimited,
} from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const SUPPORTED_LANGUAGES = ["cpp", "python", "java", "javascript"] as const;

export async function POST(request: Request) {
  // Run Code is synchronous BlackBox execution: guard a little tighter.
  if (isRateLimited(`run:${clientKey(request)}`, 30, 60_000)) {
    return Response.json(
      { error: "Too many runs. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { problemId, language, code, testCaseId } = body as {
    problemId?: unknown;
    language?: unknown;
    code?: unknown;
    testCaseId?: unknown;
  };

  if (typeof problemId !== "string" || problemId.trim() === "") {
    return Response.json({ error: "problemId is required" }, { status: 400 });
  }

  if (typeof language !== "string" || language.trim() === "") {
    return Response.json({ error: "language is required" }, { status: 400 });
  }

  if (
    !SUPPORTED_LANGUAGES.includes(
      language as (typeof SUPPORTED_LANGUAGES)[number],
    )
  ) {
    return Response.json(
      { error: `Unsupported language "${language}"` },
      { status: 400 },
    );
  }

  if (typeof code !== "string" || code.trim() === "") {
    return Response.json(
      { error: "code is required and must not be empty" },
      { status: 400 },
    );
  }

  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return Response.json(
      { error: "code is too large (max 64 KB)" },
      { status: 400 },
    );
  }

  if (typeof testCaseId !== "string" || testCaseId.trim() === "") {
    return Response.json({ error: "testCaseId is required" }, { status: 400 });
  }

  const db = getDb();

  const problem = await db.orm.public.Problem.where((p) =>
    p.id.eq(problemId),
  )
    .select("id", "slug", "supportedLanguages")
    .first();

  if (problem === null) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  if (!problem.supportedLanguages.includes(language)) {
    return Response.json(
      { error: `Language "${language}" is not supported by this problem` },
      { status: 400 },
    );
  }

  const testCase = await db.orm.public.TestCase.where((t) =>
    t.id.eq(testCaseId),
  )
    .select("id", "input", "expectedOutput", "isHidden", "problemId")
    .first();

  if (testCase === null) {
    return Response.json({ error: "Test case not found" }, { status: 404 });
  }

  if (testCase.problemId !== problem.id) {
    return Response.json(
      { error: "Test case does not belong to this problem" },
      { status: 400 },
    );
  }

  if (testCase.isHidden) {
    return Response.json(
      { error: "Cannot run hidden test cases" },
      { status: 403 },
    );
  }

  try {
    const { sourceCode } = generateHarnessSource({
      language,
      code,
      problemSlug: problem.slug,
      testCaseInput: testCase.input,
    });

    const result = await executeWithBlackBox({
      language,
      code: sourceCode,
      stdin: testCase.input,
    });

    const passed =
      result.status === "COMPLETED" &&
      compareOutput(result.stdout, testCase.expectedOutput);

    return Response.json({
      testCaseId: testCase.id,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTimeMs: result.executionTimeMs,
      expectedOutput: testCase.expectedOutput,
      passed,
    });
  } catch (err) {
    if (err instanceof JudgeError || err instanceof HarnessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error) {
      return Response.json(
        { error: "Execution failed. Please try again." },
        { status: 502 },
      );
    }
    throw err;
  }
}