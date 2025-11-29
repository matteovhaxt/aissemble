import { NextResponse } from "next/server";
import { listPlans } from "@/lib/db/queries";

export async function GET() {
  const items = await listPlans(50);

  return NextResponse.json({
    plans: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
