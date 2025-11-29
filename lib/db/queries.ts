import { desc, eq, sql } from "drizzle-orm";
import type { IllustratedAssemblyPlan } from "@/lib/assembly";
import { db } from "@/lib/db";
import { type Plan, plans, steps, type Upload, uploads } from "@/lib/db/schema";

type UploadInput = {
  key: string;
  url: string;
  mimeType?: string | null;
  name?: string | null;
};

export async function createUploadRecord({
  key,
  url,
  mimeType,
  name,
}: UploadInput): Promise<Upload> {
  const [upload] = await db
    .insert(uploads)
    .values({
      key,
      url,
      mimeType: mimeType ?? null,
      name: name ?? null,
    })
    .onConflictDoUpdate({
      target: uploads.key,
      set: {
        url,
        mimeType: mimeType ?? null,
        name: name ?? null,
      },
    })
    .returning();

  return upload;
}

export async function getUploadById(id: number): Promise<Upload | undefined> {
  const [upload] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.id, id))
    .limit(1);

  return upload;
}

export async function getUploadByKey(key: string): Promise<Upload | undefined> {
  const [upload] = await db
    .select()
    .from(uploads)
    .where(eq(uploads.key, key))
    .limit(1);

  return upload;
}

type PlanAttachmentReference = {
  uploadId?: number | null;
};

export type PlanStepInsert = {
  id?: string;
  title: string;
  description: string;
  notes?: string | null;
  illustrationKey?: string | null;
  illustrationUrl?: string | null;
};

export async function createPlanRecord({
  requestSummary,
  plan,
  attachment,
  steps: stepInputs,
}: {
  requestSummary: string;
  plan: IllustratedAssemblyPlan;
  attachment?: PlanAttachmentReference;
  steps: PlanStepInsert[];
}): Promise<Plan> {
  return await db.transaction(async (tx) => {
    const [planRow] = await tx
      .insert(plans)
      .values({
        requestSummary,
        project: plan.project ?? null,
        checklist: plan.checklist ?? [],
        uploadId: attachment?.uploadId ?? null,
      })
      .returning();

    if (!planRow) {
      throw new Error("Failed to persist assembly plan record.");
    }

    if (stepInputs.length > 0) {
      await tx.insert(steps).values(
        stepInputs.map((step, index) => ({
          planId: planRow.id,
          stepIdentifier: step.id ?? null,
          position: index,
          title: step.title,
          description: step.description,
          notes: step.notes ?? null,
          illustrationKey: step.illustrationKey ?? null,
          illustrationUrl: step.illustrationUrl ?? null,
        }))
      );
    }

    return planRow;
  });
}

export async function listPlans(limit = 20): Promise<
  Array<{
    id: number;
    requestSummary: string;
    project: string | null;
    createdAt: Date;
    stepsCount: number;
    upload?: {
      id: number;
      name: string | null;
      url: string | null;
      mimeType: string | null;
    } | null;
  }>
> {
  const rows = await db
    .select({
      id: plans.id,
      requestSummary: plans.requestSummary,
      project: plans.project,
      createdAt: plans.createdAt,
      stepsCount: sql<number>`count(${steps.id})`,
      uploadId: uploads.id,
      uploadName: uploads.name,
      uploadUrl: uploads.url,
      uploadMimeType: uploads.mimeType,
    })
    .from(plans)
    .leftJoin(uploads, eq(plans.uploadId, uploads.id))
    .leftJoin(steps, eq(steps.planId, plans.id))
    .groupBy(
      plans.id,
      plans.requestSummary,
      plans.project,
      plans.createdAt,
      uploads.id,
      uploads.name,
      uploads.url,
      uploads.mimeType
    )
    .orderBy(desc(plans.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    requestSummary: row.requestSummary,
    project: row.project,
    createdAt: row.createdAt,
    stepsCount: Number(row.stepsCount ?? 0),
    upload: row.uploadId
      ? {
          id: row.uploadId,
          name: row.uploadName ?? null,
          url: row.uploadUrl ?? null,
          mimeType: row.uploadMimeType ?? null,
        }
      : null,
  }));
}

export async function getPlanWithSteps(id: number) {
  const planRows = await db
    .select({
      id: plans.id,
      requestSummary: plans.requestSummary,
      project: plans.project,
      checklist: plans.checklist,
      createdAt: plans.createdAt,
      uploadId: uploads.id,
      uploadName: uploads.name,
      uploadUrl: uploads.url,
      uploadMimeType: uploads.mimeType,
    })
    .from(plans)
    .leftJoin(uploads, eq(plans.uploadId, uploads.id))
    .where(eq(plans.id, id))
    .limit(1);

  const planRow = planRows[0];

  if (!planRow) {
    return;
  }

  const stepRows = await db
    .select({
      id: steps.id,
      stepIdentifier: steps.stepIdentifier,
      title: steps.title,
      description: steps.description,
      notes: steps.notes,
      illustrationUrl: steps.illustrationUrl,
      illustrationKey: steps.illustrationKey,
      position: steps.position,
    })
    .from(steps)
    .where(eq(steps.planId, id))
    .orderBy(steps.position);

  return {
    plan: {
      id: planRow.id,
      requestSummary: planRow.requestSummary,
      project: planRow.project,
      checklist: planRow.checklist,
      createdAt: planRow.createdAt,
      upload: planRow.uploadId
        ? {
            id: planRow.uploadId,
            name: planRow.uploadName ?? null,
            url: planRow.uploadUrl ?? null,
            mimeType: planRow.uploadMimeType ?? null,
          }
        : null,
    },
    steps: stepRows.map((row) => ({
      id: row.stepIdentifier ?? String(row.id),
      title: row.title,
      description: row.description,
      notes: row.notes ?? null,
      illustrationUrl: row.illustrationUrl ?? null,
      illustrationKey: row.illustrationKey ?? null,
      position: row.position,
    })),
  };
}
