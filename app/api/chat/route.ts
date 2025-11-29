import { NextResponse } from "next/server";
import {
  generateAssemblyPlan,
  generateStepIllustration,
  type IllustratedAssemblyPlan,
} from "@/lib/assembly";

type AssemblyPlanRequest = {
  attachmentDataUrl?: string | null;
  attachmentMimeType?: string | null;
  attachmentName?: string | null;
  request: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AssemblyPlanRequest>;

  if (typeof body.request !== "string" || body.request.trim().length === 0) {
    return NextResponse.json(
      { error: "Provide a description of what you would like to assemble." },
      { status: 400 }
    );
  }

  const requestSummary = body.request.trim();

  const plan = await generateAssemblyPlan(
    requestSummary,
    body.attachmentName,
    body.attachmentDataUrl
  );

  const illustratedSteps = await Promise.all(
    plan.steps.map(async (step, index) => ({
      ...step,
      illustration: await generateStepIllustration(
        step,
        index,
        plan.steps.length,
        {
          attachmentDataUrl: body.attachmentDataUrl ?? null,
          attachmentMimeType: body.attachmentMimeType,
          requestSummary,
        }
      ),
    }))
  );

  const illustratedPlan: IllustratedAssemblyPlan = {
    ...plan,
    steps: illustratedSteps,
  };

  return NextResponse.json({
    plan: illustratedPlan,
  });
}
