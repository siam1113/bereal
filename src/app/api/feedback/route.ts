import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import { createProfessionalFeedback } from "@/lib/services/feedback-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  subjectUserId: z.string().min(1),
  relationshipId: z.string().min(1),
  attributes: z.object({
    communication: z.number().int().min(1).max(5),
    reliability: z.number().int().min(1).max(5),
    timeManagement: z.number().int().min(1).max(5),
  }),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`feedback:${user.id}`, 30, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many feedback submissions, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const feedback = await createProfessionalFeedback({ authorUserId: user.id, ...parsed.data });
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
