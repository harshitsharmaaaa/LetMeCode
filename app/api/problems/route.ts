import { getDb } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const problems = await db.orm.public.Problem.select(
    "id",
    "title",
    "slug",
    "difficulty",
  )
    .orderBy((p) => p.title.asc())
    .all();

  return Response.json(problems);
}
