// Minimal HTTP client for the external BlackBox execution service.
// BlackBox contract (read from TheBlackBox repo, not guessed):
//   POST {BLACKBOX_URL}/api/v1/executions {language, code, stdin?}
//     -> 201 {id, status}
//   GET {BLACKBOX_URL}/api/v1/executions/:id
//     -> 200 {id, language, code, stdin, status, attemptCount,
//             stdout, stderr, exitCode, executionTimeMs,
//             createdAt, completedAt}
// BlackBox languages: "python" | "node" | "cpp" | "java".
// BlackBox statuses: QUEUED, RUNNING (in progress) and
//   COMPLETED, FAILED, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED,
//   OUTPUT_LIMIT_EXCEEDED (final).

export type BlackboxLanguage = "python" | "node" | "cpp" | "java";

export type BlackboxExecution = {
  id: string;
  language: string;
  code: string;
  stdin: string;
  status: string;
  attemptCount: number;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  executionTimeMs: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type BlackboxResult = {
  status: string;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  executionTimeMs: number | null;
};

const FINAL_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "TIME_LIMIT_EXCEEDED",
  "MEMORY_LIMIT_EXCEEDED",
  "OUTPUT_LIMIT_EXCEEDED",
]);

const POLL_INTERVAL_MS = 500;
const EXECUTION_TIMEOUT_MS = 60000;
const REQUEST_TIMEOUT_MS = 10000;

export function getBlackboxUrl(): string {
  const url = process.env["BLACKBOX_URL"];
  if (!url) {
    throw new Error("BLACKBOX_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

// LeetCode submission languages use "javascript"; BlackBox calls it "node".
export function mapLanguage(language: string): BlackboxLanguage {
  if (language === "javascript") return "node";
  if (
    language === "python" ||
    language === "node" ||
    language === "cpp" ||
    language === "java"
  ) {
    return language;
  }
  throw new Error(`Unsupported language for BlackBox: "${language}"`);
}

async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 500);
}

export async function createExecution(input: {
  language: string;
  code: string;
  stdin: string;
}): Promise<{ id: string; status: string }> {
  const language = mapLanguage(input.language);

  let res: Response;
  try {
    res = await fetch(`${getBlackboxUrl()}/api/v1/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code: input.code, stdin: input.stdin }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("BlackBox is unreachable");
  }

  if (!res.ok) {
    throw new Error(
      `BlackBox create execution failed with status ${res.status}: ${await readErrorBody(res)}`,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error("BlackBox returned a malformed response");
  }

  const { id, status } = body as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("BlackBox returned a malformed response");
  }
  return { id, status };
}

export async function getExecution(id: string): Promise<BlackboxExecution> {
  let res: Response;
  try {
    res = await fetch(
      `${getBlackboxUrl()}/api/v1/executions/${encodeURIComponent(id)}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
  } catch {
    throw new Error("BlackBox is unreachable");
  }

  if (!res.ok) {
    throw new Error(
      `BlackBox get execution failed with status ${res.status}: ${await readErrorBody(res)}`,
    );
  }

  try {
    return (await res.json()) as BlackboxExecution;
  } catch {
    throw new Error("BlackBox returned a malformed response");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send one program + stdin to BlackBox and wait for its final state.
export async function executeWithBlackBox(input: {
  language: string;
  code: string;
  stdin: string;
}): Promise<BlackboxResult> {
  const { id } = await createExecution(input);

  const startedAt = Date.now();
  for (;;) {
    const execution = await getExecution(id);

    if (FINAL_STATUSES.has(execution.status)) {
      return {
        status: execution.status,
        stdout: execution.stdout,
        stderr: execution.stderr,
        exitCode: execution.exitCode,
        executionTimeMs: execution.executionTimeMs,
      };
    }

    if (Date.now() - startedAt > EXECUTION_TIMEOUT_MS) {
      throw new Error("Timed out waiting for BlackBox execution");
    }

    await sleep(POLL_INTERVAL_MS);
  }
}
