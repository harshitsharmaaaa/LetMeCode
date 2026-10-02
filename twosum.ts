import { getDb } from "./lib/prisma";
const db = getDb();
const p = await db.orm.public.Problem.where((r) => r.slug.eq("two-sum"))
  .select("id", "title", "slug", "difficulty", "supportedLanguages")
  .first();
console.log("PROBLEM:", JSON.stringify(p));
const tcs = await db.orm.public.TestCase.where((r) => r.problemId.eq(p!.id))
  .select("id", "input", "expectedOutput", "isHidden", "createdAt")
  .orderBy((r) => r.createdAt.asc())
  .all();
console.log("TESTCASES:");
for (const t of tcs) console.log("  hidden=" + t.isHidden, JSON.stringify(t.input), "->", JSON.stringify(t.expectedOutput), t.id);
await db.close();