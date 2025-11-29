import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getStepByAnimationOperationId,
  updateStepAnimationByOperationId,
} from "@/lib/db/queries";
import { getSignedObjectUrl, uploadVideoBuffer } from "@/lib/storage";
import {
  downloadVeoVideo,
  getVeoOperation,
  resolveVeoOperationStatus,
} from "@/lib/veo";

const requestSchema = z.object({
  operationId: z
    .string({
      required_error: "operationId is required.",
      invalid_type_error: "operationId must be a string.",
    })
    .min(1, "operationId cannot be empty."),
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

  const operationId = parseResult.data.operationId;

  try {
    const step = await getStepByAnimationOperationId(operationId);

    if (!step) {
      return NextResponse.json(
        { error: "Animation operation was not found." },
        { status: 404 }
      );
    }

    if (isStepCompleted(step)) {
      const animationUrl = await resolveAnimationUrl(step);
      return buildCompletedResponse(
        operationId,
        animationUrl,
        step.animationError
      );
    }

    const status = await fetchOperationStatus(operationId);

    if (status.status === "pending" || status.status === "processing") {
      await ensureProcessingState(operationId, step);
      const animationUrl = await resolveAnimationUrl(step);
      return buildProcessingResponse(operationId, animationUrl);
    }

    if (status.status === "failed") {
      return await handleFailedOperation(operationId, status.error);
    }

    return await handleSuccessfulOperation(operationId, status.videos[0]);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch Veo operation status.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isStepCompleted(step: {
  animationStatus: string | null;
  animationUrl: string | null;
}) {
  return step.animationStatus === "succeeded" && Boolean(step.animationUrl);
}

async function resolveAnimationUrl(step: {
  animationKey: string | null;
  animationUrl: string | null;
}) {
  if (!step.animationKey) {
    return step.animationUrl ?? null;
  }

  try {
    return await getSignedObjectUrl({
      key: step.animationKey,
    });
  } catch (error) {
    console.error(
      `Failed to create signed URL for animation key ${step.animationKey}`,
      error
    );
    return step.animationUrl ?? null;
  }
}

async function fetchOperationStatus(operationId: string) {
  const operation = await getVeoOperation(operationId);
  return resolveVeoOperationStatus(operation);
}

async function ensureProcessingState(
  operationId: string,
  step: {
    animationStatus: string | null;
    animationUrl: string | null;
    animationKey: string | null;
  }
) {
  if (step.animationStatus === "processing") {
    return;
  }

  await updateStepAnimationByOperationId(operationId, {
    status: "processing",
    url: step.animationUrl,
    key: step.animationKey,
    error: null,
  });
}

async function handleFailedOperation(operationId: string, error?: string) {
  const message = (error ?? "Veo animation failed.").trim();

  await updateStepAnimationByOperationId(operationId, {
    status: "failed",
    url: null,
    key: null,
    error: message,
  });

  return buildFailureResponse(operationId, message);
}

async function handleSuccessfulOperation(
  operationId: string,
  video:
    | {
        mimeType: string;
        videoBytes?: string;
        uri?: string;
      }
    | undefined
) {
  if (!video) {
    return await handleFailedOperation(
      operationId,
      "Veo reported success but the video payload is missing."
    );
  }

  try {
    const downloaded = await downloadVeoVideo({
      videoBytes: video.videoBytes,
      uri: video.uri,
      mimeType: video.mimeType,
    });

    const stored = await uploadVideoBuffer({
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType,
    });

    await updateStepAnimationByOperationId(operationId, {
      status: "succeeded",
      url: stored.url,
      key: stored.key,
      error: null,
    });

    return buildCompletedResponse(
      operationId,
      stored.signedUrl ?? stored.url,
      null
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to store generated animation.";
    await updateStepAnimationByOperationId(operationId, {
      status: "failed",
      url: null,
      key: null,
      error: message,
    });
    return buildFailureResponse(operationId, message);
  }
}

function buildProcessingResponse(
  operationId: string,
  animationUrl: string | null
) {
  return NextResponse.json({
    operationId,
    status: "processing" as const,
    animationUrl,
    animationError: null,
  });
}

function buildCompletedResponse(
  operationId: string,
  animationUrl: string | null,
  animationError: string | null
) {
  return NextResponse.json({
    operationId,
    status: "succeeded" as const,
    animationUrl,
    animationError,
  });
}

function buildFailureResponse(operationId: string, message: string) {
  return NextResponse.json({
    operationId,
    status: "failed" as const,
    animationUrl: null,
    animationError: message,
  });
}
