import { NextResponse } from "next/server";
import { requireUser, ForbiddenError, UnauthorizedError } from "@/lib/auth-helpers";
import { getBusinessAnalytics } from "@/lib/services/business-service";

/**
 * Owner-only aggregate analytics (view counts, inquiry rate per service). Never
 * returns per-viewer data — see business-service.ts#getBusinessAnalytics and the
 * flagged policy question in docs/decisions.md about re-identification risk.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireUser();
    const analytics = await getBusinessAnalytics(id, user.id);
    return NextResponse.json({ analytics });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
