"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ProblemSummary = {
  id: string;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HARD: "bg-red-100 text-red-800 border-red-200",
};

export default function Home() {
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
        if (!cancelled) setError("Could not load problems right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-3">LetMeCode</h1>
        <p className="text-slate-500 text-lg">
          Solve coding problems. Run the public tests, then submit against the hidden suite.
        </p>
      </div>

      <div className="flex gap-3 justify-center mb-10 flex-wrap">
        <Link
          href="/problems"
          className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-700 transition"
        >
          Browse Problems
        </Link>
        <Link
          href="/submissions"
          className="bg-white border border-slate-300 text-slate-800 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition"
        >
          My Submissions
        </Link>
      </div>

      {error !== null && (
        <div className="bg-white border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {error === null && problems === null && (
        <p className="text-slate-500 text-center">Loading problems…</p>
      )}
      {problems !== null && problems.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Problems</h2>
          <div className="grid gap-3">
            {problems.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/problems/${p.slug}`}
                className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition"
              >
                <span className="font-medium text-slate-900">{p.title}</span>
                <span
                  className={`px-2 py-1 rounded-md text-xs font-semibold border ${DIFFICULTY_STYLES[p.difficulty] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
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
