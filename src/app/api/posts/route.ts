import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { createPost, getFeedForViewer } from "@/lib/services/post-service";
import { rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  content: z.string().min(1).max(5000),
  images: z.array(z.string().url()).max(10).optional(),
  linkedPortfolioItemId: z.string().optional(),
  visibility: z.enum(["PUBLIC", "CONNECTIONS", "PRIVATE"]).optional(),
});

export async function GET() {
  const user = await requireUser().catch(() => null);
  const posts = await getFeedForViewer(user?.id ?? null);
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`post:${user.id}`, 10, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many posts, slow down" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const post = await createPost({ authorUserId: user.id, ...parsed.data });
  return NextResponse.json({ post }, { status: 201 });
}
