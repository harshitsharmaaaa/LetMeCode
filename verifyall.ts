import { getDb } from "./lib/prisma";
const db = getDb();
const p = await db.orm.public.Problem.where((r) => r.slug.eq("two-sum")).select("id").first();

async function submit(code: string, language: string, label: string) {
  const res = await fetch("http://localhost:3002/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemId: p!.id, language, code }),
  });
  const created = await res.json();
  console.log(`[${label}] created ${created.status}`);
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`http://localhost:3002/api/submissions/${created.id}`);
    const s = await r.json();
    if (["ACCEPTED","WRONG_ANSWER","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","RUNTIME_ERROR","COMPILE_ERROR","INTERNAL_ERROR"].includes(s.status)) {
      console.log(`[${label}] FINAL ${s.status} ${s.passedTests}/${s.totalTests} ${s.executionTimeMs}ms`);
      return s;
    }
    await new Promise((x) => setTimeout(x, 2000));
  }
  console.log(`[${label}] TIMEOUT`);
}

// Wrong answer (Python)
await submit(`class Solution:
    def twoSum(self, nums, target):
        return [0, 0]`, "python", "WRONG-PY");

// JavaScript (correct, both styles)
await submit(`var twoSum = function(nums, target) {
    const m = {};
    for (let i = 0; i < nums.length; i++) {
        const c = target - nums[i];
        if (m[c] !== undefined) return [m[c], i];
        m[nums[i]] = i;
    }
    return [];
};`, "javascript", "JS-var");

// C++ (correct)
await submit(`#include <vector>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        vector<int> ans;
        for (int i = 0; i < (int)nums.size(); i++) {
            for (int j = i + 1; j < (int)nums.size(); j++) {
                if (nums[i] + nums[j] == target) { ans.push_back(i); ans.push_back(j); return ans; }
            }
        }
        return ans;
    }
};`, "cpp", "CPP");

// Java (correct)
await submit(`class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) {
                    return new int[]{i, j};
                }
            }
        }
        return new int[]{};
    }
}`, "java", "JAVA");

// History
const hist = await fetch("http://localhost:3002/api/submissions?problemId=" + p!.id).then((r) => r.json());
console.log("HISTORY count:", hist.length);
for (const s of hist.slice(0, 6)) console.log("  ", s.language, s.status, s.passedTests + "/" + s.totalTests, s.executionTimeMs + "ms");
await db.close();