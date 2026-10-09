import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError } from "@/lib/services/relationship-service";
import { createEndorsement } from "@/lib/services/endorsement-service";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  subjectUserId: z.string().min(1),
  skillId: z.string().min(1),
  relationshipId: z.string().min(1),
  comment: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`endorse:${user.id}`, 30, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many endorsements, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const endorsement = await createEndorsement({ endorserUserId: user.id, ...parsed.data });
    return NextResponse.json({ endorsement }, { status: 201 });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    // Unique constraint (endorserUserId, subjectUserId, skillId) — already endorsed this skill for this person.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "You've already endorsed this skill for this person" }, { status: 409 });
    }
    throw err;
  }
}
