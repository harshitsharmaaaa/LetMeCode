import { getDb } from "../lib/prisma";

const db = getDb();

type SeedTestCase = {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
};

type SeedProblem = {
  title: string;
  slug: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  constraints: string;
  examples: { input: string; output: string; explanation: string }[];
  supportedLanguages: string[];
  testCases: SeedTestCase[];
};

const problems: SeedProblem[] = [
  {
    title: "Two Sum",
    slug: "two-sum",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.",
    difficulty: "EASY",
    constraints:
      "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2].",
      },
    ],
    supportedLanguages: ["python", "javascript", "typescript"],
    testCases: [
      {
        input: "nums = [2,7,11,15], target = 9",
        expectedOutput: "[0,1]",
        isHidden: false,
      },
      {
        input: "nums = [3,2,4], target = 6",
        expectedOutput: "[1,2]",
        isHidden: false,
      },
      {
        input: "nums = [3,3], target = 6",
        expectedOutput: "[0,1]",
        isHidden: true,
      },
      {
        input: "nums = [-1,-2,-3,-4,-5], target = -8",
        expectedOutput: "[2,4]",
        isHidden: true,
      },
    ],
  },
  {
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if: open brackets must be closed by the same type of brackets, open brackets must be closed in the correct order, and every close bracket has a corresponding open bracket of the same type.",
    difficulty: "EASY",
    constraints:
      "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
    examples: [
      {
        input: 's = "()"',
        output: "true",
        explanation: "The open bracket is closed in the correct order.",
      },
      {
        input: 's = "()[]{}"',
        output: "true",
        explanation: "Each open bracket is closed by the same type in order.",
      },
      {
        input: 's = "(]"',
        output: "false",
        explanation: "The brackets are not closed by the same type.",
      },
    ],
    supportedLanguages: ["python", "javascript", "typescript"],
    testCases: [
      {
        input: 's = "()"',
        expectedOutput: "true",
        isHidden: false,
      },
      {
        input: 's = "()[]{}"',
        expectedOutput: "true",
        isHidden: false,
      },
      {
        input: 's = "(]"',
        expectedOutput: "false",
        isHidden: true,
      },
      {
        input: 's = "([)]"',
        expectedOutput: "false",
        isHidden: true,
      },
    ],
  },
  {
    title: "Binary Search",
    slug: "binary-search",
    description:
      "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.",
    difficulty: "EASY",
    constraints:
      "1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll the integers in nums are unique.\nnums is sorted in ascending order.",
    examples: [
      {
        input: "nums = [-1,0,3,5,9,12], target = 9",
        output: "4",
        explanation: "9 exists in nums and its index is 4.",
      },
      {
        input: "nums = [-1,0,3,5,9,12], target = 2",
        output: "-1",
        explanation: "2 does not exist in nums so return -1.",
      },
    ],
    supportedLanguages: ["python", "javascript", "typescript"],
    testCases: [
      {
        input: "nums = [-1,0,3,5,9,12], target = 9",
        expectedOutput: "4",
        isHidden: false,
      },
      {
        input: "nums = [-1,0,3,5,9,12], target = 2",
        expectedOutput: "-1",
        isHidden: false,
      },
      {
        input: "nums = [5], target = 5",
        expectedOutput: "0",
        isHidden: true,
      },
      {
        input: "nums = [1,2,3,4,5,6,7,8,9,10], target = 1",
        expectedOutput: "0",
        isHidden: true,
      },
    ],
  },
];

for (const p of problems) {
  const existing = await db.orm.public.Problem.where((row) =>
    row.slug.eq(p.slug),
  )
    .select("id")
    .first();

  if (existing !== null) {
    await db.orm.public.TestCase.where((row) =>
      row.problemId.eq(existing.id),
    ).delete();
    await db.orm.public.Problem.where((row) => row.slug.eq(p.slug)).delete();
  }

  const created = await db.orm.public.Problem.create({
    title: p.title,
    slug: p.slug,
    description: p.description,
    difficulty: p.difficulty,
    constraints: p.constraints,
    examples: p.examples,
    supportedLanguages: p.supportedLanguages,
  });

  for (const t of p.testCases) {
    await db.orm.public.TestCase.create({
      problemId: created.id,
      input: t.input,
      expectedOutput: t.expectedOutput,
      isHidden: t.isHidden,
    });
  }

  console.log(`Seeded ${p.slug}`);
}

console.log("Done.");
await db.close();
