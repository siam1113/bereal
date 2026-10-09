import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ApiKey } from "@prisma/client";

export class ApiKeyError extends Error {}

/**
 * Every scope an API key can be granted. Deliberately narrow and resource-scoped — see
 * docs/platform-api.md for the auth-model rationale (conservative default: a key is
 * always tied to one user and can never grant more than that user's own session would
 * already allow; scopes only narrow, never widen, what the underlying service calls
 * enforce). Read scopes never allow mutation; write scopes imply the matching read.
 */
export const API_SCOPES = [
  "profile:read",
  "profile:write",
  "search:read",
  "relationships:read",
  "relationships:write",
  "messages:read",
  "messages:write",
  "help-requests:read",
  "help-requests:write",
  "notifications:read",
  "notifications:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

const TOKEN_PREFIX = "common_sk_";
const DEFAULT_TTL_DAYS = 90;
const MAX_TTL_DAYS = 365;

function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type ApiKeySummary = Pick<
  ApiKey,
  "id" | "name" | "keyPrefix" | "scopes" | "lastUsedAt" | "expiresAt" | "revokedAt" | "createdAt"
>;

function toSummary(key: ApiKey): ApiKeySummary {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  };
}

/**
 * Mints a new API key for `userId`. Requires the caller to already be authenticated as
 * that user via a normal session — this is the only path that creates a key, so there is
 * never a second place a credential gets issued. Returns the plaintext token exactly
 * once; it is never recoverable afterward (only `keyHash` is persisted).
 */
export async function createApiKey(input: {
  userId: string;
  name: string;
  scopes: string[];
  ttlDays?: number;
}): Promise<{ summary: ApiKeySummary; plaintextToken: string }> {
  const name = input.name.trim();
  if (!name) throw new ApiKeyError("Name is required");
  if (input.scopes.length === 0) throw new ApiKeyError("At least one scope is required");

  const scopes = Array.from(new Set(input.scopes));
  for (const scope of scopes) {
    if (!isApiScope(scope)) throw new ApiKeyError(`Unknown scope: ${scope}`);
  }

  const ttlDays = Math.min(input.ttlDays ?? DEFAULT_TTL_DAYS, MAX_TTL_DAYS);
  if (ttlDays <= 0) throw new ApiKeyError("ttlDays must be positive");

  const secret = randomBytes(32).toString("base64url");
  const plaintextToken = `${TOKEN_PREFIX}${secret}`;
  const keyHash = hashToken(plaintextToken);
  const keyPrefix = plaintextToken.slice(0, TOKEN_PREFIX.length + 6);

  const created = await prisma.apiKey.create({
    data: {
      userId: input.userId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    actorUserId: input.userId,
    action: "API_KEY_CREATED",
    targetType: "ApiKey",
    targetId: created.id,
    metadata: { name, scopes },
  });

  return { summary: toSummary(created), plaintextToken };
}

export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return keys.map(toSummary);
}

/** Only the owning user can revoke their own key. */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== userId) throw new ApiKeyError("Not found");
  if (key.revokedAt) return;

  await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  await logAudit({
    actorUserId: userId,
    action: "API_KEY_REVOKED",
    targetType: "ApiKey",
    targetId: keyId,
    metadata: {},
  });
}

export type VerifiedApiKey = {
  userId: string;
  scopes: ApiScope[];
  keyId: string;
};

/**
 * Verifies a plaintext bearer token against stored hashes. Returns `null` for anything
 * invalid, revoked, or expired rather than throwing — callers (the auth layer) decide
 * how to respond; this function never leaks *why* a token was rejected.
 */
export async function verifyApiKey(plaintextToken: string): Promise<VerifiedApiKey | null> {
  if (!plaintextToken.startsWith(TOKEN_PREFIX)) return null;

  const keyHash = hashToken(plaintextToken);
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Best-effort — don't fail the request if this write races/fails.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    userId: key.userId,
    scopes: key.scopes.filter(isApiScope),
    keyId: key.id,
  };
}

export function hasScope(granted: ApiScope[], required: ApiScope): boolean {
  return granted.includes(required);
}
