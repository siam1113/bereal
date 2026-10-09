# Platform API (`/api/v1/*`)

A versioned, stable REST surface over the same service layer the web app calls — see
[architecture.md](./architecture.md#layering). Built so a future native mobile client,
partner integration, or internal tool can reuse COMMON's business logic without going
through server-rendered pages, per the original build instruction: "keep business logic
behind typed service interfaces so native apps, integrations and future search engines
can reuse it."

## Invariant

The API surface enforces exactly the same visibility/confirmation rules as the web app.
Every `/api/v1/*` route calls the same `src/lib/services/*.ts` functions the
session-based web routes call — there is no parallel code path, so a native client or
partner integration cannot become a backdoor around self-declared-vs-confirmed
relationships, claim review, or location coarsening. Concretely: `profile-service.ts`'s
`getProfileByUserId`/`updateProfileByUserId` and `relationship-service.ts`'s
`confirmRelationship`/`setParticipantVisibility`/etc. are the identical functions
whether the caller resolved via a browser session or an API key — see
`src/lib/api/auth.ts` for why identity resolution is kept local to the v1 route layer
instead of folded into `requireUser()`.

## Auth

Two methods, checked in this order by `requireApiUser()` (`src/lib/api/auth.ts`):

1. **`Authorization: Bearer <token>`** — a scoped API key (see below). Resolves to the
   key's owning user, restricted to that key's own `scopes`.
2. **Browser session (Auth.js)** — a signed-in user hitting `/api/v1/*` directly gets
   exactly the same access as the rest of the web app (`scopes: "all"`).

There is no separate credential-issuing flow: a key can only be minted by its owner from
an authenticated web session (`POST /api/api-keys`, backing `/settings/api-keys`), so
there is exactly one place a password is ever checked. See
[decisions.md](./decisions.md) for the policy status of this auth model — **it was
flagged, not silently decided, per the Track 7 brief's "a real security decision"
instruction.** The scoped-API-key design below is the conservative default chosen while
that's pending human sign-off; it is not a closed decision.

### API keys

- `ApiKey` (`prisma/schema.prisma`) is always tied to exactly one `User` — never a broad
  bearer token that grants everything the user could do.
- Created with an explicit, narrow `scopes` list chosen at creation time (see
  `API_SCOPES` in `src/lib/services/api-key-service.ts`). A key can never do more than
  the union of its scopes allows, and scopes only narrow — never widen — what the
  underlying service calls already enforce for that user.
- The plaintext token (`common_sk_<random>`) is shown exactly once at creation; only a
  SHA-256 hash (`keyHash`) and a short `keyPrefix` (for the user to tell keys apart in
  the UI) are persisted.
- Default expiry 90 days, capped at 365 (`DEFAULT_TTL_DAYS`/`MAX_TTL_DAYS`); keys can be
  revoked at any time by their owner (`DELETE /api/api-keys/:id`), never by anyone else.
- Management UI: `/settings/api-keys`. Management API (session-only, not versioned —
  minting a credential is a web-app settings concern): `GET/POST /api/api-keys`,
  `DELETE /api/api-keys/:id`.

### Scopes

| Scope | Grants |
| --- | --- |
| `profile:read` / `profile:write` | Read/update the caller's own profile. |
| `search:read` | Public people/skill search (also available signed-out). |
| `relationships:read` / `relationships:write` | List relationships, send/respond to requests, confirm, dispute, set visibility. |
| `messages:read` / `messages:write` | List/read conversations, send messages. |
| `help-requests:read` / `help-requests:write` | Browse (also available signed-out) / create help requests. |
| `notifications:read` / `notifications:write` | List notifications, mark read. |

Write scopes do not imply a separate read grant at the DB/schema level (`scopes` is an
unvalidated `String[]`) — each route declares the single scope it requires, and a key
missing it gets `403`, not a silent downgrade.

## Endpoints

| Method | Path | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1` | none | Version/scope manifest. |
| `GET` | `/api/v1/profiles/me` | `profile:read` | |
| `PATCH` | `/api/v1/profiles/me` | `profile:write` | |
| `GET` | `/api/v1/profiles/:slug` | none | Public, mirrors `/p/[slug]`. |
| `GET` | `/api/v1/search/people` | none | Public, mirrors `/api/search/people`. |
| `GET` | `/api/v1/search/skills` | none | Public, mirrors `/api/search/skills`. |
| `GET` | `/api/v1/relationships` | `relationships:read` | |
| `GET` | `/api/v1/relationships/requests` | `relationships:read` | |
| `POST` | `/api/v1/relationships/requests` | `relationships:write` | Rate-limited. |
| `POST` | `/api/v1/relationships/:id/confirm` | `relationships:write` | 403 if self-confirming. |
| `POST` | `/api/v1/relationships/:id/dispute` | `relationships:write` | Rate-limited. |
| `POST` | `/api/v1/relationships/:id/visibility` | `relationships:write` | Only the caller's own participant row. |
| `GET` | `/api/v1/conversations` | `messages:read` | |
| `POST` | `/api/v1/conversations` | `messages:write` | Find-or-create by recipient. |
| `GET` | `/api/v1/conversations/:id` | `messages:read` | 404 if not a participant (no leak). |
| `POST` | `/api/v1/conversations/:id/messages` | `messages:write` | Rate-limited. |
| `GET` | `/api/v1/help-requests` | none | Public. |
| `POST` | `/api/v1/help-requests` | `help-requests:write` | |
| `GET` | `/api/v1/notifications` | `notifications:read` | |
| `POST` | `/api/v1/notifications/read-all` | `notifications:write` | |

## Error shape

`src/lib/api/http.ts`'s `apiErrorResponse()` maps known error types to status codes
consistently across every v1 route: `UnauthorizedError` → 401, `ForbiddenError`/
`RelationshipAuthError` → 403, `ApiKeyError`/`RelationshipStateError` → 400, anything
else → 500 (logged server-side, never leaked to the client). Route-specific business
errors not in that list are still caught locally per route (e.g. `findOrCreateConversation`
blocking self-messaging or a block in either direction, mapped to 403 in
`src/app/api/v1/conversations/route.ts`).

## Out of scope (see the Track 7 roadmap doc)

Building an actual native mobile app, OAuth client-credentials/mobile-attestation auth,
and any specific partner integration — none are planned yet; see
[decisions.md](./decisions.md).
