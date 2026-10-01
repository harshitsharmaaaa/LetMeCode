import { getDb } from "@/lib/prisma";
import { enqueueSubmission } from "@/lib/queue";

export const dynamic = "force-dynamic";

const SUPPORTED_LANGUAGES = ["cpp", "python", "java", "javascript"] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const problemId = searchParams.get("problemId");

  if (!problemId) {
    return Response.json(
      { error: "problemId query parameter is required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const submissions = await db.orm.public.Submission.where((s) =>
    s.problemId.eq(problemId),
  )
    .select(
      "id",
      "problemId",
      "language",
      "status",
      "passedTests",
      "totalTests",
      "executionTimeMs",
      "failedTestNumber",
      "createdAt",
      "updatedAt",
    )
    .orderBy((s) => s.createdAt.desc())
    .all();

  return Response.json(submissions);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { problemId, language, code } = body as {
    problemId?: unknown;
    language?: unknown;
    code?: unknown;
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
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }

  if (typeof code !== "string" || code.trim() === "") {
    return Response.json(
      { error: "code is required and must not be empty" },
      { status: 400 },
    );
  }

  const db = getDb();

  const problem = await db.orm.public.Problem.where((p) =>
    p.id.eq(problemId),
  )
    .select("id")
    .first();

  if (problem === null) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  const submission = await db.orm.public.Submission.create({
    problemId,
    language,
    code,
    status: "QUEUED",
  });

  try {
    await enqueueSubmission(submission.id);
  } catch {
    try {
      await db.orm.public.Submission.where((s) =>
        s.id.eq(submission.id),
      ).delete();
    } catch (deleteErr) {
      console.error(
        `Failed to delete orphaned submission ${submission.id}:`,
        deleteErr,
      );
      return Response.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    return Response.json({ error: "Queue unavailable" }, { status: 503 });
  }

  return Response.json(
    { id: submission.id, status: submission.status },
    { status: 201 },
  );
}
