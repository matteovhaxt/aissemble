import { NextResponse } from "next/server";
import {
  generateAssemblyPlan,
  generateStepIllustration,
  type IllustratedAssemblyPlan,
  type StepAnimationStatus,
  startStepAnimation,
} from "@/lib/assembly";
import {
  createPlanRecord,
  getUploadById,
  getUploadByKey,
  type PlanStepInsert,
} from "@/lib/db/queries";
import { downloadObjectAsDataUrl, uploadDataUrlImage } from "@/lib/storage";

type AssemblyPlanRequest = {
  attachmentUrl?: string | null;
  attachmentMimeType?: string | null;
  attachmentName?: string | null;
  attachmentUploadId?: number | null;
  attachmentKey?: string | null;
  request: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AssemblyPlanRequest>;
  const requestSummary = body.request?.trim() ?? "";

  if (requestSummary.length === 0) {
    return NextResponse.json(
      { error: "Provide a description of what you would like to assemble." },
      { status: 400 }
    );
  }

  const attachment = await resolveAttachmentDetails({
    url: sanitizeNullableString(body.attachmentUrl),
    mimeType: sanitizeNullableString(body.attachmentMimeType),
    name: sanitizeNullableString(body.attachmentName),
    key: sanitizeNullableString(body.attachmentKey),
    uploadId: sanitizeNullableNumber(body.attachmentUploadId),
  });

  if (!attachment.success) {
    return NextResponse.json(
      { error: attachment.message },
      { status: attachment.status }
    );
  }

  const plan = await generateAssemblyPlan(
    requestSummary,
    attachment.meta.name,
    attachment.dataUrl
  );

  const illustratedSteps = await buildIllustratedSteps({
    steps: plan.steps,
    totalSteps: plan.steps.length,
    attachmentDataUrl: attachment.dataUrl,
    attachmentMimeType: attachment.meta.mimeType,
    requestSummary,
  });

  let persistedSteps:
    | {
        responseSteps: IllustratedAssemblyPlan["steps"];
        dbSteps: PlanStepInsert[];
      }
    | undefined;

  try {
    persistedSteps = await persistStepIllustrations(illustratedSteps);
  } catch (error) {
    console.error("Failed to store step illustrations", error);
    return NextResponse.json(
      {
        error:
          "We generated your plan but storing step illustrations failed. Please try again.",
      },
      { status: 500 }
    );
  }

  const illustratedPlan: IllustratedAssemblyPlan = {
    ...plan,
    steps: persistedSteps.responseSteps,
  };

  let planRecordId: number;

  try {
    const planRecord = await createPlanRecord({
      requestSummary,
      plan: illustratedPlan,
      attachment: {
        uploadId: attachment.meta.uploadId ?? null,
      },
      steps: persistedSteps.dbSteps,
    });
    planRecordId = planRecord.id;
  } catch {
    return NextResponse.json(
      { error: "Failed to store generated plan. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ plan: illustratedPlan, planId: planRecordId });
}

function sanitizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function sanitizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

type PlanStepInput = {
  id: string;
  title: string;
  description: string;
  notes?: string;
};

async function buildIllustratedSteps({
  steps,
  totalSteps,
  attachmentDataUrl,
  attachmentMimeType,
  requestSummary,
}: {
  steps: PlanStepInput[];
  totalSteps: number;
  attachmentDataUrl: string | null;
  attachmentMimeType: string | null;
  requestSummary: string;
}): Promise<IllustratedAssemblyPlan["steps"]> {
  return await Promise.all(
    steps.map(async (step, index) => {
      const illustration = await generateStepIllustration(
        step,
        index,
        totalSteps,
        {
          attachmentDataUrl,
          attachmentMimeType,
          requestSummary,
        }
      );

      let animationStatus: StepAnimationStatus | null = null;
      let animationOperationId: string | null = null;
      let animationError: string | null = null;

      const shouldAnimate = Boolean(illustration) && index === 0;

      if (shouldAnimate) {
        try {
          const { operationId } = await startStepAnimation({
            step,
            index,
            totalSteps,
            context: {
              attachmentDataUrl,
              attachmentMimeType,
              requestSummary,
            },
            illustration,
          });
          animationStatus = "processing";
          animationOperationId = operationId;
          animationError = null;
        } catch (error) {
          animationStatus = "failed";
          console.error(
            `Failed to start animation for step ${step.id ?? `index-${index}`}`,
            error
          );
          animationError =
            error instanceof Error
              ? error.message
              : "Failed to start Veo animation.";
        }
      } else if (!illustration) {
        animationStatus = "failed";
        animationError = "Step illustration was not generated.";
      }

      return {
        ...step,
        illustration: illustration ?? undefined,
        animationStatus,
        animationOperationId,
        animationUrl: null,
        animationKey: null,
        animationError,
      };
    })
  );
}

async function persistStepIllustrations(
  steps: IllustratedAssemblyPlan["steps"]
): Promise<{
  responseSteps: IllustratedAssemblyPlan["steps"];
  dbSteps: PlanStepInsert[];
}> {
  const entries = await Promise.all(
    steps.map(async (step) => {
      if (!step.illustration?.startsWith("data:")) {
        return {
          responseStep: step,
          dbStep: {
            id: step.id,
            title: step.title,
            description: step.description,
            notes: step.notes ?? null,
            illustrationKey: null,
            illustrationUrl: step.illustration ?? null,
            animationStatus: step.animationStatus ?? null,
            animationOperationId: step.animationOperationId ?? null,
            animationKey: step.animationKey ?? null,
            animationUrl: step.animationUrl ?? null,
            animationError: step.animationError ?? null,
          } satisfies PlanStepInsert,
        };
      }

      const stored = await uploadDataUrlImage(step.illustration);

      return {
        responseStep: {
          ...step,
          illustration: stored.url,
        },
        dbStep: {
          id: step.id,
          title: step.title,
          description: step.description,
          notes: step.notes ?? null,
          illustrationKey: stored.key,
          illustrationUrl: stored.url,
          animationStatus: step.animationStatus ?? null,
          animationOperationId: step.animationOperationId ?? null,
          animationKey: step.animationKey ?? null,
          animationUrl: step.animationUrl ?? null,
          animationError: step.animationError ?? null,
        } satisfies PlanStepInsert,
      };
    })
  );

  return {
    responseSteps: entries.map((entry) => entry.responseStep),
    dbSteps: entries.map((entry) => entry.dbStep),
  };
}

type AttachmentInput = {
  url: string | null;
  mimeType: string | null;
  name: string | null;
  key: string | null;
  uploadId: number | null;
};

type AttachmentResolutionSuccess = {
  success: true;
  dataUrl: string | null;
  meta: {
    uploadId: number | null;
    mimeType: string | null;
    name: string | null;
  };
};

type AttachmentResolutionFailure = {
  success: false;
  status: number;
  message: string;
};

type AttachmentResolution =
  | AttachmentResolutionSuccess
  | AttachmentResolutionFailure;

async function resolveAttachmentDetails(
  input: AttachmentInput
): Promise<AttachmentResolution> {
  let uploadRecord =
    input.uploadId !== null ? await getUploadById(input.uploadId) : undefined;

  if (input.uploadId !== null && !uploadRecord) {
    return {
      success: false,
      status: 422,
      message:
        "We couldn't locate the uploaded file. Please attach it again and retry.",
    };
  }

  if (!uploadRecord && input.key) {
    uploadRecord = await getUploadByKey(input.key);
  }

  const resolvedKey = input.key ?? uploadRecord?.key ?? null;
  const resolvedUrl = input.url ?? uploadRecord?.url ?? null;
  const resolvedMimeType = input.mimeType ?? uploadRecord?.mimeType ?? null;
  const resolvedName = input.name ?? uploadRecord?.name ?? null;
  const resolvedUploadId = uploadRecord?.id ?? input.uploadId ?? null;

  if (!(resolvedKey || resolvedUrl)) {
    return {
      success: true,
      dataUrl: null,
      meta: {
        uploadId: resolvedUploadId,
        mimeType: resolvedMimeType,
        name: resolvedName,
      },
    };
  }

  try {
    const dataUrl = await downloadObjectAsDataUrl({
      key: resolvedKey,
      url: resolvedUrl,
    });

    return {
      success: true,
      dataUrl,
      meta: {
        uploadId: resolvedUploadId,
        mimeType: resolvedMimeType,
        name: resolvedName,
      },
    };
  } catch (error) {
    console.error("Failed to download attachment", error);

    return {
      success: false,
      status: 422,
      message:
        "We couldn't access the attachment. Please re-upload the file and try again.",
    };
  }
}
