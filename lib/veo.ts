import { Buffer } from "node:buffer";
import {
  type GeneratedVideo,
  type GenerateVideosConfig,
  GenerateVideosOperation,
  type GenerateVideosParameters,
  type GenerateVideosResponse,
  GoogleGenAI,
} from "@google/genai";

type SanitizedGenerateVideosConfig = Pick<
  GenerateVideosConfig,
  | "numberOfVideos"
  | "durationSeconds"
  | "aspectRatio"
  | "resolution"
  | "personGeneration"
  | "negativePrompt"
  | "enhancePrompt"
  | "generateAudio"
>;

type VeoSourceInput = {
  prompt: string;
  imageDataUrl?: string | null;
  config?: Partial<SanitizedGenerateVideosConfig>;
};

export type VeoOperationStatus =
  | {
      status: "pending";
      operationId: string;
    }
  | {
      status: "processing";
      operationId: string;
    }
  | {
      status: "succeeded";
      operationId: string;
      videos: Array<{
        mimeType: string;
        videoBytes?: string;
        uri?: string;
      }>;
    }
  | {
      status: "failed";
      operationId: string;
      error: string;
    };

let cachedClient: GoogleGenAI | null = null;

const DATA_URL_REGEX =
  /^data:(?<mime>[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+);base64,(?<data>[a-zA-Z0-9+/=]+)$/i;

const DEFAULT_VIDEO_CONFIG: SanitizedGenerateVideosConfig = {
  numberOfVideos: 1,
  durationSeconds: 6,
  aspectRatio: "16:9",
  resolution: "720p",
};

function getGoogleApiKey(): string {
  const apiKey =
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Set GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to use Veo video generation."
    );
  }

  return apiKey;
}

function getVeoModelId(): string {
  return process.env.GOOGLE_VEO_MODEL ?? "veo-3.1-generate-preview";
}

function getClient(): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new GoogleGenAI({
    apiKey: getGoogleApiKey(),
  });

  return cachedClient;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = DATA_URL_REGEX.exec(dataUrl.trim());

  if (!(match?.groups?.data && match.groups.mime)) {
    throw new Error("Provided image must be a base64-encoded data URL.");
  }

  return {
    mimeType: match.groups.mime,
    base64: match.groups.data,
  };
}

function sanitizeConfig(
  config: VeoSourceInput["config"]
): SanitizedGenerateVideosConfig | undefined {
  if (!config) {
    return;
  }

  const entries = Object.entries(config).filter(
    ([key, value]) =>
      value !== undefined &&
      [
        "numberOfVideos",
        "durationSeconds",
        "aspectRatio",
        "resolution",
        "personGeneration",
        "negativePrompt",
        "enhancePrompt",
        "generateAudio",
      ].includes(key)
  ) as [keyof SanitizedGenerateVideosConfig, never][];

  if (entries.length === 0) {
    return;
  }

  return Object.fromEntries(entries);
}

export async function startVeoAnimation({
  prompt,
  imageDataUrl,
  config,
}: VeoSourceInput): Promise<{ operationId: string }> {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error("A non-empty prompt is required to generate a video.");
  }

  const client = getClient();
  const sanitizedConfig = sanitizeConfig(config);

  const request: GenerateVideosParameters = {
    model: getVeoModelId(),
    prompt: trimmedPrompt,
    config: {
      ...DEFAULT_VIDEO_CONFIG,
      ...sanitizedConfig,
    },
  };

  if (imageDataUrl) {
    const { mimeType, base64 } = parseDataUrl(imageDataUrl);
    request.image = {
      imageBytes: base64,
      mimeType,
    };
  }

  const operation = await client.models.generateVideos(request);

  if (!operation.name) {
    throw new Error("Veo did not return an operation identifier.");
  }

  return {
    operationId: operation.name,
  };
}

export async function getVeoOperation(
  operationId: string
): Promise<GenerateVideosOperation> {
  const trimmed = operationId.trim();

  if (!trimmed) {
    throw new Error("A valid operation id is required.");
  }

  const client = getClient();
  const operation = new GenerateVideosOperation();
  operation.name = trimmed;

  return await client.operations.getVideosOperation({
    operation,
  });
}

export function resolveVeoOperationStatus(
  operation: GenerateVideosOperation
): VeoOperationStatus {
  if (!operation.done) {
    return {
      status: operation.metadata ? "processing" : "pending",
      operationId: operation.name ?? "",
    };
  }

  if (operation.error) {
    const error =
      typeof operation.error === "object" && operation.error !== null
        ? (operation.error as { message?: unknown }).message
        : undefined;

    return {
      status: "failed",
      operationId: operation.name ?? "",
      error:
        typeof error === "string" && error.trim().length > 0
          ? error.trim()
          : "Veo video generation failed.",
    };
  }

  const videos = extractVideos(operation.response);

  if (videos.length === 0) {
    return {
      status: "failed",
      operationId: operation.name ?? "",
      error: "Veo completed without returning any video output.",
    };
  }

  return {
    status: "succeeded",
    operationId: operation.name ?? "",
    videos,
  };
}

function extractVideos(response: GenerateVideosResponse | undefined): Array<{
  mimeType: string;
  videoBytes?: string;
  uri?: string;
}> {
  if (!response?.generatedVideos) {
    return [];
  }

  return response.generatedVideos
    .map((item: GeneratedVideo) => item.video)
    .filter((video): video is NonNullable<GeneratedVideo["video"]> =>
      Boolean(video)
    )
    .map((video) => ({
      mimeType: video.mimeType ?? "video/mp4",
      videoBytes: video.videoBytes,
      uri: video.uri,
    }))
    .filter((video) => Boolean(video.videoBytes) || Boolean(video.uri));
}

export async function downloadVeoVideo({
  videoBytes,
  uri,
  mimeType,
}: {
  videoBytes?: string;
  uri?: string;
  mimeType?: string;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  if (videoBytes) {
    return {
      buffer: Buffer.from(videoBytes, "base64"),
      mimeType: mimeType ?? "video/mp4",
    };
  }

  if (!uri) {
    throw new Error("No video data available to download.");
  }

  const apiKey = getGoogleApiKey();
  const separator = uri.includes("?") ? "&" : "?";
  const url = `${uri}${separator}key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download Veo video (status ${response.status}).`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") ?? "video/mp4",
  };
}
