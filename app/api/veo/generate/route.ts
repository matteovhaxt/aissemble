import { NextResponse } from "next/server";
import { z } from "zod";
import { startVeoAnimation } from "@/lib/veo";

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty."),
  image: z.string().optional(),
  config: z
    .object({
      numberOfVideos: z.number().int().min(1).max(4).optional(),
      durationSeconds: z.number().int().min(1).max(8).optional(),
      aspectRatio: z.enum(["16:9", "9:16"]).optional(),
      resolution: z.enum(["720p", "1080p"]).optional(),
      personGeneration: z.enum(["dont_allow", "allow_adult"]).optional(),
      negativePrompt: z.string().optional(),
      enhancePrompt: z.boolean().optional(),
      generateAudio: z.boolean().optional(),
    })
    .strict()
    .optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());

    const { operationId } = await startVeoAnimation({
      prompt: payload.prompt,
      imageDataUrl: payload.image ?? null,
      config: payload.config,
    });

    return NextResponse.json({ operationId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request payload." },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to start Veo video generation.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
