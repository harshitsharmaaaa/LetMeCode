// Server-side harness generation for LeetCode-style submissions.
//
// Boundary (strict): this module ONLY converts
//   "user LeetCode code" + "one test case"
// into a standalone, BlackBox-executable program.
// It does NOT execute code, does NOT judge output, does NOT touch the
// database, and does NOT talk to BlackBox. User code is treated as an
// opaque string: it is placed into the generated program, never run here.
//
// Stdin contract: TestCase.input IS the stdin of the generated program.
// The plain-text formats below match the reseeded TestCase rows:
//
//   two-sum            n\n<space-separated nums>\ntarget      -> "0 1"
//   valid-parentheses  s (single line, e.g. "()[]{}")      -> "true"/"false"
//   binary-search      n\n<space-separated nums>\ntarget      -> "4"
//
// Output contract: print ONLY the answer, no labels or extra whitespace.
//   int                      -> decimal, e.g. "-1"
//   bool               -> "true" / "false"
//   int[] / vector<int> -> space-separated on one line, e.g. "0 1"
//
// No generic parsing: only the three seeded problems are supported, keyed
// by problem slug. Unknown slugs or languages throw HarnessError.

export class HarnessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// The LeetCode method each seeded problem expects on class Solution.
const FUNCTION_NAMES: Record<string, string> = {
  "two-sum": "twoSum",
  "valid-parentheses": "isValid",
  "binary-search": "search",
};

const SUPPORTED_LANGUAGES = ["cpp", "python", "java", "javascript"] as const;

export type HarnessLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function functionNameFor(problemSlug: string): string {
  const name = FUNCTION_NAMES[problemSlug];
  if (!name) {
    throw new HarnessError(`No harness defined for problem "${problemSlug}"`, 500);
  }
  return name;
}

function assertLanguage(language: string): asserts language is HarnessLanguage {
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    throw new HarnessError(`Unsupported language for harness: "${language}"`, 400);
  }
}

// Java compiles the generated source as Main.java, which allows exactly one
// public top-level class. Demote the user's Solution so Main stays the only
// public class. Plain string replacement is enough for LeetCode submissions.
function toNonPublicSolution(code: string): string {
  return code.replace(/public\s+class\s+Solution/g, "class Solution");
}

// ---------------------------------------------------------------------------
// C++
// ---------------------------------------------------------------------------

function cppMainFor(problemSlug: string, functionName: string): string {
  switch (problemSlug) {
    case "two-sum":
      return [
        "int main() {",
        "    ios::sync_with_stdio(false);",
        "    cin.tie(nullptr);",
        "    int n;",
        "    if (!(cin >> n)) return 0;",
        "    vector<int> nums(n);",
        "    for (int i = 0; i < n; i++) cin >> nums[i];",
        "    int target;",
        "    cin >> target;",
        "    Solution sol;",
        `    vector<int> ans = sol.${functionName}(nums, target);`,
        "    for (size_t i = 0; i < ans.size(); i++) {",
        "        if (i) cout << ' ';",
        "        cout << ans[i];",
        "    }",
        "    return 0;",
        "}",
      ].join("\n");
    case "valid-parentheses":
      return [
        "int main() {",
        "    ios::sync_with_stdio(false);",
        "    cin.tie(nullptr);",
        "    string s;",
        "    if (!getline(cin, s)) return 0;",
        "    if (!s.empty() && s.back() == '\\r') s.pop_back();",
        "    Solution sol;",
        `    bool ans = sol.${functionName}(s);`,
        '    cout << (ans ? "true" : "false");',
        "    return 0;",
        "}",
      ].join("\n");
    case "binary-search":
      return [
        "int main() {",
        "    ios::sync_with_stdio(false);",
        "    cin.tie(nullptr);",
        "    int n;",
        "    if (!(cin >> n)) return 0;",
        "    vector<int> nums(n);",
        "    for (int i = 0; i < n; i++) cin >> nums[i];",
        "    int target;",
        "    cin >> target;",
        "    Solution sol;",
        `    int ans = sol.${functionName}(nums, target);`,
        "    cout << ans;",
        "    return 0;",
        "}",
      ].join("\n");
    default:
      throw new HarnessError(`No harness defined for problem "${problemSlug}"`, 500);
  }
}

function generateCpp(code: string, problemSlug: string): string {
  const functionName = functionNameFor(problemSlug);
  return ["#include <bits/stdc++.h>", "using namespace std;", "", code, "", cppMainFor(problemSlug, functionName), ""].join(
    "\n",
  );
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function pythonMainFor(problemSlug: string, functionName: string): string {
  switch (problemSlug) {
    case "two-sum":
      return [
        "def main():",
        "    data = sys.stdin.read().strip().split()",
        "    if not data:",
        "        return",
        "    n = int(data[0])",
        "    nums = list(map(int, data[1:1 + n]))",
        "    target = int(data[1 + n])",
        `    ans = Solution().${functionName}(nums, target)`,
        "    print(' '.join(map(str, ans)))",
        "",
        "",
        "if __name__ == '__main__':",
        "    main()",
      ].join("\n");
    case "valid-parentheses":
      return [
        "def main():",
        "    lines = sys.stdin.read().splitlines()",
        "    s = lines[0].strip() if lines else ''",
        `    ans = Solution().${functionName}(s)`,
        "    print('true' if ans else 'false')",
        "",
        "",
        "if __name__ == '__main__':",
        "    main()",
      ].join("\n");
    case "binary-search":
      return [
        "def main():",
        "    data = sys.stdin.read().strip().split()",
        "    if not data:",
        "        return",
        "    n = int(data[0])",
        "    nums = list(map(int, data[1:1 + n]))",
        "    target = int(data[1 + n])",
        `    ans = Solution().${functionName}(nums, target)`,
        "    print(ans)",
        "",
        "",
        "if __name__ == '__main__':",
        "    main()",
      ].join("\n");
    default:
      throw new HarnessError(`No harness defined for problem "${problemSlug}"`, 500);
  }
}

function generatePython(code: string, problemSlug: string): string {
  const functionName = functionNameFor(problemSlug);
  return ["import sys", "", code, "", pythonMainFor(problemSlug, functionName), ""].join("\n");
}

// ---------------------------------------------------------------------------
// Java (compiles as Main.java)
// ---------------------------------------------------------------------------

function javaMainFor(problemSlug: string, functionName: string): string {
  switch (problemSlug) {
    case "two-sum":
      return [
        "public class Main {",
        "    public static void main(String[] args) {",
        "        Scanner sc = new Scanner(System.in);",
        "        int n = sc.nextInt();",
        "        int[] nums = new int[n];",
        "        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();",
        "        int target = sc.nextInt();",
        "        Solution sol = new Solution();",
        `        int[] ans = sol.${functionName}(nums, target);`,
        "        StringBuilder sb = new StringBuilder();",
        "        for (int i = 0; i < ans.length; i++) {",
        "            if (i > 0) sb.append(' ');",
        "            sb.append(ans[i]);",
        "        }",
        "        System.out.print(sb.toString());",
        "        sc.close();",
        "    }",
        "}",
      ].join("\n");
    case "valid-parentheses":
      return [
        "public class Main {",
        "    public static void main(String[] args) {",
        "        Scanner sc = new Scanner(System.in);",
        "        String s = sc.hasNextLine() ? sc.nextLine().trim() : \"\";",
        "        Solution sol = new Solution();",
        `        boolean ans = sol.${functionName}(s);`,
        '        System.out.print(ans ? "true" : "false");',
        "        sc.close();",
        "    }",
        "}",
      ].join("\n");
    case "binary-search":
      return [
        "public class Main {",
        "    public static void main(String[] args) {",
        "        Scanner sc = new Scanner(System.in);",
        "        int n = sc.nextInt();",
        "        int[] nums = new int[n];",
        "        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();",
        "        int target = sc.nextInt();",
        "        Solution sol = new Solution();",
        `        int ans = sol.${functionName}(nums, target);`,
        "        System.out.print(ans);",
        "        sc.close();",
        "    }",
        "}",
      ].join("\n");
    default:
      throw new HarnessError(`No harness defined for problem "${problemSlug}"`, 500);
  }
}

function generateJava(code: string, problemSlug: string): string {
  const functionName = functionNameFor(problemSlug);
  return ["import java.util.*;", "", toNonPublicSolution(code), "", javaMainFor(problemSlug, functionName), ""].join(
    "\n",
  );
}

// ---------------------------------------------------------------------------
// JavaScript (Node.js)
// ---------------------------------------------------------------------------

function javascriptMainFor(problemSlug: string, functionName: string): string {
  switch (problemSlug) {
    case "two-sum":
      return [
        "function main() {",
        "    const data = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);",
        "    if (data.length === 0 || data[0] === '') return;",
        "    const n = Number(data[0]);",
        "    const nums = data.slice(1, 1 + n).map(Number);",
        "    const target = Number(data[1 + n]);",
        `    const ans = new Solution().${functionName}(nums, target);`,
        "    console.log(ans.join(' '));",
        "}",
        "main();",
      ].join("\n");
    case "valid-parentheses":
      return [
        "function main() {",
        "    const raw = fs.readFileSync(0, 'utf8').split('\\n');",
        "    const s = (raw[0] ?? '').trim();",
        `    const ans = new Solution().${functionName}(s);`,
        "    console.log(ans ? 'true' : 'false');",
        "}",
        "main();",
      ].join("\n");
    case "binary-search":
      return [
        "function main() {",
        "    const data = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);",
        "    if (data.length === 0 || data[0] === '') return;",
        "    const n = Number(data[0]);",
        "    const nums = data.slice(1, 1 + n).map(Number);",
        "    const target = Number(data[1 + n]);",
        `    const ans = new Solution().${functionName}(nums, target);`,
        "    console.log(ans);",
        "}",
        "main();",
      ].join("\n");
    default:
      throw new HarnessError(`No harness defined for problem "${problemSlug}"`, 500);
  }
}

function generateJavaScript(code: string, problemSlug: string): string {
  const functionName = functionNameFor(problemSlug);
  return ["const fs = require('fs');", "", code, "", javascriptMainFor(problemSlug, functionName), ""].join("\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function generateHarnessSource(input: {
  language: string;
  code: string;
  problemSlug: string;
  testCaseInput: string;
}): { sourceCode: string } {
  const { language, code, problemSlug, testCaseInput } = input;

  assertLanguage(language);

  if (typeof code !== "string" || code.trim() === "") {
    throw new HarnessError("code is required and must not be empty", 400);
  }
  if (typeof problemSlug !== "string" || problemSlug.trim() === "") {
    throw new HarnessError("problemSlug is required", 400);
  }
  // The generated program parses TestCase.input from stdin at runtime inside
  // BlackBox, so generation does not depend on the input value itself. It is
  // still required here to keep the boundary explicit: user code + one test
  // case -> runnable program.
  if (typeof testCaseInput !== "string") {
    throw new HarnessError("testCaseInput must be a string", 400);
  }
  functionNameFor(problemSlug);

  switch (language) {
    case "cpp":
      return { sourceCode: generateCpp(code, problemSlug) };
    case "python":
      return { sourceCode: generatePython(code, problemSlug) };
    case "java":
      return { sourceCode: generateJava(code, problemSlug) };
    case "javascript":
      return { sourceCode: generateJavaScript(code, problemSlug) };
  }
}
