import { generateHarnessSource } from "./lib/judge/harness";

const cppCode = `#include <vector>
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
};`;

const javaCode = `class Solution {
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
}`;

async function exec(language: string, code: string, stdin: string, label: string) {
  const created = await fetch("http://localhost:3001/api/v1/executions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, code, stdin }),
  }).then((r) => r.json());
  console.log(`[${label}] created ${created.id} ${created.status}`);
  for (let i = 0; i < 40; i++) {
    const e = await fetch(`http://localhost:3001/api/v1/executions/${created.id}`).then((r) => r.json());
    if (["COMPLETED","FAILED","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","OUTPUT_LIMIT_EXCEEDED"].includes(e.status)) {
      console.log(`[${label}] FINAL=${e.status} exit=${e.exitCode} time=${e.executionTimeMs}ms`);
      console.log(`  stdout=${JSON.stringify(e.stdout)}`);
      console.log(`  stderr=${JSON.stringify((e.stderr ?? "").slice(0, 600))}`);
      return;
    }
    await new Promise((x) => setTimeout(x, 500));
  }
  console.log(`[${label}] TIMEOUT`);
}

const cppSrc = generateHarnessSource({ language: "cpp", code: cppCode, problemSlug: "two-sum", testCaseInput: "4\n2 7 11 15\n9" }).sourceCode;
const javaSrc = generateHarnessSource({ language: "java", code: javaCode, problemSlug: "two-sum", testCaseInput: "4\n2 7 11 15\n9" }).sourceCode;

await exec("cpp", cppSrc, "4\n2 7 11 15\n9", "CPP");
await exec("java", javaSrc, "4\n2 7 11 15\n9", "JAVA");