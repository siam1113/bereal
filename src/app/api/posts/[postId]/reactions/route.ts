import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { toggleReaction } from "@/lib/services/post-service";

const schema = z.object({ type: z.enum(["LIKE", "APPLAUD", "INSIGHTFUL"]).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const user = await requireUser();
  const { postId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await toggleReaction({ postId, userId: user.id, type: parsed.data.type });
  return NextResponse.json(result);
}
