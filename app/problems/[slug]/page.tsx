"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type TestCase = {
  id: string;
  input: string;
  expectedOutput: string;
};

type ProblemDetail = {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  constraints: string;
  examples: { input: string; output: string; explanation: string }[];
  supportedLanguages: string[];
  testCases: TestCase[];
};

type SubmissionResult = {
  id: string;
  problemId: string;
  language: string;
  status: string;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  failedTestNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

const LANGUAGES = ["cpp", "python", "java", "javascript"] as const;

const DEFAULT_CODE: Record<string, string> = {
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
};

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-700",
  RUNNING: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-800",
  WRONG_ANSWER: "bg-red-100 text-red-800",
  TIME_LIMIT_EXCEEDED: "bg-orange-100 text-orange-800",
  MEMORY_LIMIT_EXCEEDED: "bg-purple-100 text-purple-800",
  RUNTIME_ERROR: "bg-red-100 text-red-800",
  COMPILE_ERROR: "bg-yellow-100 text-yellow-800",
  INTERNAL_ERROR: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  ACCEPTED: "Accepted",
  WRONG_ANSWER: "Wrong Answer",
  TIME_LIMIT_EXCEEDED: "Time Limit Exceeded",
  MEMORY_LIMIT_EXCEEDED: "Memory Limit Exceeded",
  RUNTIME_ERROR: "Runtime Error",
  COMPILE_ERROR: "Compile Error",
  INTERNAL_ERROR: "Internal Error",
};

const FINAL_STATUSES = new Set([
  "ACCEPTED",
  "WRONG_ANSWER",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "RUNTIME_ERROR",
  "COMPILE_ERROR",
  "INTERNAL_ERROR",
]);

const difficultyColor: Record<string, string> = {
  EASY: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HARD: "bg-red-100 text-red-800",
};

export default function ProblemDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("cpp");
  const [code, setCode] = useState<string>(DEFAULT_CODE["cpp"]);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    fetch(`/api/problems/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load problem");
        return res.json();
      })
      .then((data: ProblemDetail) => {
        setProblem(data);
        if (data.supportedLanguages.includes(language)) {
          setCode(DEFAULT_CODE[language] || "");
        }
      })
      .catch(() => setError("Could not load problem."));
  }, [slug, language]);

  const pollSubmission = useCallback(
    async (submissionId: string) => {
      setPolling(true);
      const poll = async () => {
        try {
          const res = await fetch(`/api/submissions/${submissionId}`);
          if (!res.ok) return;
          const data: SubmissionResult = await res.json();
          setSubmission(data);
          if (FINAL_STATUSES.has(data.status)) {
            setPolling(false);
            return;
          }
          setTimeout(poll, 2000);
        } catch {
          setPolling(false);
        }
      };
      poll();
    },
    [],
  );

  const handleSubmit = async () => {
    if (!problem || submitting) return;
    setSubmitting(true);
    setSubmission(null);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          language,
          code,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }

      const data = await res.json();
      setSubmission(data);
      pollSubmission(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setCode(DEFAULT_CODE[newLang] || "");
  };

  if (error !== null && problem === null) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </main>
    );
  }

  if (problem === null) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-gray-500">Loading problem...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{problem.title}</h1>
            <span
              className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${difficultyColor[problem.difficulty]}`}
            >
              {problem.difficulty}
            </span>
          </div>

          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap">{problem.description}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Examples</h2>
            <div className="space-y-3">
              {problem.examples.map((ex, i) => (
                <div key={i} className="bg-gray-50 border rounded p-3">
                  <p>
                    <strong>Input:</strong> {ex.input}
                  </p>
                  <p>
                    <strong>Output:</strong> {ex.output}
                  </p>
                  {ex.explanation && (
                    <p className="text-gray-600">
                      <strong>Explanation:</strong> {ex.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Constraints</h2>
            <pre className="bg-gray-50 border rounded p-3 text-sm whitespace-pre-wrap">
              {problem.constraints}
            </pre>
          </div>

          {problem.testCases.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Test Cases</h2>
              <div className="space-y-2">
                {problem.testCases.map((tc, i) => (
                  <div key={tc.id} className="bg-gray-50 border rounded p-3">
                    <p>
                      <strong>Input:</strong>
                    </p>
                    <pre className="text-sm mt-1">{tc.input}</pre>
                    <p className="mt-2">
                      <strong>Expected Output:</strong>
                    </p>
                    <pre className="text-sm mt-1">{tc.expectedOutput}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Language:</label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-80 border rounded p-3 font-mono text-sm resize-y"
              spellCheck={false}
              placeholder="Write your solution here..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || polling}
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : polling ? "Judging..." : "Submit"}
            </button>
            {(submitting || polling) && (
              <span className="text-sm text-gray-500">Processing...</span>
            )}
          </div>

          {error !== null && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {submission !== null && (
            <div className="border rounded p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Result</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[submission.status] || "bg-gray-100 text-gray-700"}`}
                >
                  {STATUS_LABELS[submission.status] || submission.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Tests Passed:</span>{" "}
                  <span className="font-medium">
                    {submission.passedTests}/{submission.totalTests}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Runtime:</span>{" "}
                  <span className="font-medium">
                    {submission.executionTimeMs}ms
                  </span>
                </div>
                {submission.failedTestNumber !== null && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Failed Test:</span>{" "}
                    <span className="font-medium">
                      #{submission.failedTestNumber}
                    </span>
                  </div>
                )}
              </div>

              {polling && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Waiting for result...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
