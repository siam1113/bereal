import { NextResponse } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth-helpers";
import { ApiKeyError } from "@/lib/services/api-key-service";
import { RelationshipAuthError, RelationshipStateError } from "@/lib/services/relationship-service";

export const API_VERSION = "v1";

/**
 * Maps known error types thrown by the service layer (and by `requireApiUser`) to HTTP
 * status codes, so `/api/v1/*` clients get correct semantics (401 vs 403 vs 400) instead
 * of a blanket 500 — the legacy (non-versioned) routes handle this ad hoc per-route; this
 * is the equivalent for the new surface, consolidated so every v1 route behaves the same
 * way for the same error types. Route-specific errors not listed here should still be
 * caught locally by the route before this is reached.
 */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError || err instanceof RelationshipAuthError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ApiKeyError || err instanceof RelationshipStateError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[api/v1] unhandled error", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function apiJson<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
