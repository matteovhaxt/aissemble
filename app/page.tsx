"use client";

import { Paperclip, Send } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { IllustratedAssemblyPlan } from "@/lib/assembly";

export default function AssemblyInputPage() {
  const [request, setRequest] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null
  );
  const [plan, setPlan] = useState<IllustratedAssemblyPlan | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? [];
    event.target.value = "";

    if (!file) {
      setAttachment(null);
      setAttachmentPreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      setAttachment(null);
      setAttachmentPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setAttachment(file);
        setAttachmentPreview(result);
        setError("");
      } else {
        setError("Could not read the selected file.");
        setAttachment(null);
        setAttachmentPreview(null);
      }
    };
    reader.onerror = () => {
      setError("Could not read the selected file.");
      setAttachment(null);
      setAttachmentPreview(null);
    };
    reader.readAsDataURL(file);
  };

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
        const response = await fetch("/api/chat", {
          body: JSON.stringify({
            attachmentDataUrl: attachmentPreview,
            attachmentMimeType: attachment?.type,
            attachmentName: attachment?.name ?? null,
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
        };
        setPlan(data.plan);
        setAttachment(null);
        setAttachmentPreview(null);
        setRequest("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [attachment, attachmentPreview, request]
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      {plan ? (
        <AssemblyFlow
          onReset={() => {
            setPlan(null);
            setAttachment(null);
            setAttachmentPreview(null);
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
