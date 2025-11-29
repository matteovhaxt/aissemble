"use client";

import { Paperclip, Send } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export default function AssemblyInputPage() {
  const [request, setRequest] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    null
  );
  const [plan, setPlan] = useState("");
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
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = request.trim();

      if (trimmed.length === 0 || isLoading) {
        return;
      }

      setIsLoading(true);
      setError("");
      setPlan("");

      try {
        const response = await fetch("/api/chat", {
          body: JSON.stringify({
            attachmentDataUrl: attachmentPreview,
            attachmentName: attachment?.name,
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

        const data = (await response.json()) as { plan: string };
        setPlan(data.plan);
        setRequest("");
        setAttachment(null);
        setAttachmentPreview(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [attachment, attachmentPreview, isLoading, request]
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
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
            disabled={request.trim().length === 0 || isLoading}
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
      {plan ? (
        <div className="mt-8 w-full max-w-2xl rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-4 font-semibold text-lg">Assembly plan</h2>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {plan}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
