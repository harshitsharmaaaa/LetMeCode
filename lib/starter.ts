// Per-problem, per-language starter code templates.
// Keyed by `${problemSlug}-${language}`. Falls back to a generic template
// when a specific one is not defined.
//
// The harness expects the user's code to define a `Solution` class with a
// specific method. The starter templates below match those expectations.

const STARTER_TEMPLATES: Record<string, Record<string, string>> = {
  "two-sum": {
    cpp: `#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};`,
    python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Write your solution here
        return []`,
    java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}`,
    javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    // Write your solution here
    return [];
};`,
  },
  "valid-parentheses": {
    cpp: `#include <string>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Write your solution here
        return false;
    }
};`,
    python: `class Solution:
    def isValid(self, s: str) -> bool:
        # Write your solution here
        return False`,
    java: `class Solution {
    public boolean isValid(String s) {
        // Write your solution here
        return false;
    }
}`,
    javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
var isValid = function(s) {
    // Write your solution here
    return false;
};`,
  },
  "binary-search": {
    cpp: `#include <vector>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Write your solution here
        return -1;
    }
};`,
    python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        # Write your solution here
        return -1`,
    java: `class Solution {
    public int search(int[] nums, int target) {
        // Write your solution here
        return -1;
    }
}`,
    javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var search = function(nums, target) {
    // Write your solution here
    return -1;
};`,
  },
};

export function getStarterCode(slug: string, language: string): string {
  const template = STARTER_TEMPLATES[slug]?.[language];
  if (template) return template;
  return `// Write your solution here`;
}