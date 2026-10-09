# Data model

`prisma/schema.prisma` is the single source of truth — read it directly for exact
fields/types. This doc explains the entity groups and, more importantly, the invariants
the schema *can't* enforce by itself, which the service layer must.

## Entity groups

- **Auth**: `User`, `Account`, `Session`, `EmailVerificationToken`, `PasswordResetToken`.
- **Identity**: `PersonProfile`, `Business`, `BusinessMembership`, `Skill`,
  `SkillAlias`, `PersonSkill`, `PortfolioItem`, `PortfolioItemSkill`, `ExperienceEntry`.
- **Trust**: `CredentialClaim`, `VerificationReview`, `BadgeDefinition`, `BadgeAward`.
- **Relationship graph**: `Relationship`, `RelationshipRequest`,
  `RelationshipParticipantVisibility`, `RelationshipEvidence`, `RelationshipDispute`,
  `Endorsement`, `ProfessionalFeedback`.
- **Social**: `Post`, `Comment`, `Reaction`, `Follow`.
- **Opportunity layer**: `HelpRequest`, `HelpResponse`, `Opportunity`, `Application`,
  `ServiceOffering`, `Inquiry`.
- **Messaging/notifications**: `Conversation`, `ConversationParticipant`, `Message`,
  `Notification`.
- **Safety/ops**: `Report`, `Block`, `AuditEvent`.

## The relationship graph, in detail

This is the most structurally unusual part of the schema, because the product
requirements (see [product-overview.md](./product-overview.md)) are unusually specific
about trust and consent. A `Relationship` row has:

- `type` — one of ten `RelationshipType` values (worked-with, colleague, collaborator,
  client/provider, mentor/mentee, consultant/client, business partner, friend, family,
  learning-from).
- `partyAUserId`/`partyARole` and `partyBUserId`/`partyBRole` — the role labels are
  free-text but validated in `relationship-service.ts` against a fixed per-type map
  (`RELATIONSHIP_ROLE_MAP`): symmetric types repeat the type name on both sides;
  asymmetric types (e.g. `MENTOR_MENTEE`) get distinct labels (`MENTOR`/`MENTEE`).
- `state` — `PROPOSED` / `ACTIVE` / `PAST` / `PLANNED`.
- `confirmationStatus` — `SELF_DECLARED` / `MUTUALLY_CONFIRMED` / `EVIDENCE_REVIEWED`.
- `declaredByUserId` — whoever's declaration created the relationship.
- `counterpartConsent` — `NOT_REQUIRED` / `PENDING` / `GRANTED` / `DENIED`, relevant
  only to `FAMILY` relationships.

A separate `RelationshipRequest` table is the pre-relationship handshake: one user
proposes a type + intent (`RelationshipIntent` — want to collaborate, seek mentorship,
etc.) to another; accepting creates the actual `Relationship` row.

### Invariants the service layer enforces

These are non-negotiable per the product spec, and are what
`src/lib/services/__tests__/relationship-service.test.ts` exists to prove:

1. **`confirmationStatus` only advances via the counterpart.**
   `confirmRelationship()` throws if `confirmingUserId === declaredByUserId` — the
   person who declared a relationship can never be the one who confirms it. This is the
   single most load-bearing rule in the whole app: without it, "mutually confirmed"
   would mean nothing.
2. **Endorsement/feedback verification is recomputed server-side, every time.**
   `createEndorsement()`/`createProfessionalFeedback()` look up the backing
   relationship's actual `confirmationStatus` and set `Endorsement.status` /
   `ProfessionalFeedback.isIndependentlyConfirmed` from that — never from client input.
   An endorsement riding on a `SELF_DECLARED` relationship is `UNVERIFIED`, full stop.
3. **Visibility is strictly per-participant.**
   `RelationshipParticipantVisibility` has one row per `(relationshipId, userId)`.
   `setParticipantVisibility()` only ever touches the caller's own row. Participant A
   hiding a relationship has zero effect on what participant B's profile shows.
4. **`FAMILY` relationships gate identity disclosure on explicit consent.**
   `counterpartConsent` starts `PENDING` (not `NOT_REQUIRED`) when a `FAMILY`
   relationship is created; `canShowCounterpartIdentity()` returns `false` until it's
   `GRANTED`, regardless of the relationship's visibility setting otherwise.
5. **Multiple relationship types between the same two people coexist.**
   There's no unique constraint on `(partyAUserId, partyBUserId)` — two people can be
   both `WORKED_WITH` and later `FRIEND`, and both rows render independently.
6. **A `PersonSkill` has at most one primary.**
   The DB doesn't enforce this (no partial unique index); `profile-service.ts`'s
   `setPrimarySkill()` demotes any existing primary inside a transaction before setting
   the new one.
7. **`ProfessionalStage` is assigned, never user-set.**
   `PersonSkill.stage` plus `stageRationale` (a JSON snapshot of why) is the intended
   shape; see [decisions.md](./decisions.md) for how much of the *rules engine* behind
   this is actually implemented in V1 versus admin-manual.
8. **A `CredentialClaim` only changes status through a `VerificationReview`.**
   `admin-claim-review-service.ts#decideClaim()` is the only path that updates
   `CredentialClaim.status`, and it always writes a `VerificationReview` row first,
   inside the same transaction, plus an `AuditEvent`.
9. **Location is never stored precisely.**
   `PersonProfile`/`Business` only have `city`/`region`/`country` strings plus
   deliberately coarse `approxLat`/`approxLng` floats — there is no exact-address field
   anywhere in the schema, so there's nothing to accidentally leak.

## Media and uploads

`PortfolioItem.images` and `Post.images` are plain `String[]` columns of URLs — the URL
scheme depends on the active storage driver (`/media/...` locally, a real bucket URL in
production). See [architecture.md](./architecture.md#storage).

## Soft-deleted accounts

`User.status = DELETED` plus `deletedAt` marks a deleted account; the row and its
`PersonProfile` are kept (email/name/passwordHash scrubbed) rather than hard-deleted, so
other users' `Relationship`/`Endorsement`/`ProfessionalFeedback` rows referencing this
person stay referentially intact — see invariant #2 in
[product-overview.md](./product-overview.md#product-principles) ("no self-declared link
can mutate another party's confirmed status") extended to deletion: one party leaving
shouldn't erase another party's record of a shared history.
