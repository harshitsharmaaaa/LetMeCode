import { HarnessError, generateHarnessSource } from "@/lib/judge/harness";
import { JudgeError, prepareJudgePlan } from "@/lib/judge/judge";

export const dynamic = "force-dynamic";

// Internal development-only endpoint: generate the standalone runnable
// source for a submission's FIRST test case only. Returns hidden test case
// data, so it must never be exposed via frontend.
// Does NOT execute code, does NOT call BlackBox, does NOT change status.
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

    const { sourceCode } = generateHarnessSource({
      language: plan.language,
      code: plan.code,
      problemSlug: plan.problemSlug,
      testCaseInput: first.input,
    });

    return Response.json({
      submissionId: plan.submissionId,
      testCaseId: first.id,
      language: plan.language,
      sourceCode,
    });
  } catch (err) {
    if (err instanceof JudgeError || err instanceof HarnessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
