import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-helpers";
import { API_SCOPES, ApiKeyError, createApiKey, listApiKeys } from "@/lib/services/api-key-service";

/**
 * Session-only management of the caller's own API keys — this is a web-app settings
 * page concern (see /settings/api-keys), not part of the versioned `/api/v1/*` surface.
 * Minting a key always requires an authenticated browser session; there is no way to
 * create one using another API key, which keeps exactly one credential-issuing path.
 */

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  ttlDays: z.number().int().positive().max(365).optional(),
});

export async function GET() {
  const user = await requireUser();
  const keys = await listApiKeys(user.id);
  return NextResponse.json({ keys, availableScopes: API_SCOPES });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { summary, plaintextToken } = await createApiKey({ userId: user.id, ...parsed.data });
    // The plaintext token is only ever returned here, exactly once.
    return NextResponse.json({ key: summary, token: plaintextToken }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiKeyError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
