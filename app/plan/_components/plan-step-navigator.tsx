"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type PlanStep = {
  id: number | null;
  title: string;
  description: string | null;
  notes: string | null;
  illustrationUrl?: string;
  checklistItems?: string[];
};

type PlanStepNavigatorProps = {
  steps: PlanStep[];
};

export function PlanStepNavigator({ steps }: PlanStepNavigatorProps) {
  const [index, setIndex] = useState(0);
  const totalSteps = steps.length;

  const safeIndex =
    totalSteps === 0 ? 0 : Math.min(Math.max(index, 0), totalSteps - 1);

  const currentStep = steps[safeIndex];

  if (!currentStep) {
    return (
      <div className="rounded-lg border bg-card px-6 py-10 text-center text-card-foreground shadow-sm">
        <h2 className="font-semibold text-xl">No steps available</h2>
        <p className="mt-2 text-muted-foreground text-sm">
          This plan does not contain any onboarding steps yet.
        </p>
      </div>
    );
  }

  const isFirstStep = safeIndex === 0;
  const isLastStep = safeIndex === totalSteps - 1;
  const displayStepNumber = safeIndex + 1;

  const handlePrev = () => {
    if (isFirstStep) {
      return;
    }
    setIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (isLastStep) {
      return;
    }
    setIndex((prev) => prev + 1);
  };

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-6 py-6">
      <div className="w-full rounded-lg border bg-card px-6 py-5 text-card-foreground shadow-sm">
        <p className="font-semibold text-primary text-sm uppercase tracking-wide">
          Step {displayStepNumber} of {totalSteps}
        </p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(displayStepNumber / totalSteps) * 100}%` }}
          />
        </div>
        <h2 className="mt-2 font-medium text-xl">{currentStep.title}</h2>
        {currentStep.checklistItems ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            {currentStep.checklistItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {currentStep.description ? (
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
            {currentStep.description}
          </p>
        ) : null}
        {!currentStep.checklistItems && currentStep.notes ? (
          <p className="mt-3 text-muted-foreground text-xs italic">
            Note: {currentStep.notes}
          </p>
        ) : null}
        {currentStep.illustrationUrl ? (
          <div className="mt-4 overflow-hidden rounded-md border bg-muted/10">
            <Image
              alt={`Illustration for ${currentStep.title}`}
              className="h-full max-h-80 w-full bg-white object-contain"
              height={384}
              src={currentStep.illustrationUrl}
              unoptimized
              width={512}
            />
          </div>
        ) : null}
        <div className="mt-6 flex w-full items-center justify-between gap-3">
          <Button
            disabled={isFirstStep}
            onClick={handlePrev}
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <Button disabled={isLastStep} onClick={handleNext} type="button">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
