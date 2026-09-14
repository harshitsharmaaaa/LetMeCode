import { getDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const db = getDb();
  const submission = await db.orm.public.Submission.where((s) =>
    s.id.eq(id),
  )
    .select("id", "problemId", "language", "status", "createdAt", "updatedAt")
    .first();

  if (submission === null) {
    return Response.json({ error: "Submission not found" }, { status: 404 });
  }

  return Response.json(submission);
}
