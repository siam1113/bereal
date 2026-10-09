import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { ApiKeyError, revokeApiKey } from "@/lib/services/api-key-service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    await revokeApiKey(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiKeyError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
