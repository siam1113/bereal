import { prisma } from "@/lib/prisma";
import { getCurrentUser, UnauthorizedError, ForbiddenError } from "@/lib/auth-helpers";
import { verifyApiKey, hasScope, type ApiScope } from "@/lib/services/api-key-service";

/**
 * Identity resolution for the versioned (`/api/v1/*`) API surface — see
 * docs/platform-api.md for the full auth-model writeup.
 *
 * Deliberately **not** folded into `requireUser()`/`getCurrentUser()`
 * (`src/lib/auth-helpers.ts`): those are used throughout the service layer with no scope
 * context at all (e.g. `profile-service.ts`'s `getOwnProfile()` just calls
 * `requireUser()`). If a Bearer API key transparently satisfied that same check, a key
 * minted with only `profile:read` would silently gain full write access to every legacy
 * route that happens to call `requireUser()` internally — exactly the "broad bearer
 * token" outcome the conservative default was supposed to rule out. Keeping this
 * resolution local to the v1 route layer means a scope is always checked *before* any
 * service call runs, and legacy session-only routes are completely unaffected.
 *
 * Auth precedence, matching the track doc ("auth'd the same way as current session-based
 * routes (Auth.js) plus a token/API-key path for non-browser clients"):
 * 1. `Authorization: Bearer <token>` — verified against `ApiKey`, scope-checked.
 * 2. Otherwise, the normal browser session (Auth.js) — a signed-in user hitting
 *    `/api/v1/*` directly gets exactly the same access as the rest of the web app.
 */

export type ApiAuthContext = {
  userId: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  authMethod: "api_key" | "session";
  /** `"all"` for session auth (same access as the web app); the key's own scopes otherwise. */
  scopes: ApiScope[] | "all";
};

function hasRequiredScope(ctx: Pick<ApiAuthContext, "scopes">, scope: ApiScope): boolean {
  if (ctx.scopes === "all") return true;
  return hasScope(ctx.scopes, scope);
}

/**
 * Resolves the caller and enforces `scope`. Throws `UnauthorizedError` (401) if there's
 * no valid session or API key, `ForbiddenError` (403) if an API key is valid but lacks
 * the required scope.
 */
export async function requireApiUser(request: Request, scope: ApiScope): Promise<ApiAuthContext> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");

  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    const verified = token ? await verifyApiKey(token) : null;
    if (!verified) throw new UnauthorizedError("Invalid or expired API key");

    const ctx: ApiAuthContext = {
      userId: verified.userId,
      role: "USER",
      authMethod: "api_key",
      scopes: verified.scopes,
    };
    if (!hasRequiredScope(ctx, scope)) {
      throw new ForbiddenError(`API key is missing required scope: ${scope}`);
    }

    const user = await prisma.user.findUnique({ where: { id: verified.userId } });
    if (!user || user.status === "SUSPENDED" || user.status === "DELETED") {
      throw new UnauthorizedError();
    }
    return { ...ctx, role: user.role };
  }

  // No bearer token presented — fall back to the same session auth every other route uses.
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return { userId: user.id, role: user.role, authMethod: "session", scopes: "all" };
}
