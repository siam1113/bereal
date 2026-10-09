import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { assertValidUpload, UploadValidationError } from "@/lib/storage/types";

/**
 * Generic authenticated upload endpoint used by every vertical that needs images
 * (portfolio items, posts, business pages, service offerings). Proxies through the
 * server rather than issuing presigned client-direct-to-bucket URLs, trading a small
 * amount of server bandwidth for one upload code path that works identically against
 * both the local and s3 storage drivers.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    assertValidUpload(file.type, buffer.byteLength);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const ext = file.name.split(".").pop() || "bin";
  const key = `uploads/${user.id}/${nanoid()}.${ext}`;
  const stored = await storage.put(key, buffer, file.type);

  return NextResponse.json({ url: stored.url, key: stored.key });
}
