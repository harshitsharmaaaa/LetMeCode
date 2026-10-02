"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getStarterCode } from "@/lib/starter";

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

type RunResult = {
  testCaseId: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  executionTimeMs: number | null;
  expectedOutput: string;
  passed: boolean;
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

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HARD: "bg-red-100 text-red-800 border-red-200",
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
  COMPLETED: "Completed",
  FAILED: "Error",
  OUTPUT_LIMIT_EXCEEDED: "Output Limit Exceeded",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusStyle(status: string): string {
  return (
    STATUS_STYLES[status] ?? "bg-slate-200 text-slate-700 border-slate-300"
  );
}

function friendlyError(status: number, fallback: string): string {
  if (status === 404) return "Not found. It may have been removed.";
  if (status === 429)
    return "Too many requests. Please wait a minute and try again.";
  if (status === 503)
    return "The judge is temporarily unavailable. Please try again shortly.";
  return fallback;
}

export default function ProblemDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("python");
  // Per-language edits: switching languages never discards typed code.
  // Untouched languages fall back to their starter template.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [history, setHistory] = useState<SubmissionResult[]>([]);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbort = useRef(false);

  const code = problem
    ? (edits[language] ?? getStarterCode(problem.slug, language))
    : "";
  const selectedTest =
    problem?.testCases.find((t) => t.id === selectedTestId) ??
    problem?.testCases[0] ??
    null;
  const busy = running || submitting || polling;

  // Load the problem once per slug. Hidden test cases are never included:
  // the API only returns public ones.
  useEffect(() => {
    let cancelled = false;
    setProblem(null);
    setLoadError(null);
    setRunResult(null);
    setSubmission(null);
    setHistory([]);

    fetch(`/api/problems/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error(friendlyError(res.status, "Could not load problem."));
        return res.json();
      })
      .then((data: ProblemDetail) => {
        if (cancelled) return;
        setProblem(data);
        setEdits({});
        if (data.supportedLanguages.length > 0) {
          setLanguage((current) =>
            data.supportedLanguages.includes(current)
              ? current
              : data.supportedLanguages[0]!,
          );
        }
        setSelectedTestId(data.testCases[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load problem.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Stop polling on unmount.
  useEffect(() => {
    pollAbort.current = false;
    return () => {
      pollAbort.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const pollSubmission = useCallback(async (submissionId: string) => {
    setPolling(true);
    const poll = async () => {
      if (pollAbort.current) return;
      try {
        const res = await fetch(`/api/submissions/${submissionId}`);
        if (!res.ok) {
          if (!pollAbort.current) {
            setSubmitError(friendlyError(res.status, "Could not fetch submission result."));
            setPolling(false);
          }
          return;
        }
        const data: SubmissionResult = await res.json();
        if (pollAbort.current) return;
        setSubmission(data);
        if (FINAL_STATUSES.has(data.status)) {
          setPolling(false);
          // Refresh per-problem history once judged.
          fetch(`/api/submissions?problemId=${data.problemId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((list: SubmissionResult[]) => {
              if (!pollAbort.current) setHistory(list.slice(0, 5));
            })
            .catch(() => {});
          return;
        }
        pollTimer.current = setTimeout(poll, 2000);
      } catch {
        if (!pollAbort.current) {
          setSubmitError("Lost connection while waiting for the result.");
          setPolling(false);
        }
      }
    };
    poll();
  }, []);

  // Load recent submissions for this problem (for context, not required).
  useEffect(() => {
    if (!problem) return;
    let cancelled = false;
    fetch(`/api/submissions?problemId=${problem.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: SubmissionResult[]) => {
        if (!cancelled) setHistory(list.slice(0, 5));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [problem]);

  const handleRun = async () => {
    if (!problem || !selectedTest || busy) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    // A Run must not leave a stale submission/error panel on screen (e.g. an
    // old "Internal Error" from a failed submit) — show only this run's result.
    setSubmission(null);
    setSubmitError(null);
    try {
      const res = await fetch("/api/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          language,
          code,
          testCaseId: selectedTest.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : friendlyError(res.status, "Run failed."),
        );
      }
      setRunResult(data as RunResult);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem || busy) return;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollAbort.current = false;
    setSubmitting(true);
    setSubmitError(null);
    setSubmission(null);
    // Symmetrically clear the run panel so a stale Run result never sits
    // next to a new submission outcome.
    setRunError(null);
    setRunResult(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, language, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : friendlyError(res.status, "Submission failed."),
        );
      }
      setSubmission({ ...data, passedTests: 0, totalTests: 0, executionTimeMs: 0, failedTestNumber: null, problemId: problem.id, language });
      await pollSubmission(data.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditorKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) void handleSubmit();
      else void handleRun();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next =
        code.slice(0, start) + "  " + code.slice(end);
      setEdits((prev) => ({ ...prev, [language]: next }));
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  if (loadError !== null && problem === null) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {loadError}
        </div>
        <Link href="/problems" className="text-blue-700 hover:underline text-sm mt-4 inline-block">
          ← Back to problems
        </Link>
      </main>
    );
  }

  if (problem === null) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <p className="text-slate-500">Loading problem…</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-4 sm:p-6">
      <Link href="/problems" className="text-sm text-slate-500 hover:text-slate-800 mb-4 inline-block">
        ← All problems
      </Link>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* LEFT: problem content */}
        <div className="space-y-4 min-w-0">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{problem.title}</h1>
              <span
                className={`inline-block px-2 py-1 rounded-md text-xs font-semibold border ${DIFFICULTY_STYLES[problem.difficulty] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
              >
                {problem.difficulty}
              </span>
            </div>
            <p className="mt-3 text-slate-700 leading-relaxed whitespace-pre-wrap">
              {problem.description}
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Examples</h2>
            <div className="space-y-3">
              {problem.examples.map((ex, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <p className="text-slate-700">
                    <span className="font-semibold text-slate-900">Input: </span>
                    <code className="font-mono text-slate-800">{ex.input}</code>
                  </p>
                  <p className="mt-1 text-slate-700">
                    <span className="font-semibold text-slate-900">Output: </span>
                    <code className="font-mono text-slate-800">{ex.output}</code>
                  </p>
                  {ex.explanation && (
                    <p className="mt-1 text-slate-500">{ex.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Constraints</h2>
            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap font-mono">
              {problem.constraints}
            </pre>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Public test cases</h2>
            <p className="text-sm text-slate-500 mb-3">
              Select a test case, then press <span className="font-semibold">Run Code</span> to try it. Hidden tests only run on submit.
            </p>
            {problem.testCases.length === 0 ? (
              <p className="text-sm text-slate-500">No public test cases for this problem.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {problem.testCases.map((tc, i) => (
                    <button
                      key={tc.id}
                      onClick={() => setSelectedTestId(tc.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        selectedTest?.id === tc.id
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      Case {i + 1}
                    </button>
                  ))}
                </div>
                {selectedTest && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-slate-900">Input</p>
                    <pre className="mt-1 font-mono text-slate-800 whitespace-pre-wrap">{selectedTest.input}</pre>
                    <p className="mt-3 font-semibold text-slate-900">Expected output</p>
                    <pre className="mt-1 font-mono text-slate-800 whitespace-pre-wrap">{selectedTest.expectedOutput}</pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: editor + run/submit */}
        <div className="space-y-4 min-w-0 lg:sticky lg:top-4">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="text-sm font-semibold text-slate-900">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={busy}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-800 disabled:opacity-50"
              >
                {problem.supportedLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={code}
              onChange={(e) => setEdits((prev) => ({ ...prev, [language]: e.target.value }))}
              onKeyDown={handleEditorKeyDown}
              disabled={busy}
              spellCheck={false}
              rows={18}
              placeholder="Write your solution here…"
              className="mt-3 w-full border border-slate-300 rounded-lg p-3 font-mono text-[13px] leading-relaxed bg-slate-950 text-slate-100 resize-y min-h-72 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-2 text-xs text-slate-500">
              Tip: <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1">Ctrl/⌘ + Enter</kbd> runs the selected test case.
            </p>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={handleRun}
                disabled={busy || !selectedTest}
                className="px-4 py-2 rounded-lg font-semibold text-sm bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {running ? "Running…" : "Run Code"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={busy}
                className="px-4 py-2 rounded-lg font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Submitting…" : polling ? "Judging…" : "Submit"}
              </button>
              {busy && (
                <span className="text-sm text-slate-500">Working…</span>
              )}
            </div>
          </section>

          {runError && (
            <div className="bg-white border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {runError}
            </div>
          )}

          {runResult && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Run result</h3>
                <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${runResult.passed ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"}`}>
                  {runResult.passed ? "Passed" : "Failed"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-medium text-slate-800">{statusLabel(runResult.status)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Runtime</dt>
                  <dd className="font-medium text-slate-800">{runResult.executionTimeMs ?? 0}ms</dd>
                </div>
              </dl>
              <div className="mt-3 text-sm space-y-2">
                <div>
                  <p className="font-semibold text-slate-900">Your output</p>
                  <pre className="mt-1 bg-slate-950 text-slate-100 font-mono rounded-lg p-3 whitespace-pre-wrap">{runResult.stdout ?? "(no output)"}</pre>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Expected output</p>
                  <pre className="mt-1 bg-slate-50 border border-slate-200 font-mono rounded-lg p-3 whitespace-pre-wrap text-slate-800">{runResult.expectedOutput}</pre>
                </div>
                {runResult.stderr && (
                  <div>
                    <p className="font-semibold text-slate-900">Errors</p>
                    <pre className="mt-1 bg-red-50 border border-red-200 text-red-800 font-mono rounded-lg p-3 whitespace-pre-wrap text-xs">{runResult.stderr.slice(0, 2000)}</pre>
                  </div>
                )}
              </div>
            </section>
          )}

          {submitError && (
            <div className="bg-white border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {submitError}
            </div>
          )}

          {submission && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Submission result</h3>
                <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${statusStyle(submission.status)}`}>
                  {statusLabel(submission.status)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Tests passed: </span>
                  <span className="font-semibold text-slate-900">{submission.passedTests}/{submission.totalTests}</span>
                </div>
                <div>
                  <span className="text-slate-500">Runtime: </span>
                  <span className="font-semibold text-slate-900">{submission.executionTimeMs}ms</span>
                </div>
                {submission.failedTestNumber !== null && submission.failedTestNumber !== undefined && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Failed test: </span>
                    <span className="font-semibold text-slate-900">Test case {submission.failedTestNumber}</span>
                    <span className="text-slate-500 text-xs"> (details hidden)</span>
                  </div>
                )}
              </div>
              {polling && (
                <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Waiting for the judge…
                </div>
              )}
            </section>
          )}

          {history.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Recent submissions</h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {history.map((s) => (
                  <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-slate-500">{s.id.slice(0, 8)}</span>
                    <span className="text-slate-600">{s.language}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${statusStyle(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                    <span className="text-slate-600">{s.passedTests}/{s.totalTests}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
