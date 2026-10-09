# Track 7 — Platform, API & native clients

## Scope

Extract core business logic behind a stable, versioned API surface so a future native
mobile client, partner integration, or internal tool can reuse it without going through
server-rendered pages. Also: groundwork for localization (the Year 2 roadmap names it
explicitly), not full multilingual rollout (that's later-year scope —
"multilingual/global discovery").

## Why

The original vision's agent-handoff instructions: "Keep business logic behind typed
service interfaces so native apps, integrations and future search engines can reuse
it" — written as a standing instruction for *all* of V1's build, not a future task;
this track is where that pays off concretely. Year 2 of the roadmap also names native
mobile clients and localization.

## What exists today

V1 is already organized with a service layer (`src/lib/services/*.ts` — e.g.
`search-service.ts`, `profile-service.ts`, `claim-service.ts`) consumed by Next.js
route handlers and server actions (see `docs/architecture.md` for the layering).
`SkillAlias.locale` already exists in the schema (default `"en"`) — i18n groundwork is
partially there at the data layer, nowhere else.

## What to build

1. Audit which routes/server actions are thin wrappers over the service layer (should
   be all of them) vs. have logic leaking into the route/action itself — fix any that
   leak before calling the API surface "stable."
2. A versioned REST (or typed RPC) API surface over the existing services, auth'd the
   same way as the current session-based routes (Auth.js) plus a token/API-key path for
   non-browser clients — this is a policy decision (see below), not just code.
3. Localization groundwork: externalize user-facing strings currently hardcoded in
   components, decide on an i18n library, and extend the existing `SkillAlias.locale`
   pattern to other localized labels (skill category names, stage names, etc.) — don't
   attempt full translation coverage, just the plumbing.

## Invariants to preserve

- The API surface must enforce exactly the same visibility/confirmation rules as the
  web app — a native client or partner integration is not a backdoor around
  self-declared-vs-confirmed, claim review, or location coarsening.

## Policy questions to flag, not decide silently

- Auth model for non-browser clients (API keys? OAuth client credentials? mobile app
  attestation?) — a real security decision, not a default to pick alone.
- Whether/which partner integrations are even planned — building a generic API surface
  with no consumer in mind risks the named risk-register entry "feature sprawl."

## Out of scope here

Building an actual native mobile app, and full multilingual UI rollout — both named
explicitly as later-year scope in the source vision.
