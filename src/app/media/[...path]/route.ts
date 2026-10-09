import { NextRequest, NextResponse } from "next/server";
import { readLocalObject } from "@/lib/storage/local";

const EXT_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const key = segments.join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXT_CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 404 });
  }

  try {
    const buffer = await readLocalObject(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
