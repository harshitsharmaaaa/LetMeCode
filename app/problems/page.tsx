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

export default function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/problems")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load problems");
        return res.json();
      })
      .then((data) => setProblems(data))
      .catch(() => setError("Could not load problems."));
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Problems</h1>
      {error !== null && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {error === null && problems === null && (
        <p className="text-gray-500">Loading problems...</p>
      )}
      {problems !== null && problems.length === 0 && (
        <p className="text-gray-500">No problems yet.</p>
      )}
      {problems !== null && problems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Difficulty
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {problems.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/problems/${p.slug}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${difficultyColor[p.difficulty]}`}
                    >
                      {p.difficulty}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
