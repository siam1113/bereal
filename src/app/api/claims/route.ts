import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { listMyClaims, submitClaim } from "@/lib/services/claim-service";

const CLAIM_TYPES = ["IDENTITY", "EXPERIENCE", "CREDENTIAL", "PROJECT_WORK", "COMPETENCY"] as const;

const schema = z.object({
  claimType: z.enum(CLAIM_TYPES),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
  relatedExperienceId: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();
  const claims = await listMyClaims(user.id);
  return NextResponse.json({ claims });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const claim = await submitClaim({ subjectUserId: user.id, ...parsed.data });
  return NextResponse.json({ claim }, { status: 201 });
}
