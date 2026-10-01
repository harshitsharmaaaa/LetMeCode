import { executeWithBlackBox } from "@/lib/blackbox";
import { generateHarnessSource } from "@/lib/judge/harness";
import { JudgeError, prepareJudgePlan } from "@/lib/judge/judge";
import { isDevEnvironment } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Internal development-only endpoint: execute ONLY the first test case
// of a submission through BlackBox. Synchronous by design (no queue yet).
// Does NOT update Submission.status and does NOT persist the result.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  if (!isDevEnvironment()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
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

    const { sourceCode } = generateHarnessSource({
      language: plan.language,
      code: plan.code,
      problemSlug: plan.problemSlug,
      testCaseInput: first.input,
    });

    const result = await executeWithBlackBox({
      language: plan.language,
      code: sourceCode,
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
