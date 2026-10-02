import { getDb } from "./lib/prisma";

const BASE = "http://localhost:3002";
const db = getDb();
const p = await db.orm.public.Problem.where((r) => r.slug.eq("two-sum")).select("id").first();
const tcs = await db.orm.public.TestCase.where((r) => r.problemId.eq(p!.id))
  .select("id", "isHidden", "createdAt")
  .orderBy((r) => r.createdAt.asc())
  .all();
const public1 = tcs.find((t) => !t.isHidden)!;
const hidden1 = tcs.find((t) => t.isHidden)!;

const solutions: Record<string, string> = {
  python: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, x in enumerate(nums):
            c = target - x
            if c in seen:
                return [seen[c], i]
            seen[x] = i
        return []`,
  javascript: `var twoSum = function(nums, target) {
    const m = {};
    for (let i = 0; i < nums.length; i++) {
        const c = target - nums[i];
        if (m[c] !== undefined) return [m[c], i];
        m[nums[i]] = i;
    }
    return [];
};`,
  cpp: `#include <vector>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < (int)nums.size(); i++) {
            for (int j = i + 1; j < (int)nums.size(); j++) {
                if (nums[i] + nums[j] == target) return {i, j};
            }
        }
        return {};
    }
};`,
  java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) return new int[]{i, j};
            }
        }
        return new int[]{};
    }
}`,
};

async function runCode(language: string, code: string, tcId: string, label: string) {
  const res = await fetch(`${BASE}/api/runtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId: p!.id, language, code, testCaseId: tcId }),
  });
  const d = await res.json();
  console.log(`[RUN ${label}] http=${res.status} status=${d.status ?? d.error} passed=${d.passed} stdout=${JSON.stringify(d.stdout)} time=${d.executionTimeMs}ms`);
  return d;
}

// 1) Run Code: all four languages on public case 1
for (const lang of ["python", "javascript", "cpp", "java"]) {
  await runCode(lang, solutions[lang], public1.id, lang);
}

// 2) Run Code: python on public case 2 (expect "1 2")
const public2 = tcs.filter((t) => !t.isHidden)[1];
await runCode("python", solutions.python, public2.id, "py-case2");

// 3) Security: hidden test must be rejected
const hid = await fetch(`${BASE}/api/runtime`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ problemId: p!.id, language: "python", code: solutions.python, testCaseId: hidden1.id }),
});
console.log(`[SEC hidden-reject] http=${hid.status} body=${JSON.stringify(await hid.json())}`);

// 4) Run Code must NOT create submissions
const before = await fetch(`${BASE}/api/submissions?problemId=${p!.id}`).then((r) => r.json());
console.log(`[CHECK] submissions before run-only phase: ${before.length}`);

// 5) Wrong-code run
await runCode("python", "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 0]", public1.id, "wrong-code");

const after = await fetch(`${BASE}/api/submissions?problemId=${p!.id}`).then((r) => r.json());
console.log(`[CHECK] submissions after run-only phase: ${after.length} (must be equal)`);
await db.close();