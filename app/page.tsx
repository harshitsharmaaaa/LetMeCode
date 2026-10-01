"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProblemSummary = {
  id: string;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

const difficultyColor: Record<string, string> = {
  EASY: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HARD: "bg-red-100 text-red-800",
};

export default function Home() {
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/problems")
      .then((res) => res.json())
      .then((data) => setProblems(data))
      .catch(() => {});
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">LeetCode</h1>
        <p className="text-gray-600 text-lg">
          A coding platform powered by BlackBox
        </p>
      </div>

      <div className="flex gap-4 justify-center mb-8">
        <Link
          href="/problems"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Browse Problems
        </Link>
        <Link
          href="/submissions"
          className="border border-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
        >
          My Submissions
        </Link>
      </div>

      {problems !== null && problems.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Popular Problems</h2>
          <div className="grid gap-3">
            {problems.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/problems/${p.slug}`}
                className="flex items-center justify-between border rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <span className="font-medium">{p.title}</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${difficultyColor[p.difficulty]}`}
                >
                  {p.difficulty}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
