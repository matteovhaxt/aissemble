import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StepAnimationStatus } from "@/lib/assembly";
import { getPlanWithSteps } from "@/lib/db/queries";
import { downloadObjectAsDataUrl, getSignedObjectUrl } from "@/lib/storage";
import {
  type PlanStep,
  PlanStepNavigator,
} from "./_components/plan-step-navigator";

const numericIdRegex = /^\d+$/;

type PlanPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const params = await searchParams;
  const planId = resolvePlanId(params?.id);
  const data = await getPlanWithSteps(planId);

  if (!data) {
    notFound();
  }

  const stepsWithAssets = await resolveStepAssets(data.steps);
  const onboardingSteps = buildOnboardingSteps(
    data.plan.checklist ?? [],
    stepsWithAssets
  );
  const attachmentDetails = await resolveAttachmentPreview(
    data.plan.upload ?? null,
    data.plan.id
  );
  const createdLabel = formatDistanceToNow(data.plan.createdAt, {
    addSuffix: true,
  });
  const canPreviewAttachment =
    attachmentDetails.isImage && Boolean(attachmentDetails.previewUrl);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl">
            {data.plan.project ?? "Assembly plan"}
          </h1>
          <p className="text-muted-foreground text-sm" suppressHydrationWarning>
            Requested {createdLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {attachmentDetails.downloadUrl ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost">View attachment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Attachment preview</DialogTitle>
                  <DialogDescription>
                    {attachmentDetails.name ?? "Uploaded attachment"}
                  </DialogDescription>
                </DialogHeader>
                {canPreviewAttachment ? (
                  <div className="overflow-hidden rounded-md border bg-muted/20">
                    <Image
                      alt={
                        attachmentDetails.name ?? "Uploaded attachment preview"
                      }
                      className="h-full max-h-[70vh] w-full bg-background object-contain"
                      height={720}
                      src={attachmentDetails.previewUrl ?? ""}
                      unoptimized
                      width={1280}
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                    <p>This attachment cannot be previewed.</p>
                    <Button asChild className="mt-3 w-fit" variant="outline">
                      <a
                        download={attachmentDetails.name ?? undefined}
                        href={attachmentDetails.downloadUrl ?? undefined}
                        rel="noopener"
                        target="_blank"
                      >
                        Download attachment
                      </a>
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/">Back to builder</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        <PlanStepNavigator steps={onboardingSteps} />
      </div>
    </div>
  );
}

function resolvePlanId(idParam: string | undefined): number {
  const planId = idParam ? Number(idParam) : Number.NaN;

  if (!Number.isInteger(planId)) {
    notFound();
  }

  return planId;
}

type DbPlanStep = {
  databaseId: number;
  id: string | number | null;
  title: string;
  description: string;
  notes: string | null;
  illustrationUrl: string | null;
  illustrationKey?: string | null;
  animationStatus: string | null;
  animationOperationId?: string | null;
  animationUrl: string | null;
  animationKey?: string | null;
  animationError: string | null;
  position: number;
};

async function resolveStepAssets(steps: DbPlanStep[]) {
  return Promise.all(
    steps.map(async (step) => {
      const [illustrationUrl, animationUrl] = await Promise.all([
        (async () => {
          if (!step.illustrationKey) {
            return step.illustrationUrl;
          }

          try {
            return await downloadObjectAsDataUrl({
              key: step.illustrationKey,
            });
          } catch (error) {
            console.error(
              `Failed to load illustration for step ${step.id ?? "unknown"}`,
              error
            );
            return step.illustrationUrl;
          }
        })(),
        (async () => {
          if (!step.animationKey) {
            return step.animationUrl;
          }

          try {
            return await getSignedObjectUrl({
              key: step.animationKey,
            });
          } catch (error) {
            console.error(
              `Failed to create signed URL for animation ${step.id ?? "unknown"}`,
              error
            );
            return null;
          }
        })(),
      ]);

      return {
        ...step,
        illustrationUrl: illustrationUrl ?? null,
        animationUrl: animationUrl ?? null,
      };
    })
  );
}

function buildOnboardingSteps(
  checklist: string[],
  steps: DbPlanStep[]
): PlanStep[] {
  const onboardingSteps: PlanStep[] = [];

  if (checklist.length > 0) {
    onboardingSteps.push({
      databaseId: null,
      id: -1,
      title: "Supplies & tools",
      description:
        "Review the required supplies and tools before starting the onboarding steps.",
      notes: null,
      checklistItems: checklist,
    });
  }

  onboardingSteps.push(
    ...steps.map((step, index) => ({
      databaseId: step.databaseId,
      id: resolveStepId(step.id, index),
      title: step.title,
      description: step.description,
      notes: step.notes ?? null,
      illustrationUrl: step.illustrationUrl,
      animationStatus:
        (step.animationStatus as StepAnimationStatus | null) ?? null,
      animationOperationId: step.animationOperationId ?? null,
      animationUrl: step.animationUrl,
      animationError: step.animationError ?? null,
      position: step.position,
    }))
  );

  return onboardingSteps;
}

type PlanAttachment = {
  id: number;
  key: string | null;
  name: string | null;
  url: string | null;
  mimeType: string | null;
} | null;

type ResolvedAttachment = {
  isImage: boolean;
  previewUrl: string | null;
  downloadUrl: string | null;
  name: string | null;
};

async function resolveAttachmentPreview(
  attachment: PlanAttachment,
  planId: number
): Promise<ResolvedAttachment> {
  if (!attachment) {
    return {
      isImage: false,
      previewUrl: null,
      downloadUrl: null,
      name: null,
    };
  }

  const downloadUrl = attachment.url ?? null;
  const name = attachment.name ?? null;
  const mimeType = attachment.mimeType?.toLowerCase() ?? null;
  const isImage = Boolean(mimeType?.startsWith("image/"));

  if (!(isImage && attachment.key)) {
    return {
      isImage,
      previewUrl: null,
      downloadUrl,
      name,
    };
  }

  try {
    const previewUrl = await downloadObjectAsDataUrl({
      key: attachment.key,
    });

    return {
      isImage,
      previewUrl,
      downloadUrl,
      name,
    };
  } catch (error) {
    console.error(
      `Failed to load attachment preview for plan ${planId}`,
      error
    );

    return {
      isImage,
      previewUrl: null,
      downloadUrl,
      name,
    };
  }
}

function resolveStepId(
  rawId: DbPlanStep["id"],
  fallbackIndex: number
): number | null {
  if (typeof rawId === "number" && Number.isInteger(rawId)) {
    return rawId;
  }

  if (typeof rawId === "string" && numericIdRegex.test(rawId)) {
    return Number.parseInt(rawId, 10);
  }

  return fallbackIndex;
}
