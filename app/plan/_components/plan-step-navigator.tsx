"use client";

import Image from "next/image";
import type { MutableRefObject, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { StepAnimationStatus } from "@/lib/assembly";

const STATUS_ENDPOINT = "/api/veo/status";
const REGENERATE_ENDPOINT = "/api/veo/regenerate";
const POLL_INTERVAL_MS = 5000;

type AnimationUpdate = {
  operationId: string;
  status: StepAnimationStatus;
  animationUrl: string | null;
  animationError: string | null;
};

export type PlanStep = {
  databaseId: number | null;
  id: number | null;
  title: string;
  description: string | null;
  notes: string | null;
  illustrationUrl?: string | null;
  animationStatus?: StepAnimationStatus | null;
  animationOperationId?: string | null;
  animationUrl?: string | null;
  animationError?: string | null;
  position?: number;
  checklistItems?: string[];
};

type PlanStepNavigatorProps = {
  steps: PlanStep[];
};

export function PlanStepNavigator({ steps }: PlanStepNavigatorProps) {
  const state = useNavigatorState(steps);
  const totalSteps = state.stepStates.length;
  const safeIndex =
    totalSteps === 0 ? 0 : Math.min(Math.max(state.index, 0), totalSteps - 1);
  const currentStep = state.stepStates[safeIndex];

  if (!currentStep) {
    return <NoStepsFallback />;
  }

  const view = buildViewState({
    step: currentStep,
    totalSteps,
    index: safeIndex,
    refreshingOperationId: state.refreshingOperationId,
    creatingStepId: state.creatingStepId,
  });

  return (
    <StepCard
      onCreateAnimation={state.handleCreateAnimation}
      onNext={() => state.goToIndex(Math.min(safeIndex + 1, totalSteps - 1))}
      onPrev={() => state.goToIndex(Math.max(safeIndex - 1, 0))}
      onRefresh={state.handleManualRefresh}
      state={view}
      videoRef={state.videoRef}
    />
  );
}

type NavigatorHookState = {
  stepStates: PlanStep[];
  index: number;
  refreshingOperationId: string | null;
  creatingStepId: number | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  goToIndex: (nextIndex: number) => void;
  handleManualRefresh: () => Promise<void>;
  handleCreateAnimation: () => Promise<void>;
};

function useNavigatorState(initialSteps: PlanStep[]): NavigatorHookState {
  const { stepStates, setStepStates, stepsRef } =
    useStepCollection(initialSteps);
  const [index, setIndex] = useState(0);
  const [refreshingOperationId, setRefreshingOperationId] = useState<
    string | null
  >(null);
  const [creatingStepId, setCreatingStepId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const totalSteps = stepStates.length;
  const safeIndex =
    totalSteps === 0 ? 0 : Math.min(Math.max(index, 0), totalSteps - 1);
  const currentStep = stepStates[safeIndex];
  const currentOperationId = currentStep?.animationOperationId ?? null;
  const currentDatabaseId = currentStep?.databaseId ?? null;
  const currentAnimationUrl = currentStep?.animationUrl ?? null;

  const hasPendingAnimations = useMemo(
    () => stepsHavePendingAnimation(stepStates),
    [stepStates]
  );

  useAnimationPolling(hasPendingAnimations, stepsRef, setStepStates);
  useAutoplay(currentAnimationUrl, videoRef);

  const handleManualRefresh = useCallback(async () => {
    if (!currentOperationId) {
      return;
    }

    setRefreshingOperationId(currentOperationId);

    try {
      const update = await requestAnimationUpdate(currentOperationId);
      setStepStates((prev) => mergeAnimationUpdates(prev, [update]));
    } finally {
      setRefreshingOperationId((prev) =>
        prev === currentOperationId ? null : prev
      );
    }
  }, [currentOperationId, setStepStates]);

  const handleCreateAnimation = useCallback(async () => {
    if (currentDatabaseId === null) {
      return;
    }

    setCreatingStepId(currentDatabaseId);

    try {
      const result = await requestAnimationRegeneration(currentDatabaseId);

      if (!(result.success && result.operationId)) {
        const message =
          result.error ?? "Failed to start a new animation request.";
        setStepStates((prev) =>
          markStepError(prev, currentDatabaseId, message)
        );
        return;
      }

      setStepStates((prev) =>
        markStepProcessing(prev, currentDatabaseId, result.operationId)
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start a new animation request.";
      setStepStates((prev) => markStepError(prev, currentDatabaseId, message));
    } finally {
      setCreatingStepId((prev) => (prev === currentDatabaseId ? null : prev));
    }
  }, [currentDatabaseId, setStepStates]);

  return {
    stepStates,
    index: safeIndex,
    refreshingOperationId,
    creatingStepId,
    videoRef,
    goToIndex: setIndex,
    handleManualRefresh,
    handleCreateAnimation,
  };
}

function useStepCollection(initialSteps: PlanStep[]) {
  const [stepStates, setStepStates] = useState(initialSteps);
  const stepsRef = useRef(stepStates);

  useEffect(() => {
    setStepStates(initialSteps);
  }, [initialSteps]);

  useEffect(() => {
    stepsRef.current = stepStates;
  }, [stepStates]);

  return { stepStates, setStepStates, stepsRef };
}

function useAnimationPolling(
  hasPendingAnimations: boolean,
  stepsRef: MutableRefObject<PlanStep[]>,
  setStepStates: React.Dispatch<React.SetStateAction<PlanStep[]>>
) {
  useEffect(() => {
    if (!hasPendingAnimations) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const operationIds = stepsRef.current
        .filter(
          (step) =>
            (step.animationStatus === "processing" ||
              step.animationStatus === "pending") &&
            step.animationOperationId
        )
        .map((step) => step.animationOperationId)
        .filter((id): id is string => typeof id === "string");

      if (operationIds.length === 0 || cancelled) {
        return;
      }

      const updates = await Promise.all(
        operationIds.map((operationId) => requestAnimationUpdate(operationId))
      );

      if (!cancelled) {
        setStepStates((prev) => mergeAnimationUpdates(prev, updates));
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasPendingAnimations, setStepStates, stepsRef]);
}

function useAutoplay(
  animationUrl: string | null,
  videoRef: RefObject<HTMLVideoElement | null>
) {
  useEffect(() => {
    if (!animationUrl) {
      return;
    }

    const node = videoRef.current;
    if (!node) {
      return;
    }

    node.muted = true;
    node.pause();
    node.load();

    (async () => {
      try {
        await node.play();
      } catch (error) {
        console.warn("Failed to autoplay animation", error);
      }
    })();
  }, [animationUrl, videoRef]);
}

function stepsHavePendingAnimation(steps: PlanStep[]) {
  return steps.some(
    (step) =>
      (step.animationStatus === "processing" ||
        step.animationStatus === "pending") &&
      Boolean(step.animationOperationId)
  );
}

type ViewState = {
  currentStep: PlanStep;
  displayStepNumber: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  currentOperationId: string | null;
  currentDatabaseId: number | null;
  refreshingOperationId: string | null;
  creatingStepId: number | null;
  canRefreshAnimation: boolean;
  canCreateAnimation: boolean;
};

function buildViewState({
  step,
  totalSteps,
  index,
  refreshingOperationId,
  creatingStepId,
}: {
  step: PlanStep;
  totalSteps: number;
  index: number;
  refreshingOperationId: string | null;
  creatingStepId: number | null;
}): ViewState {
  const displayStepNumber = index + 1;
  const currentOperationId = step.animationOperationId ?? null;
  const currentDatabaseId = step.databaseId ?? null;

  return {
    currentStep: step,
    displayStepNumber,
    totalSteps,
    isFirstStep: index === 0,
    isLastStep: index === totalSteps - 1,
    currentOperationId,
    currentDatabaseId,
    refreshingOperationId,
    creatingStepId,
    canRefreshAnimation: Boolean(currentOperationId),
    canCreateAnimation: currentDatabaseId !== null,
  };
}

function NoStepsFallback() {
  return (
    <div className="rounded-lg border bg-card px-6 py-10 text-center text-card-foreground shadow-sm">
      <h2 className="font-semibold text-xl">No steps available</h2>
      <p className="mt-2 text-muted-foreground text-sm">
        This plan does not contain any onboarding steps yet.
      </p>
    </div>
  );
}

type StepCardProps = {
  state: ViewState;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onRefresh: () => Promise<void>;
  onCreateAnimation: () => Promise<void>;
};

function StepCard({
  state,
  videoRef,
  onPrev,
  onNext,
  onRefresh,
  onCreateAnimation,
}: StepCardProps) {
  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-6 py-6">
      <div className="w-full rounded-lg border bg-card px-6 py-5 text-card-foreground shadow-sm">
        <StepHeader
          displayStepNumber={state.displayStepNumber}
          title={state.currentStep.title}
          totalSteps={state.totalSteps}
        />
        <StepDetails step={state.currentStep} />
        <StepMedia step={state.currentStep} videoRef={videoRef} />
        <StepStatusMessage
          error={state.currentStep.animationError}
          status={state.currentStep.animationStatus ?? null}
        />
        {state.currentDatabaseId !== null ? (
          <StepActionBar
            onCreateAnimation={onCreateAnimation}
            onRefresh={onRefresh}
            state={state}
          />
        ) : null}
        <StepNavigationButtons
          isFirstStep={state.isFirstStep}
          isLastStep={state.isLastStep}
          onNext={onNext}
          onPrev={onPrev}
        />
      </div>
    </div>
  );
}

function StepHeader({
  displayStepNumber,
  totalSteps,
  title,
}: {
  displayStepNumber: number;
  totalSteps: number;
  title: string;
}) {
  return (
    <>
      <p className="font-semibold text-primary text-sm uppercase tracking-wide">
        Step {displayStepNumber} of {totalSteps}
      </p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(displayStepNumber / totalSteps) * 100}%` }}
        />
      </div>
      <h2 className="mt-2 font-medium text-xl">{title}</h2>
    </>
  );
}

function StepDetails({ step }: { step: PlanStep }) {
  return (
    <>
      {step.checklistItems ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
          {step.checklistItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {step.description ? (
        <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
          {step.description}
        </p>
      ) : null}
      {!step.checklistItems && step.notes ? (
        <p className="mt-3 text-muted-foreground text-xs italic">
          Note: {step.notes}
        </p>
      ) : null}
    </>
  );
}

function StepMedia({
  step,
  videoRef,
}: {
  step: PlanStep;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const hasAnimation = Boolean(step.animationUrl);
  const hasIllustration = Boolean(step.illustrationUrl);

  if (hasAnimation) {
    return (
      <div className="mt-4 overflow-hidden rounded-md border bg-muted/10">
        <video
          aria-label={`Animation for ${step.title}`}
          className="h-full max-h-80 w-full bg-black object-contain"
          controls
          loop
          muted
          playsInline
          poster={hasIllustration ? (step.illustrationUrl ?? "") : ""}
          preload="metadata"
          ref={videoRef}
          src={step.animationUrl ?? undefined}
        />
      </div>
    );
  }

  if (hasIllustration) {
    return (
      <div className="mt-4 overflow-hidden rounded-md border bg-muted/10">
        <Image
          alt={`Illustration for ${step.title}`}
          className="h-full max-h-80 w-full bg-white object-contain"
          height={384}
          src={step.illustrationUrl ?? ""}
          unoptimized
          width={512}
        />
      </div>
    );
  }

  return null;
}

function StepStatusMessage({
  status,
  error,
}: {
  status: StepAnimationStatus | null;
  error: string | null | undefined;
}) {
  if (status === "processing") {
    return (
      <p className="mt-3 text-muted-foreground text-xs">
        Animation is rendering—check back in a few moments.
      </p>
    );
  }

  if (status === "failed" && error) {
    return <p className="mt-3 text-destructive text-xs">{error}</p>;
  }

  return null;
}

function StepActionBar({
  state,
  onRefresh,
  onCreateAnimation,
}: {
  state: ViewState;
  onRefresh: () => Promise<void>;
  onCreateAnimation: () => Promise<void>;
}) {
  const isRefreshing =
    state.refreshingOperationId !== null &&
    state.refreshingOperationId === state.currentOperationId;
  const isCreating =
    state.creatingStepId !== null &&
    state.creatingStepId === state.currentDatabaseId;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-muted-foreground/40 border-dashed bg-muted/10 px-3 py-2">
      <p className="font-mono text-[0.7rem] text-muted-foreground">
        {state.currentOperationId ?? "No active operation"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!state.canRefreshAnimation || isRefreshing}
          onClick={onRefresh}
          size="sm"
          type="button"
          variant="ghost"
        >
          {isRefreshing ? "Refreshing..." : "Refresh status"}
        </Button>
        <Button
          disabled={!state.canCreateAnimation || isCreating}
          onClick={onCreateAnimation}
          size="sm"
          type="button"
          variant="outline"
        >
          {isCreating ? "Starting..." : "Start new animation"}
        </Button>
      </div>
    </div>
  );
}

function StepNavigationButtons({
  isFirstStep,
  isLastStep,
  onPrev,
  onNext,
}: {
  isFirstStep: boolean;
  isLastStep: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-6 flex w-full items-center justify-between gap-3">
      <Button
        disabled={isFirstStep}
        onClick={onPrev}
        type="button"
        variant="outline"
      >
        Previous
      </Button>
      <Button disabled={isLastStep} onClick={onNext} type="button">
        Next
      </Button>
    </div>
  );
}

async function requestAnimationUpdate(
  operationId: string
): Promise<AnimationUpdate> {
  try {
    const response = await fetch(STATUS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operationId }),
    });

    let data: {
      status?: StepAnimationStatus;
      animationUrl?: unknown;
      animationError?: unknown;
      error?: unknown;
    } = {};

    try {
      data = (await response.json()) as typeof data;
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return {
      operationId,
      status: (data.status as StepAnimationStatus | undefined) ?? "processing",
      animationUrl:
        typeof data.animationUrl === "string" ? data.animationUrl : null,
      animationError:
        typeof data.animationError === "string" ? data.animationError : null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Animation update failed.";
    return {
      operationId,
      status: "failed",
      animationUrl: null,
      animationError: message,
    };
  }
}

function mergeAnimationUpdates(
  steps: PlanStep[],
  updates: AnimationUpdate[]
): PlanStep[] {
  if (updates.length === 0) {
    return steps;
  }

  return steps.map((step) => {
    if (!step.animationOperationId) {
      return step;
    }

    const update = updates.find(
      (item) => item.operationId === step.animationOperationId
    );

    if (!update) {
      return step;
    }

    const nextStatus =
      update.status === "pending" ? ("processing" as const) : update.status;
    const nextStep: PlanStep = {
      ...step,
      animationStatus: nextStatus,
    };

    if (nextStatus === "succeeded") {
      nextStep.animationUrl = update.animationUrl ?? step.animationUrl ?? null;
      nextStep.animationError = null;
    } else if (nextStatus === "failed") {
      nextStep.animationUrl = null;
      nextStep.animationError = update.animationError ?? "Animation failed.";
    } else {
      nextStep.animationUrl = step.animationUrl ?? null;
      nextStep.animationError = null;
    }

    return nextStep;
  });
}

function markStepProcessing(
  steps: PlanStep[],
  databaseId: number,
  operationId: string
): PlanStep[] {
  return steps.map((step) =>
    step.databaseId === databaseId
      ? {
          ...step,
          animationStatus: "processing",
          animationOperationId: operationId,
          animationUrl: null,
          animationError: null,
        }
      : step
  );
}

function markStepError(
  steps: PlanStep[],
  databaseId: number,
  message: string
): PlanStep[] {
  return steps.map((step) =>
    step.databaseId === databaseId
      ? {
          ...step,
          animationStatus: "failed",
          animationError: message,
          animationUrl: null,
        }
      : step
  );
}

async function requestAnimationRegeneration(stepId: number) {
  const response = await fetch(REGENERATE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stepId }),
  });

  let data: { operationId?: unknown; error?: unknown } = {};

  try {
    data = (await response.json()) as typeof data;
  } catch {
    data = {};
  }

  if (!response.ok || typeof data.operationId !== "string") {
    let message = "Veo did not return a valid operation id.";

    if (!response.ok) {
      message = `Request failed with status ${response.status}`;
    }

    if (typeof data.error === "string") {
      message = data.error;
    }

    return {
      success: false,
      error: message,
    };
  }

  return {
    success: true,
    operationId: data.operationId,
  };
}
