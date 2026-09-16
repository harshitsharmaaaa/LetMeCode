import { JudgeError, runJudge } from "@/lib/judge/judge";

export const dynamic = "force-dynamic";

// Internal development-only endpoint: synchronously judge a submission
// across ALL its test cases (public + hidden) and return the aggregated
// result. Exposes only safe per-test fields, never hidden inputs, expected
// outputs, generated source, or program output.
// Does NOT persist the result and does NOT change Submission.status.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;

  try {
    return Response.json(await runJudge(submissionId));
  } catch (err) {
    if (err instanceof JudgeError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
