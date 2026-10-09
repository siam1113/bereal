import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { draftBioText } from "@/lib/services/ai-draft-service";

const schema = z.object({
  displayName: z.string().min(1).max(120),
  primarySkillName: z.string().max(120).nullable().optional(),
  secondarySkillNames: z.array(z.string()).max(20).optional(),
  rawNotes: z.string().max(2000).optional(),
  existingBio: z.string().max(2000).nullable().optional(),
});

/**
 * Returns a suggested bio — does NOT save it. The caller must copy the result into the
 * normal profile settings form and submit through PATCH /api/profiles/me like any
 * manually typed edit (docs/roadmap/08-ai-assistance.md "What to build" item 3).
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`ai-bio-draft:${user.id}`, 20, 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests, slow down" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const draft = await draftBioText(parsed.data);
  return NextResponse.json({ draft });
}
