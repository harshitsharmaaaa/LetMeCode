import { executeWithBlackBox } from "@/lib/blackbox";
import { JudgeError, prepareJudgePlan } from "@/lib/judge/judge";

export const dynamic = "force-dynamic";

// Internal development-only endpoint: execute ONLY the first test case
// of a submission through BlackBox. Synchronous by design (no queue yet).
// Does NOT update Submission.status and does NOT persist the result.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;

  try {
    const plan = await prepareJudgePlan(submissionId);

    const first = plan.testCases[0];
    if (!first) {
      return Response.json(
        { error: "No test cases found for problem" },
        { status: 400 },
      );
    }

    const result = await executeWithBlackBox({
      language: plan.language,
      code: plan.code,
      stdin: first.input,
    });

    return Response.json({
      submissionId: plan.submissionId,
      testCaseId: first.id,
      ...result,
    });
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
