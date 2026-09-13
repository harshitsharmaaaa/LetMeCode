"use client";

import { useEffect, useState } from "react";

type ProblemSummary = {
  id: string;
  title: string;
  slug: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
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
    <main>
      <h1>Problems</h1>
      {error !== null && <p>{error}</p>}
      {error === null && problems === null && <p>Loading problems...</p>}
      {problems !== null && problems.length === 0 && (
        <p>No problems yet. Run the seed script to add some.</p>
      )}
      {problems !== null && problems.length > 0 && (
        <ul>
          {problems.map((p) => (
            <li key={p.id}>
              {p.title} ({p.slug}) - {p.difficulty}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
