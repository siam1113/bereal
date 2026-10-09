import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { addComment } from "@/lib/services/post-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ content: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const user = await requireUser();
  if (!rateLimit(`comment:${user.id}`, 30, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many comments, slow down" }, { status: 429 });
  }

  const { postId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const comment = await addComment({ postId, authorUserId: user.id, content: parsed.data.content });
  return NextResponse.json({ comment }, { status: 201 });
}
