# Track 3 — Relationships & collaboration graph

## Scope

Extend the existing relationship graph with **project-based collaboration history** (a
relationship anchored to a specific project/work item, not just a type+intent pair),
**team histories** (who worked together, on what, when — queryable), **mentoring
programs** (structured, beyond the existing one-sided "learning-from" declaration), and
**optional private networks** (relationships visible only within a closed group).
Business-to-person and business-to-business relationship types are also in scope.

## Why

Product-expansion "Relationships" track: project-based collaboration graph, team
histories, mentoring programs, directed learning links, optional private networks,
business-to-person/business-to-business relationships, explicit consent for sensitive
links.

## What exists today

Read `docs/data-model.md`'s relationship-graph section and `../product-overview.md`'s
"The relationship graph" section before starting — V1 already has: typed relationships
(worked-with, colleague, collaborator, client/provider, mentor/mentee, consultant/
client, business partner, friend, family, learning-from), a separate intent layer,
states (proposed/active/past/planned), self-declared → mutually-confirmed flow with
per-side visibility control, and family relationships requiring explicit named-
counterpart consent. This track *extends* that model — it does not replace it.

## What to build

1. A way to anchor a relationship (or a new join record) to a specific
   `PortfolioItem`/project, so "worked-with" becomes "worked with on *this*", queryable
   as team history per project.
2. Business-to-person (beyond existing owner/membership links — e.g. a business
   endorsing or formally engaging a person) and business-to-business relationship
   types, following the same confirmation/visibility/dispute pattern as person-to-
   person ones.
3. A structured mentoring-program construct above the existing one-sided learning-from
   declaration — likely mutual, with its own lifecycle, distinct from the generic
   mentor/mentee relationship *type* that already exists.
4. Private-network scoping: a relationship or group of relationships visible only to
   members of a defined closed group, layered on top of (not replacing) the existing
   per-side visibility controls.

## Invariants to preserve

- Multiple concurrent relationship types between the same two entities stays
  supported — this is a named non-negotiable V1 test case; any new relationship types
  must not collapse that.
- Self-declared → mutually-confirmed, never auto-promoted; each side still controls
  visibility only on their own side.
- Family-style sensitive relationships keep requiring explicit named-counterpart
  consent before public attribution — apply the same bar to any new sensitive link
  type this track introduces.

## Policy questions to flag, not decide silently

- What counts as "sensitive" for the explicit-consent requirement beyond the existing
  family case.
- Default visibility for private-network membership itself (is network membership
  visible outside the network?).

## Dependencies / collision notes

Opportunity network (Track 4) and Learning & mentorship (Track 5) will likely want to
read from this track's team-history and mentoring constructs — coordinate schema
changes if built concurrently; this track should land its core models first.
