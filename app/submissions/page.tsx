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

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/submissions")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load submissions");
        return res.json();
      })
      .then((data) => setSubmissions(data))
      .catch(() => setError("Could not load submissions."));
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Submissions</h1>
      {error !== null && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {error === null && submissions === null && (
        <p className="text-gray-500">Loading submissions...</p>
      )}
      {submissions !== null && submissions.length === 0 && (
        <p className="text-gray-500">No submissions yet.</p>
      )}
      {submissions !== null && submissions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  ID
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Language
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Tests
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Runtime
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {submissions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm">{s.language}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[s.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {s.passedTests}/{s.totalTests}
                  </td>
                  <td className="px-4 py-3 text-sm">{s.executionTimeMs}ms</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(s.createdAt).toLocaleString()}
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
