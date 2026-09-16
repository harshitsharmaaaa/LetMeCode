import { getDb } from "@/lib/prisma";
import { pingRedis } from "@/lib/queue";

export const dynamic = "force-dynamic";

// Readiness: PostgreSQL + Redis must both answer.
export async function GET() {
  try {
    const db = getDb();
    await db.orm.public.Problem.select("id").first();
  } catch {
    return Response.json(
      { status: "not ready", postgres: false, redis: true },
      { status: 503 },
    );
  }

  try {
    await pingRedis();
  } catch {
    return Response.json(
      { status: "not ready", postgres: true, redis: false },
      { status: 503 },
    );
  }

  return Response.json({ status: "ready", postgres: true, redis: true });
}
