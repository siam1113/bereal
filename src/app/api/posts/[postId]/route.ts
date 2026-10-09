import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { deletePost } from "@/lib/services/post-service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const user = await requireUser();
  const { postId } = await params;
  await deletePost(postId, user.id);
  return NextResponse.json({ ok: true });
}
