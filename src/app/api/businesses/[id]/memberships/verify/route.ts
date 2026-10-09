import { NextResponse } from "next/server";
import { requireUser, ForbiddenError, UnauthorizedError } from "@/lib/auth-helpers";
import { requestMembershipVerification } from "@/lib/services/business-service";

/**
 * The signed-in member requests verification of their own owner-confirmed membership.
 * Files a CredentialClaim reviewed through the existing admin claims pipeline — see
 * business-service.ts for the full explanation and the Track 2 integration-point note.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    const claim = await requestMembershipVerification(id, user.id);
    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
