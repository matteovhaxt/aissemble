import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";

type AssemblyPlanRequest = {
  attachmentDataUrl?: string | null;
  attachmentName?: string;
  request: string;
};

const IMAGE_DATA_URL_REGEX =
  /^data:(?<mimeType>image\/[a-z0-9.+-]+);base64,(?<data>[a-zA-Z0-9+/=]+)$/;

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AssemblyPlanRequest>;

  if (typeof body.request !== "string" || body.request.trim().length === 0) {
    return NextResponse.json(
      { error: "Provide a description of what you would like to assemble." },
      { status: 400 }
    );
  }

  const requestSummary = body.request.trim();
  const attachmentMatch = body.attachmentDataUrl
    ? IMAGE_DATA_URL_REGEX.exec(body.attachmentDataUrl)
    : null;

  if (body.attachmentDataUrl && !attachmentMatch) {
    return NextResponse.json(
      { error: "Attachment must be an image encoded as a data URL." },
      { status: 400 }
    );
  }

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string; mimeType?: string }
  > = [
    {
      type: "text",
      text: [
        "You are a hardware assembly planning assistant.",
        "Create a concise, actionable step-by-step plan that helps a user assemble the described item.",
        "Include a brief supplies checklist when relevant.",
        "Each step should start with a verb and remain under two sentences.",
        `Project description: ${requestSummary}`,
        body.attachmentName
          ? `Attachment provided: ${body.attachmentName}. Interpret it to inform checks and steps, but do not invent unseen details.`
          : "No attachment provided.",
      ].join("\n\n"),
    },
  ];

  if (attachmentMatch?.groups?.data) {
    userContent.push({
      type: "image",
      image: attachmentMatch.groups.data,
      mimeType: attachmentMatch.groups.mimeType,
    });
  }

  const { text } = await generateText({
    model: google("gemini-3-pro-preview"),
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  return NextResponse.json({
    plan: text.trim(),
  });
}
