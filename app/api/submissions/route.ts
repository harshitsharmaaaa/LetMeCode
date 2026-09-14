import { getDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SUPPORTED_LANGUAGES = ["cpp", "python", "java", "javascript"] as const;

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

  return Response.json(
    { id: submission.id, status: submission.status },
    { status: 201 },
  );
}
