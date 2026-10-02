import { getDb } from "./lib/prisma";
const db = getDb();
const p = await db.orm.public.Problem.where((r) => r.slug.eq("two-sum")).select("id").first();
const tc = await db.orm.public.TestCase.where((r) => r.problemId.eq(p!.id) && r.isHidden.eq(false)).select("id").first();
const code = `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            c = target - x
            if c in seen:
                return [seen[c], i]
            seen[x] = i
        return []`;
const res = await fetch("http://localhost:3002/api/runtime", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ problemId: p!.id, language: "python", code, testCaseId: tc!.id }),
});
const data = await res.json();
console.log("RUN status:", res.status);
console.log("RUN result:", JSON.stringify(data));
await db.close();