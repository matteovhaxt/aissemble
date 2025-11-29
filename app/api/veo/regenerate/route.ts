import { NextResponse } from "next/server";
import { z } from "zod";
import { startStepAnimation } from "@/lib/assembly";
import {
  countPlanSteps,
  getPlanStepForAnimation,
  resetStepAnimationById,
} from "@/lib/db/queries";
import { downloadObjectAsDataUrl } from "@/lib/storage";

const requestSchema = z.object({
  stepId: z
    .number({
      required_error: "stepId is required.",
      invalid_type_error: "stepId must be a number.",
    })
    .int("stepId must be an integer.")
    .positive("stepId must be greater than zero."),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parseResult = requestSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Invalid request payload." },
      { status: 400 }
    );
  }

  const stepId = parseResult.data.stepId;

  try {
    const step = await getPlanStepForAnimation(stepId);

    if (!step) {
      return NextResponse.json(
        { error: "Step could not be found." },
        { status: 404 }
      );
    }

    const illustration = await resolveIllustration(step);

    const totalSteps = await countPlanSteps(step.planId);
    const total = totalSteps > 0 ? totalSteps : 1;
    const index = Number.isInteger(step.position) ? step.position : 0;

    const { operationId } = await startStepAnimation({
      step: {
        id: step.stepIdentifier ?? String(step.id),
        title: step.title,
        description: step.description,
        notes: step.notes ?? undefined,
      },
      index,
      totalSteps: total,
      context: {
        attachmentDataUrl: null,
        attachmentMimeType: null,
        requestSummary: step.planRequestSummary,
      },
      illustration,
    });

    await resetStepAnimationById(step.id, {
      status: "processing",
      operationId,
    });

    return NextResponse.json({
      operationId,
      status: "processing",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start Veo animation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function resolveIllustration(step: {
  illustrationKey: string | null;
  illustrationUrl: string | null;
  id: number;
}) {
  if (!(step.illustrationKey || step.illustrationUrl)) {
    throw new Error(
      "This step does not have a stored illustration to generate an animation."
    );
  }

  try {
    return await downloadObjectAsDataUrl({
      key: step.illustrationKey ?? undefined,
      url: step.illustrationUrl ?? undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load step illustration.";
    throw new Error(message);
  }
}
