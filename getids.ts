import { getDb } from "./lib/prisma";
const db = getDb();
const p = await db.orm.public.Problem.where((r) => r.slug.eq("two-sum")).select("id").first();
const tc = await db.orm.public.TestCase.where((r) => r.problemId.eq(p!.id) && r.isHidden.eq(false)).select("id").first();
console.log("PROBLEM_ID=" + p!.id);
console.log("TESTCASE_ID=" + tc!.id);
await db.close();