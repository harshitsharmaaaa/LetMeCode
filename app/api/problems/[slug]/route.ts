import { getDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const db = getDb();
  const problem = await db.orm.public.Problem.where((p) =>
    p.slug.eq(slug),
  )
    .select(
      "id",
      "title",
      "slug",
      "description",
      "difficulty",
      "constraints",
      "examples",
      "supportedLanguages",
    )
    .include("testCases", (t) =>
      t
        .where((tc) => tc.isHidden.eq(false))
        .select("id", "input", "expectedOutput"),
    )
    .first();

  if (problem === null) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  return Response.json(problem);
}
