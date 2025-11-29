import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createUploadRecord } from "@/lib/db/queries";
import { uploadBufferToStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Provide a file to upload." },
      { status: 400 }
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are supported." },
      { status: 415 }
    );
  }

  const key = `attachments/${randomUUID()}-${file.name.replace(/\s+/g, "_")}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const object = await uploadBufferToStorage({
      key,
      body: buffer,
      contentType: file.type,
    });

    const uploadRecord = await createUploadRecord({
      key: object.key,
      url: object.url,
      mimeType: file.type,
      name: file.name,
    });

    return NextResponse.json({
      id: uploadRecord.id,
      url: object.url,
      key: object.key,
      contentType: file.type,
    });
  } catch (error) {
    console.error("Upload failed", error);
    return NextResponse.json(
      { error: "Failed to upload the file. Please try again." },
      { status: 500 }
    );
  }
}
