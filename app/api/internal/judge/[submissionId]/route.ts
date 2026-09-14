import { JudgeError, prepareJudgePlan } from "@/lib/judge/judge";

export const dynamic = "force-dynamic";

// Internal development-only endpoint to verify judge preparation.
// Returns hidden test cases, so it must never be exposed via frontend.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;

  try {
    const plan = await prepareJudgePlan(submissionId);
    return Response.json(plan);
  } catch (err) {
    if (err instanceof JudgeError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
