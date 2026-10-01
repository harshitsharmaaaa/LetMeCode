"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProblemSummary = {
  id: string;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  supportedLanguages?: string[];
};

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HARD: "bg-red-100 text-red-800 border-red-200",
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/problems")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load problems");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setProblems(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load problems. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Problems</h1>
      <p className="text-sm text-slate-500 mb-6">
        Pick a problem, write a solution, run the public tests, then submit.
      </p>
      {error !== null && (
        <div className="bg-white border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      {error === null && problems === null && (
        <p className="text-slate-500">Loading problems…</p>
      )}
      {problems !== null && problems.length === 0 && (
        <p className="text-slate-500">No problems yet.</p>
      )}
      {problems !== null && problems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600 hidden sm:table-cell">
                  Languages
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Difficulty
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {problems.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/problems/${p.slug}`}
                      className="text-blue-700 hover:underline font-medium"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="font-mono text-xs text-slate-500">
                      {(p.supportedLanguages ?? []).join(" · ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded-md text-xs font-semibold border ${DIFFICULTY_STYLES[p.difficulty] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
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
