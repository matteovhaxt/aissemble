import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type StorageConfig = {
  accessKey: string;
  bucket: string;
  endpoint: string;
  publicUrl: string;
  region: string;
  secretKey: string;
};

let cachedConfig: StorageConfig | null = null;
let cachedClient: S3Client | null = null;

function getConfig(): StorageConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.STORAGE_URL;
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (!bucket) {
    throw new Error("STORAGE_BUCKET must be set to upload files.");
  }

  if (!endpoint) {
    throw new Error("STORAGE_URL must be set to upload files.");
  }

  if (!(accessKey && secretKey)) {
    throw new Error(
      "STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be set to upload files."
    );
  }

  cachedConfig = {
    accessKey,
    bucket,
    endpoint,
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? endpoint,
    region: process.env.STORAGE_REGION ?? "us-east-1",
    secretKey,
  };

  return cachedConfig;
}

function getClient(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getConfig();

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  return cachedClient;
}

function buildPublicUrl(key: string) {
  const config = getConfig();
  const base = new URL(config.publicUrl);

  const sanitizedKey = key.startsWith("/") ? key.slice(1) : key;
  base.pathname = [config.bucket, sanitizedKey]
    .map((segment) => segment.split("/").map(encodeURIComponent).join("/"))
    .join("/")
    .replace(/\/{2,}/g, "/");

  return base.toString();
}

export async function uploadBufferToStorage({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType?: string;
}) {
  if (!key || key.trim().length === 0) {
    throw new Error("A non-empty storage key is required.");
  }

  const client = getClient();
  const config = getConfig();
  const normalizedKey = key.startsWith("/") ? key.slice(1) : key;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: normalizedKey,
      Body: body,
      ContentType: contentType,
    })
  );

  return {
    key: normalizedKey,
    url: buildPublicUrl(normalizedKey),
  };
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
) {
  if ("getReader" in stream) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function downloadObjectAsDataUrl({
  key,
  url,
}: {
  key?: string | null;
  url?: string | null;
}) {
  if (key) {
    const client = getClient();
    const config = getConfig();

    const object = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );

    const body = object.Body;

    if (!body) {
      throw new Error("Storage object is empty.");
    }

    const buffer = await streamToBuffer(body as NodeJS.ReadableStream);
    const contentType = object.ContentType ?? "application/octet-stream";
    const base64 = buffer.toString("base64");

    return `data:${contentType};base64,${base64}`;
  }

  if (!url) {
    throw new Error("Either key or url must be provided to download object.");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download object. Status: ${response.status} ${response.statusText}`
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");

  return `data:${contentType};base64,${base64}`;
}

const DATA_URL_REGEX =
  /^data:(?<mime>image\/[a-z0-9.+-]+);base64,(?<data>[a-zA-Z0-9+/=]+)$/i;

export function uploadDataUrlImage(
  dataUrl: string,
  prefix = "plan-illustrations"
) {
  const match = DATA_URL_REGEX.exec(dataUrl);

  if (!match?.groups?.data) {
    throw new Error("Invalid image data URL.");
  }

  const mimeType = match.groups.mime ?? "image/png";
  const extension = mimeType.split("/")[1] ?? "png";
  const key = `${prefix}/${randomUUID()}.${extension}`;

  const buffer = Buffer.from(match.groups.data, "base64");

  return uploadBufferToStorage({
    key,
    body: buffer,
    contentType: mimeType,
  });
}
