import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { draftPortfolioDescription } from "@/lib/services/ai-draft-service";

const schema = z.object({
  title: z.string().min(1).max(140),
  tags: z.array(z.string()).max(20).optional(),
  rawNotes: z.string().max(2000).optional(),
  existingDescription: z.string().max(4000).optional(),
});

/**
 * Returns a suggested portfolio-item description — does NOT save it. The caller must
 * copy the result into the normal portfolio edit form and submit through
 * /api/portfolio[/:id] like any manually typed edit (docs/roadmap/08-ai-assistance.md
 * "What to build" item 3: "opt-in, user reviews and approves before saving").
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`ai-portfolio-draft:${user.id}`, 20, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const draft = await draftPortfolioDescription(parsed.data);
  return NextResponse.json({ draft });
}
