import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getPlanWithSteps } from "@/lib/db/queries";
import { downloadObjectAsDataUrl } from "@/lib/storage";

type PlanPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const params = await searchParams;
  const idParam = params?.id;
  const planId = idParam ? Number(idParam) : Number.NaN;

  if (!Number.isInteger(planId)) {
    notFound();
  }

  const data = await getPlanWithSteps(planId);

  if (!data) {
    notFound();
  }

  const stepsWithIllustrations = await Promise.all(
    data.steps.map(async (step) => {
      if (!step.illustrationKey) {
        return step;
      }

      try {
        const fetchedUrl = await downloadObjectAsDataUrl({
          key: step.illustrationKey,
        });
        return {
          ...step,
          illustrationUrl: fetchedUrl,
        };
      } catch (error) {
        console.error(
          `Failed to load illustration for step ${step.id ?? "unknown"}`,
          error
        );
        return step;
      }
    })
  );

  const createdLabel = formatDistanceToNow(data.plan.createdAt, {
    addSuffix: true,
  });
  const checklist = data.plan.checklist ?? [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl">
            {data.plan.project ?? "Assembly plan"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Requested {createdLabel}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back to builder</Link>
        </Button>
      </div>

      {checklist.length > 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3">
          <h2 className="font-medium text-sm uppercase tracking-wide">
            Supplies & tools
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="space-y-4">
        {stepsWithIllustrations.map((step, index) => (
          <li
            className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-sm"
            key={step.id ?? `${data.plan.id}-${index}`}
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
            {step.illustrationUrl ? (
              <div className="mt-3 overflow-hidden rounded-md border bg-muted/10">
                <Image
                  alt={`Illustration for ${step.title}`}
                  className="h-full max-h-80 w-full bg-white object-contain"
                  height={384}
                  src={step.illustrationUrl}
                  unoptimized
                  width={512}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
