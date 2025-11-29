import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { z } from "zod";

const assemblyStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  notes: z.string().optional(),
});

const assemblyPlanSchema = z.object({
  project: z.string().optional(),
  checklist: z.array(z.string()).default([]),
  steps: z.array(assemblyStepSchema).default([]),
});

type AssemblyPlan = z.infer<typeof assemblyPlanSchema>;
type IllustratedStep = AssemblyPlan["steps"][number] & {
  illustration?: string;
};

export type IllustratedAssemblyPlan = Omit<AssemblyPlan, "steps"> & {
  steps: IllustratedStep[];
};

type PlanContext = {
  attachmentDataUrl: string | null;
  attachmentMimeType?: string | null;
  requestSummary: string;
};

const IMAGE_DATA_URL_REGEX =
  /^data:(?<mimeType>image\/[a-z0-9.+-]+);base64,(?<data>[a-zA-Z0-9+/=]+)$/;

export async function generateAssemblyPlan(
  requestSummary: string,
  attachmentName?: string | null,
  attachmentDataUrl?: string | null
): Promise<AssemblyPlan> {
  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: string; mimeType?: string }
  > = [
    {
      type: "text",
      text: [
        "You are a hardware assembly planning assistant.",
        "Create a concise, actionable plan object.",
        "The object must include a `steps` array where each step has a unique `id`, a short `title` starting with a verb, and a `description` under two sentences.",
        "Include a `checklist` array listing any required tools or supplies (empty array when none).",
        "Add optional `notes` within steps only when additional context improves safety or clarity.",
        `Project description: ${requestSummary}`,
        attachmentName
          ? `Attachment provided: ${attachmentName}. Interpret it to inform checks and steps, but do not invent unseen details.`
          : "No attachment provided.",
      ].join("\n\n"),
    },
  ];

  if (attachmentDataUrl) {
    const match = IMAGE_DATA_URL_REGEX.exec(attachmentDataUrl);
    if (match?.groups?.data) {
      userContent.push({
        type: "image",
        image: match.groups.data,
      });
    }
  }

  const { object } = await generateObject({
    model: google("gemini-3-pro-preview"),
    schema: assemblyPlanSchema,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  return object;
}

export async function generateStepIllustration(
  step: AssemblyPlan["steps"][number],
  index: number,
  totalSteps: number,
  context: PlanContext
): Promise<string | undefined> {
  try {
    const imageMatch = context.attachmentDataUrl
      ? IMAGE_DATA_URL_REGEX.exec(context.attachmentDataUrl)
      : null;

    const imageResult = await generateText({
      model: google("gemini-3-pro-image-preview"),
      providerOptions: {
        google: {
          responseModalities: ["IMAGE"],
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Create a black-and-white IKEA manual illustration for the described assembly step.",
                "Use clean axonometric line art, no text or arrows.",
                `Overall project: ${context.requestSummary}`,
                `Current step (${index + 1}/${totalSteps}): ${step.title}`,
                `Step details: ${step.description}`,
                step.notes ? `Additional notes: ${step.notes}` : "",
                context.attachmentDataUrl
                  ? "Consult the provided reference image for overall context."
                  : "No reference image provided.",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
            ...(context.attachmentDataUrl
              ? ([
                  {
                    type: "image",
                    image: imageMatch?.groups?.data ?? "",
                  },
                ] as const)
              : []),
          ],
        },
      ],
    });

    const imageFile = imageResult.files?.find((file) =>
      file.mediaType.startsWith("image/")
    );

    if (imageFile?.base64) {
      return `data:${imageFile.mediaType};base64,${imageFile.base64}`;
    }
  } catch (error) {
    console.error("Failed to generate illustration", error);
  }

  return;
}
