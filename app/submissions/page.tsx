"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Submission = {
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

type ProblemSummary = {
  id: string;
  title: string;
  slug: string;
};

const STATUS_STYLES: Record<string, string> = {
  QUEUED: "bg-slate-200 text-slate-700 border-slate-300",
  RUNNING: "bg-blue-100 text-blue-800 border-blue-200",
  ACCEPTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  WRONG_ANSWER: "bg-red-100 text-red-800 border-red-200",
  TIME_LIMIT_EXCEEDED: "bg-orange-100 text-orange-800 border-orange-200",
  MEMORY_LIMIT_EXCEEDED: "bg-purple-100 text-purple-800 border-purple-200",
  RUNTIME_ERROR: "bg-red-100 text-red-800 border-red-200",
  COMPILE_ERROR: "bg-amber-100 text-amber-800 border-amber-200",
  INTERNAL_ERROR: "bg-slate-200 text-slate-600 border-slate-300",
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

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [problems, setProblems] = useState<Record<string, ProblemSummary>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/submissions").then((res) => {
        if (!res.ok) throw new Error("submissions");
        return res.json();
      }),
      fetch("/api/problems").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([subs, probs]: [Submission[], ProblemSummary[]]) => {
        if (cancelled) return;
        setSubmissions(subs);
        const map: Record<string, ProblemSummary> = {};
        for (const p of probs) map[p.id] = p;
        setProblems(map);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load submissions. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Submissions</h1>
      <p className="text-sm text-slate-500 mb-6">
        Latest 50 submissions across all problems. Submitted code is never shown here.
      </p>
      {error !== null && (
        <div className="bg-white border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      {error === null && submissions === null && (
        <p className="text-slate-500">Loading submissions…</p>
      )}
      {submissions !== null && submissions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
          <p className="text-slate-600">No submissions yet.</p>
          <Link href="/problems" className="text-blue-700 hover:underline text-sm mt-2 inline-block">
            Solve your first problem →
          </Link>
        </div>
      )}
      {submissions !== null && submissions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-160">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Problem
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Language
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Tests
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Runtime
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map((s) => {
                const p = problems[s.problemId];
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      {p ? (
                        <Link
                          href={`/problems/${p.slug}`}
                          className="text-blue-700 hover:underline font-medium"
                        >
                          {p.title}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">
                          {s.problemId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-mono">{s.language}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-md text-xs font-semibold border ${STATUS_STYLES[s.status] || "bg-slate-200 text-slate-700 border-slate-300"}`}
                      >
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {s.passedTests}/{s.totalTests}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{s.executionTimeMs}ms</td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
