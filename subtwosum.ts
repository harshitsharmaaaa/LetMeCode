import { getDb } from "./lib/prisma";
const db = getDb();
const p = await db.orm.public.Problem.where((r) => r.slug.eq("two-sum")).select("id").first();
const code = `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            c = target - x
            if c in seen:
                return [seen[c], i]
            seen[x] = i
        return []`;
const res = await fetch("http://localhost:3002/api/submissions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ problemId: p!.id, language: "python", code }),
});
const created = await res.json();
console.log("SUBMIT status:", res.status, JSON.stringify(created));
const id = created.id;
for (let i = 0; i < 30; i++) {
  const r = await fetch(`http://localhost:3002/api/submissions/${id}`);
  const s = await r.json();
  console.log("poll", i, s.status, s.passedTests + "/" + s.totalTests, s.failedTestNumber, s.executionTimeMs + "ms");
  if (["ACCEPTED","WRONG_ANSWER","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","RUNTIME_ERROR","COMPILE_ERROR","INTERNAL_ERROR"].includes(s.status)) break;
  await new Promise((x) => setTimeout(x, 2000));
}
await db.close();