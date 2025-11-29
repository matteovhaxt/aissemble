import { NextResponse } from "next/server";
import { deletePlan, listPlans } from "@/lib/db/queries";

export async function GET() {
  const items = await listPlans(50);

  return NextResponse.json({
    plans: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: number };
    const planId = body?.id;

    if (!Number.isInteger(planId)) {
      return NextResponse.json(
        { error: "A valid plan id is required." },
        { status: 400 }
      );
    }

    const numericPlanId = planId as number;

    const deleted = await deletePlan(numericPlanId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Plan could not be found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete plan. Please try again.",
      },
      { status: 500 }
    );
  }
}
