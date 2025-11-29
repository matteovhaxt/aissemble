"use client";

import { formatDistanceToNow } from "date-fns";
import { Paperclip, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { IllustratedAssemblyPlan } from "@/lib/assembly";

export default function AssemblyInputPage() {
  const [request, setRequest] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadedAttachment, setUploadedAttachment] = useState<{
    fileId: string;
    url: string;
    mimeType: string;
    name: string;
    key: string;
    id: number;
  } | null>(null);
  const [plan, setPlan] = useState<IllustratedAssemblyPlan | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [plansList, setPlansList] = useState<StoredPlanSummary[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? [];
    event.target.value = "";

    if (!file) {
      setAttachment(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      setAttachment(null);
      return;
    }

    setAttachment(file);
    setUploadedAttachment(null);
    setError("");
  };

  const getFileIdentifier = useCallback(
    (file: File) => `${file.name}:${file.size}:${file.lastModified}`,
    []
  );

  const uploadAttachment = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as {
      id?: number;
      url?: string;
      key?: string;
      contentType?: string;
      error?: string;
    };

    if (
      !(
        response.ok &&
        data.url &&
        data.key &&
        typeof data.id === "number" &&
        Number.isInteger(data.id)
      )
    ) {
      throw new Error(data.error ?? "Failed to upload attachment.");
    }

    return {
      id: data.id,
      url: data.url,
      key: data.key,
      contentType: data.contentType ?? file.type,
    };
  }, []);

  const resolveAttachmentUpload = useCallback(
    async (file: File | null) => {
      if (!file) {
        setUploadedAttachment(null);
        return {
          url: null,
          mimeType: null,
          name: null,
          key: null,
          uploadId: null,
        };
      }

      const fileId = getFileIdentifier(file);

      if (uploadedAttachment && uploadedAttachment.fileId === fileId) {
        return {
          url: uploadedAttachment.url,
          mimeType: uploadedAttachment.mimeType,
          name: uploadedAttachment.name,
          key: uploadedAttachment.key,
          uploadId: uploadedAttachment.id,
        };
      }

      const uploaded = await uploadAttachment(file);
      const nextUploadedAttachment = {
        fileId,
        url: uploaded.url,
        mimeType: uploaded.contentType,
        name: file.name,
        key: uploaded.key,
        id: uploaded.id,
      };

      setUploadedAttachment(nextUploadedAttachment);

      return {
        url: nextUploadedAttachment.url,
        mimeType: nextUploadedAttachment.mimeType,
        name: nextUploadedAttachment.name,
        key: nextUploadedAttachment.key,
        uploadId: nextUploadedAttachment.id,
      };
    },
    [getFileIdentifier, uploadAttachment, uploadedAttachment]
  );

  const loadPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    setPlansError(null);
    try {
      const response = await fetch("/api/plans");
      const data = (await response.json()) as {
        plans?: StoredPlanSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load plans.");
      }
      setPlansList(data.plans ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load plans.";
      setPlansError(message);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = request.trim();

      if (trimmed.length === 0) {
        return;
      }

      setIsLoading(true);
      setError("");
      setPlan(null);

      try {
        const {
          url: attachmentUrl,
          mimeType: attachmentMimeType,
          name: attachmentName,
          key: attachmentKey,
          uploadId: attachmentUploadId,
        } = await resolveAttachmentUpload(attachment);

        const response = await fetch("/api/chat", {
          body: JSON.stringify({
            attachmentUrl,
            attachmentMimeType,
            attachmentName,
            attachmentKey,
            attachmentUploadId,
            request: trimmed,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to generate plan.");
        }

        const data = (await response.json()) as {
          plan: IllustratedAssemblyPlan;
          planId?: number;
        };

        if (!Number.isInteger(data.planId)) {
          throw new Error(
            "Plan was generated but its identifier is missing. Please try again."
          );
        }

        setAttachment(null);
        setUploadedAttachment(null);
        setRequest("");
        await loadPlans();
        router.push(`/plan?id=${data.planId}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [attachment, request, resolveAttachmentUpload, loadPlans, router]
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      {plan ? (
        <AssemblyFlow
          onReset={() => {
            setPlan(null);
            setAttachment(null);
            setUploadedAttachment(null);
            setError("");
          }}
          plan={plan}
        />
      ) : (
        <form
          className="flex w-full max-w-2xl flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label="Describe what you want to assemble"
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Describe what you want to assemble"
              value={request}
            />
            <input
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            <Button
              aria-label="Attach reference image"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="outline"
            >
              <Paperclip aria-hidden="true" className="size-4" />
            </Button>
            <Button
              disabled={isLoading || request.trim().length === 0}
              type="submit"
            >
              {isLoading ? (
                <Spinner className="size-4" />
              ) : (
                <Send aria-hidden="true" className="size-4" />
              )}
            </Button>
          </div>
          {attachment ? (
            <p className="text-muted-foreground text-sm">
              Attached: {attachment.name}
            </p>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      )}
      <PlanList
        className="mt-12 w-full max-w-3xl"
        error={plansError}
        isLoading={isLoadingPlans}
        plans={plansList}
      />
    </div>
  );
}

type AssemblyFlowProps = {
  onReset: () => void;
  plan: IllustratedAssemblyPlan;
};

function AssemblyFlow({ onReset, plan }: AssemblyFlowProps) {
  return (
    <div className="mt-8 w-full max-w-3xl space-y-6">
      <header className="space-y-2 text-center">
        <h2 className="font-semibold text-2xl">
          {plan.project ?? "Assembly plan"}
        </h2>
        {plan.checklist.length > 0 ? (
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-left">
            <h3 className="font-medium text-sm uppercase tracking-wide">
              Supplies & tools
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              {plan.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <ol className="space-y-4">
        {plan.steps.map((step, index) => (
          <li
            className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-sm"
            key={step.id}
          >
            <div className="mb-2 flex items-baseline gap-2">
              <span className="font-semibold text-primary text-sm">
                Step {index + 1}
              </span>
              <span className="font-medium">{step.title}</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.description}
            </p>
            {step.notes ? (
              <p className="mt-2 text-muted-foreground text-xs italic">
                Note: {step.notes}
              </p>
            ) : null}
            {step.illustration ? (
              <div className="mt-3 overflow-hidden rounded-md border bg-muted/10">
                <Image
                  alt={`Illustration for ${step.title}`}
                  className="h-full max-h-80 w-full bg-white object-contain"
                  height={384}
                  src={step.illustration}
                  unoptimized
                  width={512}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <Button onClick={onReset} type="button" variant="outline">
        Start a new plan
      </Button>
    </div>
  );
}

type StoredPlanSummary = {
  id: number;
  requestSummary: string;
  project: string | null;
  createdAt: string;
  stepsCount: number;
  upload?: {
    id: number;
    name: string | null;
    url: string | null;
    mimeType: string | null;
  } | null;
};

type PlanListProps = {
  plans: StoredPlanSummary[];
  isLoading: boolean;
  error: string | null;
  className?: string;
};

function PlanList({ plans, isLoading, error, className }: PlanListProps) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between">
        {isLoading ? <Spinner className="size-4" /> : null}
      </div>
      {error ? <p className="mt-2 text-destructive text-sm">{error}</p> : null}
      {plans.length === 0 && !isLoading && !error ? (
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Plans you generate will appear here.
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {plans.map((planItem) => {
          const createdLabel = formatDistanceToNow(
            new Date(planItem.createdAt),
            {
              addSuffix: true,
            }
          );

          return (
            <li key={planItem.id}>
              <Link
                className="flex flex-col gap-1 rounded-md px-3 py-2 text-sm hover:bg-muted/60"
                href={`/plan?id=${planItem.id}`}
              >
                <span className="font-medium">
                  {planItem.project ?? planItem.requestSummary}
                </span>
                <span className="text-muted-foreground text-xs">
                  Created {createdLabel} · {planItem.stepsCount} steps
                  {planItem.upload?.url ? " · Attachment available" : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
