import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { RelationshipAuthError, RelationshipStateError } from "@/lib/services/relationship-service";
import { createReference, listReferencesAuthored, listReferencesReceived } from "@/lib/services/reference-service";
import { rateLimit } from "@/lib/rate-limit";

// Same scoped-attribute shape as ProfessionalFeedback.attributes (see feedback-service.ts)
// — structured, not freeform-only, per the track doc's "structured content" requirement.
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

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const as = url.searchParams.get("as") === "author" ? "author" : "subject";
  const references = as === "author" ? await listReferencesAuthored(user.id) : await listReferencesReceived(user.id);
  return NextResponse.json({ references });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!rateLimit(`reference:${user.id}`, 20, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many references submitted, try again later" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const reference = await createReference({ authorUserId: user.id, ...parsed.data });
    return NextResponse.json({ reference }, { status: 201 });
  } catch (err) {
    if (err instanceof RelationshipAuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof RelationshipStateError) return NextResponse.json({ error: err.message }, { status: 400 });
    // Unique constraint (authorUserId, subjectUserId, relationshipId) — already wrote one for this relationship.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "You've already written a reference for this person on this relationship" },
        { status: 409 },
      );
    }
    throw err;
  }
}
